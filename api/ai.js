// api/ai.js — Proxy serverless para Anthropic API
// Vercel Function: recibe consultas del frontend y llama a Claude con contexto financiero

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  // CORS headers — permite llamadas desde el frontend
  res.setHeader('Access-Control-Allow-Origin', 'https://diaz-intl-app.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key no configurada en variables de entorno de Vercel' });
  }

  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Se requiere el campo query' });
    }

    const systemPrompt = `Eres un asistente financiero ejecutivo para el Holding Díaz Intl Group. Tienes acceso a datos en tiempo real de tres unidades de negocio. Responde en español, de forma concisa y ejecutiva. Usa formato claro con emojis cuando ayude a la legibilidad. Cifras en USD a menos que se indique. Sé directo y preciso. Hoy es ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

=== TYCOON - FONDO DE INVERSIONES ===
${context?.tycoon || 'Sin datos Tycoon disponibles.'}

=== DÍAZ INTERNATIONAL - FACTURACIÓN ===
${context?.diaz || 'Sin datos Díaz disponibles.'}

=== KII EXCHANGE - POSICIONES ===
${context?.kii || 'Sin datos KII disponibles.'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'Error al contactar Anthropic API' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sin respuesta del modelo.';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error en proxy IA:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
