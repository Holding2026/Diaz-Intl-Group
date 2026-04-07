// api/ai.js — Proxy serverless para Anthropic API

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Debug: reportar estado de la key sin exponerla
  if (!apiKey) {
    return res.status(500).json({ error: 'KEY_MISSING: ANTHROPIC_API_KEY no está definida en este entorno de Vercel.' });
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ error: 'KEY_INVALID: La key no tiene el formato correcto (debe empezar con sk-ant-)' });
  }

  try {
    const { query, context } = req.body || {};
    if (!query) return res.status(400).json({ error: 'Se requiere el campo query' });

    const hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const systemPrompt = `Eres un asistente financiero ejecutivo para el Holding Díaz Intl Group. Tienes acceso a datos en tiempo real de tres unidades de negocio. Responde en español, de forma concisa y ejecutiva. Usa formato claro con emojis cuando ayude. Cifras en USD salvo indicación. Hoy es ${hoy}.

=== TYCOON - FONDO DE INVERSIONES ===
${context?.tycoon || 'Sin datos.'}

=== DÍAZ INTERNATIONAL - FACTURACIÓN ===
${context?.diaz || 'Sin datos.'}

=== KII EXCHANGE ===
${context?.kii || 'Sin datos.'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: `ANTHROPIC_ERROR ${response.status}: ${data.error?.message || JSON.stringify(data.error)}`
      });
    }

    const reply = data.content?.[0]?.text || 'Sin respuesta.';
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: 'CATCH: ' + error.message });
  }
};
