# Notificaciones push — estado

## Estado actual (2026-07-11): funcionando de punta a punta, sin interruptores por ítem

Ya no existe un toggle individual por hábito/tarea/bloque. Con solo tocar **"Activar
notificaciones"** una vez en el menú, aplica automáticamente a:

- **Hábitos y tareas:** aviso a las 8am, 12pm y 6pm (hora de Bogotá) mientras no estén
  marcados como hechos.
- **Rutina:** cada bloque avisa 20 min antes de empezar, 10 min antes, y 10 min después
  de terminar (preguntando "¿Cómo te fue?").

El único "interruptor" real es si el usuario tiene una fila en `push_subscriptions`
(creada al tocar el botón). Las columnas `reminders_enabled`/`notify_enabled` quedaron
en el schema sin uso — se dejaron para no romper filas existentes, pero ni el cliente
ni la Edge Function las leen.

## Piezas desplegadas

- SQL corrido (sección 7 de `supabase/schema.sql`).
- Edge Function `supabase/functions/send-reminders/index.ts` desplegada **con
  `--no-verify-jwt`** — ver nota importante abajo.
- Secrets configurados: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- `pg_cron`/`pg_net` activados, cron job `send-reminders-every-minute` corriendo cada
  minuto (`select cron.schedule(...)`, ver comando abajo si hay que recrearlo).
- `VITE_VAPID_PUBLIC_KEY` en Vercel.

## Nota importante: `--no-verify-jwt`

Por defecto, Supabase exige que quien llame a una Edge Function tenga un JWT válido de
usuario/sesión. El cron (`pg_net.http_post`) llama con la `service_role` key, que SÍ es
un JWT válido del proyecto — pero aun así el gateway la rechazaba con
`401 UNAUTHORIZED_INVALID_JWT_FORMAT` (confirmado en vivo el 2026-07-11 vía
`select * from net._http_response order by created desc limit 10;`, con la clave ya
verificada byte a byte como correcta). La única forma de que el cron pudiera invocar la
función fue desplegarla sin exigir esa verificación:

```bash
npx supabase functions deploy send-reminders --no-verify-jwt
```

**Cualquier redeploy futuro de esta función debe incluir `--no-verify-jwt`** — sin ese
flag, vuelve a dar 401 y el cron deja de funcionar en silencio (no hay ningún error
visible en la app, solo se descubre revisando `net._http_response`).

Diagnóstico rápido si algo deja de llegar:
```sql
select * from cron.job_run_details order by start_time desc limit 5; -- ¿corre el cron?
select * from net._http_response order by created desc limit 5;      -- ¿qué respondió la función? (status_code debe ser 200)
```

## Cómo probarlo

Para probar rápido sin esperar a las 8am/12pm/6pm: crea un bloque de Rutina que empiece
en ~22-25 minutos, cierra la app por completo y espera el primer aviso (20 min antes).
