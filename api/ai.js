// v3// api/ai.js — Proxy serverless para Groq API

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: '⚠ GROQ_API_KEY no configurada en Vercel → Settings → Environment Variables.' });

  try {
    const { query, context } = req.body || {};
    if (!query) return res.status(400).json({ error: 'Se requiere query' });

    const hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const systemPrompt = `Eres un asistente financiero ejecutivo para el Holding Díaz Intl Group. Responde en español, conciso y ejecutivo. Usa emojis cuando ayude. Hoy es ${hoy}.

=== TYCOON - FONDO DE INVERSIONES ===
${context?.tycoon || 'Sin datos.'}

=== DÍAZ INTERNATIONAL - FACTURACIÓN ===
${context?.diaz || 'Sin datos.'}

=== KII EXCHANGE ===
${context?.kii || 'Sin datos.'}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(200).json({ reply: `⚠ Error ${response.status}: ${rawText}` });
    }

    const data = JSON.parse(rawText);
    const reply = data.choices?.[0]?.message?.content || 'Sin respuesta.';
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(200).json({ reply: '⚠ Error: ' + error.message });
  }
};
