import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// "Mantener sesión iniciada": si está activado (default), la sesión se guarda
// en localStorage y sobrevive a cerrar y reabrir la app. Si el usuario lo
// desactiva antes de iniciar sesión, se guarda en sessionStorage en vez de
// localStorage, así que se pierde cuando se cierra la pestaña/app.
const REMEMBER_KEY = "progo-remember-me";

export function setRememberMe(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
}

function rememberMe() {
  return localStorage.getItem(REMEMBER_KEY) !== "false";
}

const dynamicStorage = {
  getItem: key => (rememberMe() ? localStorage : sessionStorage).getItem(key),
  setItem: (key, value) => (rememberMe() ? localStorage : sessionStorage).setItem(key, value),
  removeItem: key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: dynamicStorage } })
  : null;
