// Cliente de Supabase — conexión única para toda la app
// La URL y la key vienen de variables de entorno (Vite)
import { createClient } from "@supabase/supabase-js";

// Fallback hard-coded por si las variables de entorno no llegaran al build (debug).
// Estas son keys PUBLISHABLE — seguras para frontend.
const FALLBACK_URL = "https://vvdnmgzhrhueivqjtyfl.supabase.co";
const FALLBACK_KEY = "sb_publishable_XUTfnQfz94qQgXN0zDExJQ_mFIl5ZVf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || FALLBACK_KEY;

// Estado global visible para que la app pueda mostrarlo en pantalla
export const supabaseStatus = {
  initialized: false,
  url: SUPABASE_URL,
  keyPreview: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 25) + "..." : "MISSING",
  lastError: null,
  usingFallback: !import.meta.env.VITE_SUPABASE_URL
};

console.log("[supabase] init →", {
  url: SUPABASE_URL ? "✓ presente" : "✗ FALTA",
  key: SUPABASE_KEY ? `✓ presente (${SUPABASE_KEY.slice(0, 20)}...)` : "✗ FALTA"
});

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[supabase] Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_KEY. La app correrá en modo local (sin persistencia).");
}

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,          // Mantener sesión en localStorage tras F5
        autoRefreshToken: true,        // Renovar tokens automáticamente
        detectSessionInUrl: true,      // Detectar callback de magic link / OAuth
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "sistekore-auth"
      }
    })
  : null;

supabaseStatus.initialized = !!supabase;

// === MODELO DE PERSISTENCIA ===
// Usamos una única tabla `kv_store` con clave (key) + JSON (data) por cada colección.
// Esto simplifica el sync y evita conflictos con palabras reservadas de Postgres.
// Colecciones que guardamos: clients · tickets · solved · inv · events · notifications · audit · users

const COLLECTIONS = ["clients", "tickets", "solved", "inv", "events", "notifications", "audit", "users", "kb"];

/** Carga todas las colecciones desde Supabase. Devuelve un objeto con cada colección. */
export async function loadAllFromSupabase() {
  if (!supabase) { console.warn("[supabase] loadAll skipped: client not initialized"); return null; }
  console.log("[supabase] loadAll → querying kv_store...");
  const { data, error } = await supabase.from("kv_store").select("key,data");
  if (error) {
    console.error("[supabase] loadAll error:", error.message, error);
    supabaseStatus.lastError = `LOAD: ${error.message} (${error.code || "no-code"})`;
    return null;
  }
  supabaseStatus.lastError = null;
  console.log("[supabase] loadAll OK →", (data || []).length, "rows");
  const map = {};
  (data || []).forEach((row) => { map[row.key] = row.data; });
  const result = {};
  COLLECTIONS.forEach((c) => { result[c] = Array.isArray(map[c]) ? map[c] : []; });
  return result;
}

/** Guarda (upsert) una colección específica en Supabase. */
export async function saveCollection(key, value) {
  if (!supabase) { console.warn(`[supabase] save(${key}) skipped: client not initialized`); return; }
  if (!COLLECTIONS.includes(key)) return;
  console.log(`[supabase] save(${key}) →`, Array.isArray(value) ? value.length : 0, "items");
  const { error } = await supabase.from("kv_store").upsert(
    { key, data: value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) {
    console.error(`[supabase] save(${key}) error:`, error.message, error);
    supabaseStatus.lastError = `SAVE ${key}: ${error.message} (${error.code || "no-code"})`;
  } else {
    console.log(`[supabase] save(${key}) OK`);
    supabaseStatus.lastError = null;
  }
}

/** Guarda TODAS las colecciones (útil para sincronización masiva inicial). */
export async function saveAllToSupabase(state) {
  if (!supabase) { console.warn("[supabase] saveAll skipped: client not initialized"); return; }
  const rows = COLLECTIONS
    .filter((c) => state[c] !== undefined)
    .map((c) => ({
      key: c,
      data: state[c] || [],
      updated_at: new Date().toISOString()
    }));
  console.log("[supabase] saveAll →", rows.length, "collections");
  const { error } = await supabase.from("kv_store").upsert(rows, { onConflict: "key" });
  if (error) {
    console.error("[supabase] saveAll error:", error.message, error);
    supabaseStatus.lastError = `SAVE-ALL: ${error.message} (${error.code || "no-code"})`;
  } else {
    console.log("[supabase] saveAll OK");
    supabaseStatus.lastError = null;
  }
}
