# Suscripción de pago (Wompi) — estado

## Estado actual (2026-07-14): código listo, pasos manuales en Wompi pendientes

Toda cuenta nueva a partir del despliegue de este cambio necesita suscripción activa
(o prueba de 7 días) para entrar a la app. Las cuentas que ya existían quedan
`grandfathered = true` (gratis para siempre) automáticamente al correr el SQL — no hay
que listarlas a mano. El admin puede además dar acceso gratis a personas puntuales, o
quitar/poner módulos específicos, desde el panel **Usuarios**.

Precio: **$48.900 COP/mes** (Wompi solo procesa en pesos colombianos, no hay opción de
USD), con 7 días de prueba gratis antes del primer cobro.

Se usa Wompi (de Bancolombia) porque funciona con cédula/NIT colombiano — Stripe exige
una entidad registrada en uno de sus países soportados (Colombia no está ahí
directamente) y Bold todavía no tiene cobro recurrente/tokenización disponible en su
API de pagos en línea.

## Diferencia clave frente a Stripe: no hay "suscripción automática"

Wompi no tiene el concepto de una suscripción que se renueva sola. Lo que hacemos:

1. Al terminar el formulario del Paywall, guardamos la tarjeta como una **fuente de
   pago** reutilizable (`payment_source`) — sin cobrar nada todavía.
2. Un cron propio (`charge-subscriptions`, corre una vez al día) cobra esa fuente de
   pago cuando `next_charge_date` ya pasó: la primera vez a los 7 días (fin de la
   prueba), luego cada 30 días.
3. Un webhook (`wompi-webhook`) confirma el resultado de cada cobro y actualiza el
   estado de la suscripción.

## Piezas del código (ya hechas)

- SQL corrido (sección 8 de `supabase/schema.sql`): columnas `grandfathered`,
  `free_access`, `enabled_modules` en `profiles`; tabla `subscriptions` (shape de
  Wompi: `wompi_payment_source_id`, `status`, `next_charge_date`, etc.); trigger
  `protect_admin_only_columns` que impide que un usuario se autoedite esas columnas
  (ni `role`/`disabled`) vía REST directo, aunque tenga su propia sesión.
- Edge Function `supabase/functions/create-wompi-payment-source/index.ts` — recibe el
  token de tarjeta (tokenizado en el navegador, nunca ve el número real) y crea la
  fuente de pago en Wompi. Se llama desde un navegador con sesión real, **sin**
  `--no-verify-jwt`.
- Edge Function `supabase/functions/wompi-webhook/index.ts` — recibe los eventos de
  Wompi y actualiza `subscriptions`. Se despliega **con** `--no-verify-jwt` (Wompi no
  manda JWT de Supabase, solo su propio checksum).
- Edge Function `supabase/functions/charge-subscriptions/index.ts` — el cron que
  dispara los cobros mensuales. Se despliega **con** `--no-verify-jwt` (la llama
  `pg_cron`/`pg_net` sin sesión de usuario, mismo requisito que `send-reminders`).
- `Paywall` en `src/App.jsx`: formulario propio de tarjeta (titular, número, mes/año,
  CVC) + 2 checkboxes de aceptación de términos, con precio fijo en COP.
- Panel **Usuarios**: toggle "Acceso gratis" y chips de módulo por persona (sin
  cambios respecto a la versión anterior con Stripe).

## Pasos manuales pendientes (en el dashboard de Wompi)

Hazlo primero en modo **Sandbox** (pruebas), verifica de punta a punta, y solo después
repite en modo **Producción** (claves y webhook de producción son completamente
separados de sandbox).

