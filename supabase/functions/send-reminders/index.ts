// Edge Function: send-reminders
//
// Se invoca cada minuto vía pg_cron (ver supabase/README_NOTIFICACIONES.md).
// Revisa hábitos, tareas y bloques de rutina con recordatorio configurado y,
// si la hora actual (America/Bogota) coincide, despacha un push a cada
// suscripción del usuario dueño de ese ítem.
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

// Hora/fecha local de Bogotá (los recordatorios se guardan en hora local, sin timezone).
function nowInBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string, string>;
  return { date: `${map.year}-${map.month}-${map.day}`, hm: `${map.hour}:${map.minute}` };
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

async function sendToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
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

Deno.serve(async () => {
  const { date, hm } = nowInBogota();

  const { data: habits } = await supabase
    .from("habits").select("id,user_id,name,reminder_time,last_notified_date").not("reminder_time", "is", null);
  for (const h of habits ?? []) {
    if (h.reminder_time?.slice(0, 5) === hm && h.last_notified_date !== date) {
      await sendToUser(h.user_id, { title: "PROGO · Hábito", body: `Es hora de: ${h.name}`, url: "/" });
      await supabase.from("habits").update({ last_notified_date: date }).eq("id", h.id);
    }
  }

  const { data: tasks } = await supabase
    .from("tasks").select("id,user_id,title,reminder_time,last_notified_date").not("reminder_time", "is", null);
  for (const t of tasks ?? []) {
    if (t.reminder_time?.slice(0, 5) === hm && t.last_notified_date !== date) {
      await sendToUser(t.user_id, { title: "PROGO · Tarea", body: t.title, url: "/" });
      await supabase.from("tasks").update({ last_notified_date: date }).eq("id", t.id);
    }
  }

  const { data: activities } = await supabase
    .from("activities").select("id,user_id,title,date,repeat,start_min,last_notified_date").eq("notify_enabled", true);
  for (const a of activities ?? []) {
    if (!occursOn(a, date) || a.last_notified_date === date) continue;
    const hh = String(Math.floor(a.start_min / 60)).padStart(2, "0");
    const mm = String(a.start_min % 60).padStart(2, "0");
    if (`${hh}:${mm}` === hm) {
      await sendToUser(a.user_id, { title: "PROGO · Rutina", body: a.title, url: "/" });
      await supabase.from("activities").update({ last_notified_date: date }).eq("id", a.id);
    }
  }

  return new Response("ok");
});
