# Suscripción de pago (Stripe) — estado

## Estado actual (2026-07-14): código listo, pasos manuales en Stripe pendientes

Toda cuenta nueva a partir del despliegue de este cambio necesita suscripción activa
(o prueba de 7 días) para entrar a la app. Las cuentas que ya existían quedan
`grandfathered = true` (gratis para siempre) automáticamente al correr el SQL — no hay
que listarlas a mano. El admin puede además dar acceso gratis a personas puntuales, o
quitar/poner módulos específicos, desde el panel **Usuarios**.

Precio: **$14.99 USD** o **$48.900 COP** por mes, a elección del usuario, con 7 días de
prueba gratis antes del primer cobro.

## Piezas del código (ya hechas)

- SQL corrido (sección 8 de `supabase/schema.sql`): columnas `grandfathered`,
  `free_access`, `enabled_modules` en `profiles`; tabla nueva `subscriptions`; trigger
  `protect_admin_only_columns` que impide que un usuario se autoedite esas columnas (ni
  `role`/`disabled`) vía REST directo, aunque tenga su propia sesión.
- Edge Function `supabase/functions/create-checkout-session/index.ts` — crea la sesión
  de Checkout. Se llama desde un navegador con sesión real, **sin** `--no-verify-jwt`.
- Edge Function `supabase/functions/stripe-webhook/index.ts` — recibe los eventos de
  Stripe y escribe en `subscriptions`. Se despliega **con** `--no-verify-jwt` (Stripe no
  manda JWT de Supabase, solo su propia firma en `Stripe-Signature`).
- `Paywall` en `src/App.jsx`: pantalla que ve cualquier cuenta nueva sin acceso, con
  toggle de moneda y botón "Suscribirme".
- Panel **Usuarios**: toggle "Acceso gratis" y chips de módulo por persona.

## Pasos manuales pendientes (en el Dashboard de Stripe)

Hazlo primero en modo **Test**, verifica de punta a punta, y solo después repite en
modo **Live** (claves, precios y webhook de Live son completamente separados de Test).

1. Crea una cuenta de Stripe (o entra a la existente) en [dashboard.stripe.com](https://dashboard.stripe.com).
2. Crea un producto **"PROGO — Suscripción mensual"** con dos precios recurrentes
   mensuales: $14.99 USD y $48.900 COP. Antes de crear el de COP, confirma en
   **Settings → Payment methods** (o donde el dashboard lo indique) que tu cuenta tiene
   COP habilitado como moneda de cobro.
3. En **Project Settings → Edge Functions → Secrets** de Supabase, agrega:
   - `STRIPE_SECRET_KEY` (clave secreta, `sk_test_...` primero)
   - `STRIPE_PRICE_USD` (id del precio USD, `price_...`)
   - `STRIPE_PRICE_COP` (id del precio COP, `price_...`)
4. Despliega las dos funciones (yo las despliego, este paso es solo para que sepas qué
   comando corre):
   ```bash
   npx supabase functions deploy create-checkout-session
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. En Stripe: **Developers → Webhooks → Add endpoint**, apunta a la URL de
   `stripe-webhook` (algo como
   `https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook`), y selecciona estos
   3 eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copia el **Signing secret** (`whsec_...`) que te da Stripe al crear el endpoint, y
   agrégalo como secret `STRIPE_WEBHOOK_SECRET` en Supabase. Vuelve a desplegar
   `stripe-webhook` después de agregar ese secret.
6. Prueba de punta a punta: crea una cuenta nueva en la app, debe caer en el Paywall.
   Suscríbete con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y
   CVC). Confirma en el SQL Editor de Supabase:
   ```sql
   select * from subscriptions order by created_at desc limit 5;
   ```
   Debe aparecer una fila con `status = 'trialing'` para esa cuenta.
7. Solo después de que el paso 6 funcione en Test, repite los pasos 2-6 con llaves,
   precios y webhook en modo **Live**.
8. Después de correr el SQL nuevo (sección 8), confirma que las cuentas existentes
   quedaron protegidas del paywall:
   ```sql
   select id, email, grandfathered from profiles limit 5;
   ```
   Todas deben mostrar `grandfathered = true`.

## Notas de seguridad

- El control de acceso por suscripción es **solo de UI** (qué pantalla se muestra), no
  hay RLS bloqueando lectura/escritura de datos por falta de pago — mismo modelo que ya
  tiene la app hoy con la columna `disabled`.
- `past_due` **no** cuenta como acceso válido — si el cobro falla, la cuenta vuelve al
  Paywall de inmediato.
- Nadie puede autoeditarse `grandfathered`, `free_access`, `enabled_modules`, `role` o
  `disabled` vía REST directo aunque tenga su propia sesión — el trigger
  `protect_admin_only_columns` revierte esos campos a su valor anterior salvo que quien
  edita sea admin.
