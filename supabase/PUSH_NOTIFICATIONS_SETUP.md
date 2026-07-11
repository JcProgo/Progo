# Notificaciones push — pasos pendientes en Supabase

El código (schema, service worker, Edge Function) ya está en el repo. Faltan 4 pasos manuales
en el dashboard de Supabase (Project: yzpyobyflkyvpflqqljt) que Claude no puede hacer por ti.

## 1. Correr el SQL

Ya está en `supabase/schema.sql` (sección 7). Cópialo y córrelo en el SQL Editor como siempre.

## 2. Desplegar la Edge Function

El código está en `supabase/functions/send-reminders/index.ts`. Necesitas el Supabase CLI:

```bash
npm install -g supabase
supabase login
cd /Users/juanchaverra/progo
supabase link --project-ref yzpyobyflkyvpflqqljt
supabase functions deploy send-reminders
```

(Si prefieres no instalar el CLI, en el dashboard → Edge Functions → "Deploy a new function" puedes
pegar el contenido de `index.ts` directamente.)

## 3. Configurar los secrets de la función

Dashboard → Edge Functions → send-reminders → Secrets (o `supabase secrets set` por CLI):

```
VAPID_PUBLIC_KEY=BH4kqLS8urARxuB79GaFn_NCrZomvqNVjyQJcHgsjxx-V18Sle0pfDjVWmWrcRYhAycP9sTFAdDpx9i4QUjgxgw
VAPID_PRIVATE_KEY=GxpOB33pDkmMDAmuqd31wRjExun1R4Xrkdqin3WRMC4
VAPID_SUBJECT=mailto:juaneschaverra15@gmail.com
```

La pública ya está en `.env` del proyecto como `VITE_VAPID_PUBLIC_KEY` — agrégala también en
Vercel (Settings → Environment Variables) para que el build de producción la incluya.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente, no hay que configurarlos.

## 4. Activar pg_cron y programar el disparo cada minuto

Dashboard → Database → Extensions → activa `pg_cron` y `pg_net`. Luego, en el SQL Editor:

```sql
select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://yzpyobyflkyvpflqqljt.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TU_SERVICE_ROLE_KEY_AQUI',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Reemplaza `TU_SERVICE_ROLE_KEY_AQUI` con la Service Role Key del proyecto (Project Settings → API).
Esa key queda guardada en la definición del cron job — solo visible para ti desde el SQL Editor,
nunca se comparte con el cliente.

Para verificar que corre: `select * from cron.job_run_details order by start_time desc limit 5;`

## Cómo probarlo

1. Abre PROGO instalada en tu iPhone, entra al menú → "Activar notificaciones" (te pedirá permiso).
2. Ponle una hora de recordatorio a un hábito/tarea/bloque de rutina, 1-2 minutos en el futuro.
3. Cierra la app por completo y espera — el push debería llegar aunque PROGO esté cerrada.
