// Edge Function: charge-subscriptions
//
// Se invoca una vez al día vía pg_cron (ver supabase/WOMPI_SETUP.md) — cron
// "charge-subscriptions-daily". Se despliega CON --no-verify-jwt: pg_net la llama sin
// sesión de usuario real, y el gateway de Edge Functions rechaza incluso la
// service_role key con 401 UNAUTHORIZED_INVALID_JWT_FORMAT sin ese flag (mismo bug
// real ya diagnosticado para `send-reminders`, ver PUSH_NOTIFICATIONS_SETUP.md).
//
// Wompi no tiene concepto de "suscripción recurrente" — nosotros disparamos el cobro
// cada mes contra la tarjeta guardada (wompi_payment_source_id). Idempotencia: NO se
// asume que Wompi deduplique por `reference` (no está confirmado en su
// documentación) — la única protección real contra doble cobro es
// `last_charge_attempt_at`, que bloquea un reintento mientras el intento anterior
// sigue sin resolver.
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   WOMPI_PRIVATE_KEY  - misma llave que create-wompi-payment-source
//   WOMPI_BASE_URL     - misma base que create-wompi-payment-source
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const wompiPrivateKey = Deno.env.get("WOMPI_PRIVATE_KEY")!;
const wompiBaseUrl = Deno.env.get("WOMPI_BASE_URL")!;

const MONTHLY_AMOUNT_COP_CENTS = 4890000; // $48.900 COP, en centavos
const PENDING_RETRY_AFTER_MS = 60 * 60 * 1000; // no reintentar un PENDING de menos de 1h

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Misma lógica de mapeo de estados que `wompi-webhook` — mantener en sync si se
// cambia una. Duplicada a propósito: cada Edge Function de este proyecto es
// autocontenida (sin módulo compartido), mismo patrón que el resto del repo.
function mapTransactionStatus(sub: any, txn: { id: string; status: string }) {
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
  return patch;
}

Deno.serve(async () => {
  const now = new Date();
  const { data: candidates, error } = await supabase
    .from("subscriptions")
    .select("*")
    .in("status", ["trialing", "active", "past_due"])
    .lte("next_charge_date", now.toISOString());

  if (error) {
    console.error("charge-subscriptions: error trayendo candidatos:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let reconciled = 0;
  let charged = 0;
  let skipped = 0;

  for (const sub of candidates || []) {
    const attemptAge = sub.last_charge_attempt_at ? now.getTime() - new Date(sub.last_charge_attempt_at).getTime() : Infinity;
    const stillInFlight = sub.last_charge_status === "PENDING" && attemptAge < PENDING_RETRY_AFTER_MS;
    if (stillInFlight) { skipped++; continue; }

    const isStalePending = sub.last_charge_status === "PENDING" && sub.last_transaction_id;
    try {
      if (isStalePending) {
        // Reconcilia en vez de cobrar de nuevo: puede que el webhook nunca haya llegado.
        const res = await fetch(`${wompiBaseUrl}/v1/transactions/${sub.last_transaction_id}`, {
          headers: { Authorization: `Bearer ${wompiPrivateKey}` },
        });
        const body = await res.json();
        if (res.ok && body?.data) {
          await supabase.from("subscriptions").update(mapTransactionStatus(sub, { id: body.data.id, status: body.data.status })).eq("id", sub.id);
          reconciled++;
        }
        continue;
      }

      const reference = `sub-${sub.id}-${new Date(sub.next_charge_date).toISOString().slice(0, 10)}`;
      const res = await fetch(`${wompiBaseUrl}/v1/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wompiPrivateKey}` },
        body: JSON.stringify({
          amount_in_cents: MONTHLY_AMOUNT_COP_CENTS,
          currency: "COP",
          customer_email: sub.wompi_customer_email,
          payment_source_id: sub.wompi_payment_source_id,
          reference,
        }),
      });
      const body = await res.json();
      // Bookkeeping best-effort: NO se marca status:'active' aquí aunque venga
      // APPROVED en la respuesta inmediata — eso lo confirma solo el webhook (o la
      // reconciliación de arriba en la próxima corrida), para no tener dos caminos
      // de código escribiendo el estado final de la misma fila.
      await supabase.from("subscriptions").update({
        last_transaction_id: body?.data?.id ?? sub.last_transaction_id,
        last_charge_status: body?.data?.status ?? "ERROR",
        last_charge_attempt_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", sub.id);
      charged++;
    } catch (err) {
      console.error("charge-subscriptions: error procesando suscripción", sub.id, err);
    }
  }

  return new Response(JSON.stringify({ charged, reconciled, skipped, total: (candidates || []).length }), {
    headers: { "Content-Type": "application/json" },
  });
});
