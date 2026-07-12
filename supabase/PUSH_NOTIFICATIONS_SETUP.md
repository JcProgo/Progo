# Notificaciones push — estado y pasos pendientes en Supabase

## Ya hecho (2026-07-11)

- SQL corrido, Edge Function `send-reminders` desplegada, secrets VAPID configurados,
  `pg_cron`/`pg_net` activados y el cron job `send-reminders-every-minute` programado.
- `VITE_VAPID_PUBLIC_KEY` agregada en Vercel y confirmada en el bundle de producción.

## Pendiente: volver a correr 2 pasos (el diseño de recordatorios cambió)

Hábitos/Tareas pasaron de "hora personalizada por ítem" a horarios fijos (8am/12pm/6pm,
mientras no esté marcado hecho). Rutina se mantiene igual (20 min antes / 10 min antes /
10 min después de terminar, con su propio horario). Esto cambió el schema y el código del
servidor, así que hay que repetir 2 de los pasos que ya hiciste:

### 1. Volver a correr el SQL

Agrega las columnas nuevas (`reminders_enabled`, `notified_stages`). Es la sección 7 de
`supabase/schema.sql` — cópiala completa y córrela de nuevo en el SQL Editor (idempotente,
no rompe nada de lo que ya tienes).

### 2. Volver a desplegar la Edge Function

En la Terminal:

```bash
cd ~/progo
npx supabase functions deploy send-reminders
```

(Ya estás logueado y con el proyecto linkeado de la vez pasada, así que este comando solo
sube el código nuevo — no hay que repetir login ni link.)

**No hace falta tocar los secrets ni el cron job** — siguen siendo válidos tal cual.

## Cómo funciona ahora

- **Hábitos/Tareas:** la campanita en cada fila es un simple on/off. Si está activada y el
  ítem no está marcado como hecho, llega un aviso a las 8am, 12pm y 6pm (hora de Bogotá).
  En cuanto lo marcas hecho, dejan de llegar avisos ese día.
- **Rutina:** el toggle "Notificarme a la hora de inicio" en el editor de un bloque activa 3
  avisos automáticos: 20 min antes de empezar, 10 min antes, y 10 min después de la hora de
  fin preguntando cómo te fue.

## Cómo probarlo

Para probar rápido sin esperar a las 8am/12pm/6pm: crea un bloque de Rutina que empiece en
~21-25 minutos y termine unos minutos después, actívale el toggle de notificar, cierra la
app por completo y espera el primer aviso (20 min antes de esa hora de inicio).
