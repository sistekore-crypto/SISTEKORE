// Serverless function de Vercel para signup público
// Crea usuarios en Supabase con email_confirm:true para que no requieran enviar correo.
// Los usuarios quedan en status="pending" hasta que un admin los apruebe.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing Supabase credentials" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son obligatorios" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Email no válido" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Crear usuario con email_confirm:true para que no requiera enviar email
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return res.status(409).json({ error: "Este email ya está registrado. Intenta iniciar sesión." });
      }
      return res.status(400).json({ error: error.message });
    }

    // El trigger de BD crea automáticamente el profile con status=pending
    // (o approved si es sistekore@gmail.com / sistekore@gmail.com)

    return res.status(200).json({
      success: true,
      message: "Cuenta creada correctamente. Esperando aprobación del administrador.",
      user_id: data?.user?.id
    });
  } catch (err) {
    console.error("[api/signup] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}
