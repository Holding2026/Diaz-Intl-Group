// api/ai.js — Proxy Groq API v6

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'ERROR: GROQ_API_KEY no configurada en Vercel.' });

  try {
    var body = req.body || {};
    var query = body.query || '';
    var context = body.context || {};

    if (!query) return res.status(400).json({ error: 'Se requiere query' });

    var hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    var systemPrompt = 'Eres un asistente financiero ejecutivo para el Holding Diaz Intl Group. '
      + 'Responde en espanol, de forma ejecutiva y bien estructurada. '
      + 'IMPORTANTE: Cuando el usuario pida un cuadro, tabla o comparativo, USA SIEMPRE formato de tabla Markdown con pipes | y guiones ---. '
      + 'Usa ## para titulos de seccion, **negrita** para datos importantes, y - para listas. '
      + 'Hoy es ' + hoy + '.\n\n'
      + '=== TYCOON - FONDO DE INVERSIONES ===\n' + (context.tycoon || 'Sin datos.') + '\n\n'
      + '=== DIAZ INTERNATIONAL - FACTURACION ===\n' + (context.diaz || 'Sin datos.') + '\n\n'
      + '=== KII EXCHANGE ===\n' + (context.kii || 'Sin datos.');

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      })
    });

    var rawText = await response.text();

    if (!response.ok) {
      return res.status(200).json({ reply: 'ERROR ' + response.status + ': ' + rawText });
    }

    var data = JSON.parse(rawText);
    var reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : 'Sin respuesta.';

    return res.status(200).json({ reply: reply });

  } catch (error) {
    return res.status(200).json({ reply: 'CATCH: ' + error.message });
  }
};
