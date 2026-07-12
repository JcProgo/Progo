// Edge Function: send-reminders
//
// Se invoca cada minuto vía pg_cron (ver supabase/PUSH_NOTIFICATIONS_SETUP.md).
//
// No hay interruptor por ítem: activar notificaciones una vez (botón "Activar
// notificaciones") alcanza para que TODO reciba avisos automáticamente — el único
// filtro real es si el usuario tiene una fila en `push_subscriptions`.
//
// Hábitos y tareas: horarios fijos 8am / 12pm / 6pm (hora de Bogotá) — mientras el
// ítem no esté marcado hecho, se avisa en cada uno de esos tres momentos del día.
//
// Bloques de Rutina: usan su propio horario (`start_min`/`end_min`) — se avisa 20
// min antes de empezar, 10 min antes de empezar, y 10 min después de terminar
// (preguntando cómo le fue).
//
// `notified_stages` (jsonb, lista de strings) + `last_notified_date` evitan que el
// mismo aviso se repita dos veces el mismo día; se reinicia solo al cambiar el día.
//
// Variables de entorno requeridas (Project Settings -> Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY   - misma llave que VITE_VAPID_PUBLIC_KEY en el cliente
//   VAPID_PRIVATE_KEY  - la contraparte privada, generada junto a la pública
//   VAPID_SUBJECT      - "mailto:tu-correo@ejemplo.com"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Hora/fecha local de Bogotá (los horarios de recordatorio son "hora de pared", sin timezone).
function nowInBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string, string>;
  return { date: `${map.year}-${map.month}-${map.day}`, nowMin: Number(map.hour) * 60 + Number(map.minute) };
}

// Misma regla que occursOn() en src/App.jsx (fecha exacta o repetición diaria/semanal).
function occursOn(a: { date: string; repeat: string }, ds: string) {
  if (a.date === ds) return true;
  if (ds < a.date) return false;
  if (a.repeat === "diario") return true;
  if (a.repeat === "semanal") {
    return new Date(a.date + "T00:00:00").getDay() === new Date(ds + "T00:00:00").getDay();
  }
  return false;
}

// Etapas ya avisadas HOY (se reinicia solo cuando cambia el día).
function stagesToday(row: { last_notified_date: string | null; notified_stages: string[] | null }, today: string) {
  return row.last_notified_date === today ? (row.notified_stages ?? []) : [];
}

async function markStage(table: string, id: number, today: string, stagesSoFar: string[], stage: string) {
  await supabase.from(table).update({ last_notified_date: today, notified_stages: [...stagesSoFar, stage] }).eq("id", id);
}

async function sendToUser(userId: string, title: string, body: string) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url: "/" }),
      );
    } catch (err) {
      // 404/410 = la suscripción ya no existe en el navegador (desinstaló, borró datos, etc.)
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
}

const FIXED_SLOTS = [
  { stage: "8am", min: 8 * 60, title: "☀️ Buenos días", body: (t: string) => `No olvides: ${t}` },
  { stage: "12pm", min: 12 * 60, title: "💪 A mitad de día", body: (t: string) => `¿Ya hiciste: ${t}?` },
  { stage: "6pm", min: 18 * 60, title: "🌙 Se acaba el día", body: (t: string) => `Última oportunidad hoy: ${t}` },
];

Deno.serve(async () => {
  const { date, nowMin } = nowInBogota();

  // Hábitos: recordatorio fijo mientras no esté marcado hecho hoy.
  const { data: habits } = await supabase
    .from("habits").select("id,user_id,name,history,last_notified_date,notified_stages");
  for (const h of habits ?? []) {
    if (h.history?.[date]) continue;
    const stages = stagesToday(h, date);
    const slot = FIXED_SLOTS.find(s => s.min === nowMin);
    if (slot && !stages.includes(slot.stage)) {
      await sendToUser(h.user_id, slot.title, slot.body(h.name));
      await markStage("habits", h.id, date, stages, slot.stage);
    }
  }

  // Tareas: recordatorio fijo mientras no esté marcada como hecha (done=false ya filtrado en la consulta).
  const { data: tasks } = await supabase
    .from("tasks").select("id,user_id,title,last_notified_date,notified_stages")
    .eq("done", false);
  for (const t of tasks ?? []) {
    const stages = stagesToday(t, date);
    const slot = FIXED_SLOTS.find(s => s.min === nowMin);
    if (slot && !stages.includes(slot.stage)) {
      await sendToUser(t.user_id, slot.title, slot.body(t.title));
      await markStage("tasks", t.id, date, stages, slot.stage);
    }
  }

  // Rutina: 20 min antes / 10 min antes de empezar, y 10 min después de terminar.
  const { data: activities } = await supabase
    .from("activities").select("id,user_id,title,date,repeat,start_min,end_min,last_notified_date,notified_stages");
  for (const a of activities ?? []) {
    if (!occursOn(a, date)) continue;
    const stages = stagesToday(a, date);
    const actSlots = [
      { stage: "before20", min: a.start_min - 20, title: "⏰ En 20 minutos", body: a.title },
      { stage: "before10", min: a.start_min - 10, title: "💪 ¡Vamos! Faltan 10 min", body: a.title },
      { stage: "after10", min: a.end_min + 10, title: "¿Cómo te fue?", body: `¿Completaste: ${a.title}?` },
    ];
    const slot = actSlots.find(s => s.min === nowMin);
    if (slot && !stages.includes(slot.stage)) {
      await sendToUser(a.user_id, slot.title, slot.body);
      await markStage("activities", a.id, date, stages, slot.stage);
    }
  }

  return new Response("ok");
});