1. Crea una cuenta en [comercios.wompi.co](https://comercios.wompi.co) con tu
   cédula/NIT — no necesitas ninguna entidad en el extranjero.
2. En la sección de **Desarrolladores** del dashboard, copia tus llaves de **sandbox**:
   - Llave pública (`pub_test_...`)
   - Llave privada (`prv_test_...`)
   - Secreto de eventos (contiene `_events_`, para el webhook)
3. En **Project Settings → Edge Functions → Secrets** de Supabase, agrega:
   - `WOMPI_PRIVATE_KEY` = tu llave privada
   - `WOMPI_BASE_URL` = `https://sandbox.wompi.co`
   - `WOMPI_EVENTS_SECRET` = tu secreto de eventos
4. En Vercel (y en tu `.env` local), agrega:
   - `VITE_WOMPI_PUBLIC_KEY` = tu llave pública
   - `VITE_WOMPI_BASE_URL` = `https://sandbox.wompi.co`
5. Despliega las 3 funciones (yo las despliego, este paso es solo para que sepas qué
   comando corre):
   ```bash
   npx supabase functions deploy create-wompi-payment-source
   npx supabase functions deploy wompi-webhook --no-verify-jwt
   npx supabase functions deploy charge-subscriptions --no-verify-jwt
   ```
6. En el dashboard de Wompi, sección **Desarrolladores → Eventos**, registra la URL
   del webhook (algo como
   `https://<tu-proyecto>.supabase.co/functions/v1/wompi-webhook`) — esto se hace a
   mano en el dashboard, no hay API para crearlo.
7. Registra el cron job en el SQL Editor de Supabase (una sola vez):
   ```sql
   select cron.schedule(
     'charge-subscriptions-daily',
     '0 15 * * *',  -- 15:00 UTC ≈ 10am Bogotá
     $$ select net.http_post(
       url := 'https://yzpyobyflkyvpflqqljt.supabase.co/functions/v1/charge-subscriptions',
       headers := jsonb_build_object('Authorization', 'Bearer <tu service_role key>')
     ); $$
   );
   ```
8. Busca en la documentación de Wompi (docs.wompi.co, sección de sandbox) el número de
   tarjeta de prueba exacto para tokenizar en sandbox, y complétalo el formulario del
   Paywall con una cuenta de prueba nueva. Confirma en el SQL Editor:
   ```sql
   select * from subscriptions order by created_at desc limit 5;
   ```
   Debe aparecer una fila con `status = 'trialing'` y `wompi_payment_source_id`
   poblado.
9. Para probar el cobro sin esperar 7 días de verdad, adelanta manualmente
   `next_charge_date` de esa fila de prueba a una fecha pasada:
   ```sql
   update subscriptions set next_charge_date = now() - interval '1 hour' where id = <el id de prueba>;
   ```
   y luego invoca el cron a mano:
   ```bash
   curl -X POST https://<tu-proyecto>.supabase.co/functions/v1/charge-subscriptions \
     -H "Authorization: Bearer <tu service_role key>"
   ```
   Confirma que la fila queda en `status = 'active'` (puede tardar unos segundos en
   llegar el webhook) con `next_charge_date` 30 días adelante.
10. Solo después de que los pasos 8-9 funcionen en sandbox, repite los pasos 2-9 con
    llaves y webhook de **producción**.
11. Después de correr el SQL nuevo (sección 8), confirma que las cuentas existentes
    quedaron protegidas del paywall:
    ```sql
    select id, email, grandfathered from profiles limit 5;
    ```
    Todas deben mostrar `grandfathered = true`.

## Riesgos conocidos (sin verificar todavía en producción)

- **Sin 3D Secure en el guardado de tarjeta** (decisión deliberada para no inflar el
  alcance inicial) — los cobros de renovación podrían tener más rechazos que con
  Stripe en algunas redes de tarjeta. Revisar si `failed_charge_count` sale alto en la
  práctica; hay una mejora documentada por Wompi ("protocolo 3RI") para subir la tasa
  de aprobación si hace falta más adelante.
- **Formato exacto del checksum del webhook** — el código asume que el checksum viene
  en `payload.signature.checksum`; falta confirmar contra un payload real de sandbox
  si también llega (o solo llega) en el header `X-Event-Checksum`. Revisar los logs de
  `wompi-webhook` en las primeras pruebas.
- **Tarjetas de prueba de sandbox** de Wompi no identificadas todavía — buscarlas en
  docs.wompi.co al momento de probar el paso 8 de arriba.
- **Timing de resolución de una transacción `PENDING`** no está documentado con
  precisión por Wompi — el diseño (webhook como fuente de verdad + reconciliación
  diaria del cron) debería cubrirlo, pero falta confirmarlo en vivo.

## Notas de seguridad

- El número de tarjeta **nunca** toca nuestro backend — se tokeniza directo contra la
  API de Wompi desde el navegador con la llave pública; nuestras Edge Functions solo
  ven el token resultante.
- El control de acceso por suscripción es **solo de UI** (qué pantalla se muestra), no
  hay RLS bloqueando lectura/escritura de datos por falta de pago — mismo modelo que
  ya tiene la app hoy con la columna `disabled`.
- `past_due` **no** cuenta como acceso válido — si un cobro falla, la cuenta vuelve al
  Paywall de inmediato (después de 3 fallos consecutivos, la suscripción pasa a
  `canceled`).
- Nadie puede autoeditarse `grandfathered`, `free_access`, `enabled_modules`, `role` o
  `disabled` vía REST directo aunque tenga su propia sesión — el trigger
  `protect_admin_only_columns` revierte esos campos a su valor anterior salvo que quien
  edita sea admin.
- La idempotencia de los cobros (evitar cobrar dos veces) es responsabilidad nuestra
  (`last_charge_attempt_at` en `subscriptions`), no se depende de que Wompi deduplique
  por `reference`.
