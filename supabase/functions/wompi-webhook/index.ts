// Edge Function: wompi-webhook
//
// Se despliega CON --no-verify-jwt (a diferencia de create-wompi-payment-source):
// Wompi llama este endpoint directo, sin ningún JWT de Supabase, solo con su propio
// checksum. La seguridad depende enteramente de verificar ese checksum contra el
// cuerpo crudo de la petición — nunca confiar en el contenido sin verificarlo primero.
//
// Formato del evento (docs.wompi.co/en/docs/colombia/eventos):
//   { event: "transaction.updated", data: { transaction: {...} }, sent_at,
//     signature: { properties: ["transaction.id", "transaction.status", ...], checksum },
//     timestamp }
// Checksum = SHA256( valores de `signature.properties` concatenados en orden
//            + timestamp + WOMPI_EVENTS_SECRET ), comparado en hex contra
//            `signature.checksum`.
//
// NOTA (riesgo abierto, ver supabase/WOMPI_SETUP.md): no confirmado todavía contra un
// payload real de sandbox si el checksum también llega duplicado en el header
// `X-Event-Checksum` — logueamos el payload completo mientras no esté confirmado.
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   WOMPI_EVENTS_SECRET  - contiene "_events_", del dashboard de Wompi
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const eventsSecret = Deno.env.get("WOMPI_EVENTS_SECRET")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function sha256Hex(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getByPath(obj: unknown, path: string) {
  return path.split(".").reduce((acc: any, key) => acc?.[key], obj);
}

async function verifyChecksum(payload: any): Promise<boolean> {
  const properties: string[] = payload?.signature?.properties || [];
  const checksum: string = payload?.signature?.checksum || "";
  if (!properties.length || !checksum) return false;
  const concatenated = properties.map(p => String(getByPath(payload.data, p))).join("") + String(payload.timestamp) + eventsSecret;
  const computed = await sha256Hex(concatenated);
  return computed.toLowerCase() === checksum.toLowerCase();
}

// Comparte la misma lógica de mapeo de estados que usa `charge-subscriptions` al
// reconciliar una transacción PENDING vieja — mantener ambas en sync si se cambia una.
async function applyTransactionStatus(txn: { id: string; status: string; payment_source_id: number }) {
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("wompi_payment_source_id", txn.payment_source_id).maybeSingle();
  if (!sub) {
    console.error("wompi-webhook: no hay suscripción para payment_source_id", txn.payment_source_id);
    return;
  }
  // Idempotencia: ya procesamos exactamente este id+estado antes, no repetir.
  if (sub.last_transaction_id === txn.id && sub.last_charge_status === txn.status) return;

  const patch: Record<string, unknown> = {
    last_transaction_id: txn.id,
    last_charge_status: txn.status,
    updated_at: new Date().toISOString(),
  };

  if (txn.status === "APPROVED") {
    patch.status = "active";
    patch.next_charge_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    patch.failed_charge_count = 0;
  } else if (["DECLINED", "ERROR", "VOIDED"].includes(txn.status)) {
    const failedCount = (sub.failed_charge_count || 0) + 1;
    patch.failed_charge_count = failedCount;
    if (failedCount >= 3) {
      patch.status = "canceled";
    } else {
      patch.status = "past_due";
      patch.next_charge_date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
  }
  // PENDING: solo se actualizan last_transaction_id/last_charge_status de arriba.

  const { error } = await supabase.from("subscriptions").update(patch).eq("id", sub.id);
  if (error) console.error("wompi-webhook: error actualizando suscripción:", error.message);
}

Deno.serve(async req => {
  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Body inválido", { status: 400 });
  }

  const valid = await verifyChecksum(payload);
  if (!valid) {
    console.error("wompi-webhook: checksum inválido", JSON.stringify(payload));
    return new Response("Checksum inválido", { status: 400 });
  }

  try {
    if (payload.event === "transaction.updated" && payload.data?.transaction) {
      const t = payload.data.transaction;
      await applyTransactionStatus({ id: t.id, status: t.status, payment_source_id: t.payment_source_id });
    }
  } catch (err) {
    console.error("wompi-webhook: error procesando evento:", err);
    // Igual respondemos 200 — un error nuestro no debe hacer que Wompi reintente
    // indefinidamente el mismo evento; queda logueado para revisar a mano.
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
