// Edge Function: create-wompi-payment-source
//
// Llamada desde el cliente ya autenticado (supabase.functions.invoke adjunta el JWT
// de la sesión real automáticamente) — se despliega SIN --no-verify-jwt, a diferencia
// de `wompi-webhook` y `charge-subscriptions` (llamadas por Wompi/pg_cron sin sesión
// de usuario real). Nunca confiamos en un user_id que mande el cliente: se resuelve
// siempre del lado del servidor con auth.getUser().
//
// El número de tarjeta NUNCA llega hasta acá: el cliente lo tokeniza directo contra
// la API de Wompi (POST /v1/tokens/cards) usando la llave pública, y solo nos manda
// el token resultante — esta función solo ve `card_token`.
//
// Body esperado: { "card_token": "tok_...", "acceptance_token": "...", "accept_personal_auth": "..." }
// Respuesta: { "ok": true, "status": "trialing", "trial_end": "..." }
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   WOMPI_PRIVATE_KEY  - prv_test_... / prv_prod_...
//   WOMPI_BASE_URL     - https://sandbox.wompi.co o https://production.wompi.co
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const wompiPrivateKey = Deno.env.get("WOMPI_PRIVATE_KEY")!;
const wompiBaseUrl = Deno.env.get("WOMPI_BASE_URL")!;

const TRIAL_DAYS = 7;

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async req => {
  const origin = req.headers.get("origin") || "https://progo-theta.vercel.app";
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers });

    // Cliente "de usuario": reenvía el JWT del que llama, así auth.getUser() resuelve
    // exactamente quién hizo la petición (no un id inventado por el cliente).
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers });

    const { card_token, acceptance_token, accept_personal_auth } = await req.json();
    if (!card_token || !acceptance_token || !accept_personal_auth) {
      return new Response(JSON.stringify({ error: "Faltan datos de la tarjeta o de aceptación de términos" }), { status: 400, headers });
    }

    // Evita doble alta si ya hay una suscripción viva (ej. doble clic en "Suscribirme").
    const { data: existing } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
    if (existing && ["trialing", "active"].includes(existing.status)) {
      return new Response(JSON.stringify({ error: "Ya tienes una suscripción activa" }), { status: 400, headers });
    }

    const sourceRes = await fetch(`${wompiBaseUrl}/v1/payment_sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${wompiPrivateKey}` },
      body: JSON.stringify({
        type: "CARD",
        token: card_token,
        customer_email: user.email,
        acceptance_token,
        accept_personal_auth,
      }),
    });
    const sourceBody = await sourceRes.json();
    if (!sourceRes.ok || sourceBody?.data?.status !== "AVAILABLE") {
      const message = sourceBody?.error?.messages
        ? Object.values(sourceBody.error.messages).flat().join(" ")
        : sourceBody?.error?.reason || "Wompi rechazó la tarjeta";
      return new Response(JSON.stringify({ error: message }), { status: 400, headers });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const { error: upsertError } = await supabase.from("subscriptions").upsert({
      user_id: user.id,
      wompi_payment_source_id: sourceBody.data.id,
      wompi_customer_email: user.email,
      status: "trialing",
      trial_end: trialEnd.toISOString(),
      next_charge_date: trialEnd.toISOString(),
      failed_charge_count: 0,
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });
    if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers });

    return new Response(JSON.stringify({ ok: true, status: "trialing", trial_end: trialEnd.toISOString() }), { headers });
  } catch (err) {
    console.error("create-wompi-payment-source error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Error interno" }), { status: 500, headers });
  }
});
