// Edge Function: stripe-webhook
//
// Se despliega CON --no-verify-jwt (a diferencia de create-checkout-session):
// Stripe llama este endpoint directo, sin ningún JWT de Supabase, solo con su
// propia firma en el header `Stripe-Signature`. La seguridad depende
// enteramente de verificar esa firma contra el cuerpo crudo de la petición —
// nunca confiar en el contenido sin verificarlo primero.
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY      - misma clave que create-checkout-session
//   STRIPE_WEBHOOK_SECRET  - "whsec_..." que da Stripe al crear el endpoint
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.error("stripe-webhook: subscription sin metadata.supabase_user_id", sub.id);
    return;
  }
  const price = sub.items.data[0]?.price;
  const { error } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    currency: price?.currency ?? null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) console.error("stripe-webhook: error guardando suscripción:", error.message);
}

Deno.serve(async req => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Falta la firma", { status: 400 });

  // Crítico: leer el cuerpo crudo ANTES de parsear nada — constructEventAsync
  // necesita los bytes exactos que Stripe firmó, no un JSON.stringify de vuelta.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: firma inválida:", (err as Error).message);
    return new Response("Firma inválida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (typeof session.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await upsertSubscription(sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break; // otros eventos no nos interesan por ahora
    }
  } catch (err) {
    console.error("stripe-webhook: error procesando evento:", err);
    // Igual respondemos 200 — un error nuestro no debe hacer que Stripe reintente
    // indefinidamente el mismo evento; queda logueado para revisar a mano.
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
