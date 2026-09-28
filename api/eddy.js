// api/eddy.js — Capa 2 de Eddy Support: modelo de lenguaje (Gemini)
//
// Arquitectura de Eddy:
//   Capa 1 · Base de conocimiento local (EDDY_KB + findAnswer en App.jsx)
//   Capa 2 · Este endpoint → Gemini, con el contexto real de la operación
//   Capa 3 · Escalamiento a humano por WhatsApp
//
// La API key vive SOLO en el servidor. Nunca en el bundle del frontend:
// una variable VITE_* queda incrustada en el JS público y cualquiera
// podría leerla desde el navegador y gastar la cuota.

const SYSTEM_PROMPT = `Eres Eddy Support, el asistente técnico de SisteKore,
la plataforma de gestión de operaciones TI de SisteKore (Medellín, Colombia).

CONTEXTO DEL PRODUCTO
- Módulos: Portal Cliente, Centro de Comando (dashboard con Insights IA), Tickets,
  Clientes (CRM), Inventario, Calendario, Centro de Conocimiento y Usuarios.
- Prioridades y SLA: URGENTE 2 h · ALTA 8 h · MEDIA 24 h · BAJA 72 h.
- Estados de ticket: PENDIENTE, EN PROGRESO, SOLUCIONADO.
- Los tickets se clasifican automáticamente con un modelo de IA que lee la
  descripción del incidente.

REGLAS DE RESPUESTA
- Español colombiano, directo, sin relleno ni saludos largos.
- Máximo 120 palabras.
- Usa los datos de la sección "ESTADO ACTUAL" si te preguntan por cifras.
- Si te piden un dato que no está en ese contexto, dilo y señala en qué módulo
  se consulta. Nunca inventes números de ticket, nombres de clientes ni cifras.
- Si el problema requiere intervención presencial o decisión humana, recomienda
  escalar a un técnico por el botón verde de WhatsApp.
- No uses markdown de encabezados. Puedes usar guiones para listas cortas.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pregunta, contexto } = req.body || {};

  if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
    return res.status(400).json({ error: "Falta la pregunta" });
  }
  if (pregunta.length > 1000) {
    return res.status(400).json({ error: "Pregunta demasiado larga" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor" });
  }

  const prompt =
    SYSTEM_PROMPT +
    (contexto ? "\n\nESTADO ACTUAL DE LA OPERACIÓN\n" + String(contexto).slice(0, 4000) : "") +
    "\n\nPREGUNTA DEL USUARIO\n" + pregunta.trim();

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 400,
            topP: 0.9,
          },
        }),
      }
    );

    if (!r.ok) {
      const detalle = await r.text();
      console.error("Gemini respondió", r.status, detalle.slice(0, 300));
      return res.status(502).json({ error: "El modelo no está disponible" });
    }

    const dataG = await r.json();
    const texto = dataG?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      return res.status(502).json({ error: "El modelo no devolvió respuesta" });
    }

    return res.status(200).json({ respuesta: texto.trim(), fuente: "gemini" });
  } catch (e) {
    console.error("Error consultando Gemini:", e);
    return res.status(500).json({ error: "Error consultando el modelo" });
  }
}
