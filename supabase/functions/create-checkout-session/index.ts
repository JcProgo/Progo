// Edge Function: create-checkout-session
//
// Llamada desde el cliente ya autenticado (supabase.functions.invoke adjunta
// el JWT de la sesión real automáticamente) — a diferencia de `send-reminders`
// (que la llama pg_cron sin sesión de usuario y por eso necesitó
// --no-verify-jwt), esta función SÍ se despliega con la verificación de JWT
// normal de Supabase. Aun así, nunca confiamos en un user_id que mande el
// cliente: lo resolvemos siempre del lado del servidor con auth.getUser().
//
// Body esperado: { "currency": "usd" | "cop" }
// Respuesta: { "url": "https://checkout.stripe.com/..." }
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY   - clave secreta de Stripe (sk_live_... / sk_test_...)
//   STRIPE_PRICE_USD    - id del Price recurrente mensual en USD ($14.99)
//   STRIPE_PRICE_COP    - id del Price recurrente mensual en COP ($48.900)
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const priceIds: Record<string, string | undefined> = {
  usd: Deno.env.get("STRIPE_PRICE_USD"),
  cop: Deno.env.get("STRIPE_PRICE_COP"),
};

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

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

    // Cliente "de usuario": reenvía el JWT del que llama, así auth.getUser()
    // resuelve exactamente quién hizo la petición (no un id inventado por el cliente).
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers });

    const { currency } = await req.json();
    const priceId = priceIds[currency];
    if (!priceId) return new Response(JSON.stringify({ error: "Moneda inválida" }), { status: 400, headers });

    // Reutiliza el Customer de Stripe si ya existe uno para este usuario (evita duplicados
    // si alguien abandona el checkout y lo vuelve a intentar).
    const { data: existing } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: user.id },
      },
      client_reference_id: user.id,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), { headers });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Error interno" }), { status: 500, headers });
  }
});
