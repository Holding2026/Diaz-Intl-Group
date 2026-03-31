// ============================================================
// DÍAZ INTL GROUP — WhatsApp Bot con IA
// Vercel Serverless Function
// ============================================================

const SUPABASE_URL = 'https://wxxkqrapzyckcmssgdyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGtxcmFwenlja2Ntc3NnZHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDE4MjQsImV4cCI6MjA5MDIxNzgyNH0.UoHdwn-kBUuS8Jkv5IYp5LCAaUH5tyzo7Gq3eIdeAmo';
const ULTRAMSG_INSTANCE = 'instance168037';
const ULTRAMSG_TOKEN = '7b6klistnx4jz7gu';
const ANTHROPIC_KEY = 'sk-ant-api03-placeholder'; // Se configura en Vercel env vars

// Números autorizados
const AUTHORIZED = [
  '573152739169', // John
  '13053332473',  // Juan
  '573163610436', // Sergio
  '17864064364',  // Diego
];

// ── HELPERS ───────────────────────────────────────────────────
const fm = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fd = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  return res.json();
}

async function sendMsg(to, body) {
  await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: ULTRAMSG_TOKEN, to, body })
  });
}

// ── OBTENER DATOS DE SUPABASE ─────────────────────────────────
async function obtenerDatos(intencion, termino) {
  try {
    if (intencion === 'saldo' || intencion === 'resumen') {
      if (!termino) return null;
      const t = encodeURIComponent(termino.trim());
      const data = await query('vista_perfil_contrato',
        `?or=(inversionista.ilike.*${t}*,numero.ilike.*${t}*)`);
      return data && data.length ? data : null;
    }
    if (intencion === 'vencimientos') {
      const data = await query('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc&limit=10');
      return data && data.length ? data : null;
    }
    if (intencion === 'contratos') {
      const data = await query('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc');
      return data && data.length ? data : null;
    }
    if (intencion === 'kii') {
      if (!termino || termino === 'todos') {
        return await query('posiciones_kii', '?order=valor_inversion.desc&limit=10');
      }
      return await query('posiciones_kii', `?inversionista_nombre=ilike.*${encodeURIComponent(termino)}*`);
    }
    if (intencion === 'facturas' || intencion === 'cartera') {
      return await query('facturas_diaz', '?estado=in.(Abono,Pendiente)&order=fecha_factura.desc');
    }
    return null;
  } catch(e) {
    return null;
  }
}

// ── FORMATEAR RESPUESTA ───────────────────────────────────────
function formatearRespuesta(intencion, termino, datos) {
  if (!datos || !datos.length) {
    const busqueda = termino || 'el nombre indicado';
    return `❌ No encontré información para "*${busqueda}*".

Intente con el nombre exacto o número de contrato:
• T3, T8, T17...
• Caterine, Alejandro, Gisselle...`;
  }

  if (intencion === 'saldo' || intencion === 'resumen') {
    let resp = '';
    datos.slice(0, 3).forEach(c => {
      const dias = c.dias_al_vencimiento;
      const alerta = dias < 30 ? '🔴 VENCE PRONTO' : dias < 60 ? '🟡 Próximo' : '🟢 Al día';
      resp += `━━━━━━━━━━━━━━━━\n`;
      resp += `👤 *${c.inversionista}*\n`;
      resp += `📋 ${c.numero} · ${c.tipo_liquidacion}\n\n`;
      resp += `💰 *Financiero:*\n`;
      resp += `• Capital inicial: ${fm(c.valor_inicial)}\n`;
      resp += `• Saldo actual: *${fm(c.saldo_actual)}*\n`;
      resp += `• Crecimiento: ${(c.crecimiento_pct||0) >= 0 ? '📈' : '📉'} *${c.crecimiento_pct||0}%*\n`;
      resp += `• Rendimientos: ${fm(c.total_rendimientos)} (${c.rendimiento_total_pct||0}%)\n`;
      resp += `• Retiros: ${fm(c.total_retiros)}\n\n`;
      resp += `📅 *Vencimiento:*\n`;
      resp += `• ${fd(c.fecha_vencimiento)} · ${dias} días · ${alerta}\n\n`;
    });
    if (datos.length > 3) resp += `_...y ${datos.length - 3} contrato(s) más_`;
    return resp.trim();
  }

  if (intencion === 'vencimientos') {
    const urgentes = datos.filter(c => c.dias_al_vencimiento < 60);
    let resp = `📅 *Próximos vencimientos*\n\n`;
    urgentes.forEach(c => {
      const e = c.dias_al_vencimiento < 30 ? '🔴' : '🟡';
      resp += `${e} *${c.inversionista}* · ${c.numero}\n`;
      resp += `   ${fd(c.fecha_vencimiento)} · ${c.dias_al_vencimiento}d · ${fm(c.saldo_actual)}\n\n`;
    });
    const otros = datos.filter(c => c.dias_al_vencimiento >= 60 && c.dias_al_vencimiento < 180);
    if (otros.length) {
      resp += `📋 *Próximos 6 meses:*\n`;
      otros.forEach(c => resp += `🟢 ${c.inversionista} · ${c.numero} · ${c.dias_al_vencimiento}d\n`);
    }
    const total = datos.reduce((a, c) => a + (c.saldo_actual || 0), 0);
    resp += `\n💰 Capital total: *${fm(total)}*`;
    return resp;
  }

  if (intencion === 'contratos') {
    let resp = `📊 *Contratos Tycoon — ${datos.length} registros*\n\n`;
    datos.forEach(c => {
      const e = c.estado === 'On Hold' ? '⏸' : c.estado === 'Terminado' ? '🔴' : '🟢';
      resp += `${e} *${c.numero}* · ${c.inversionista} · ${fm(c.saldo_actual)}\n`;
    });
    const total = datos.reduce((a, c) => a + (c.saldo_actual || 0), 0);
    resp += `\n💰 *Total: ${fm(total)}*`;
    return resp;
  }

  if (intencion === 'kii') {
    if (!datos[0].inversionista_nombre) return '❌ Sin datos KII.';
    if (datos.length > 5) {
      const totalTok = datos.reduce((a, i) => a + (i.total_tokens || 0), 0);
      const totalInv = datos.reduce((a, i) => a + (i.valor_inversion || 0), 0);
      let resp = `⬡ *KII Exchange — ${datos.length} posiciones*\n\n`;
      resp += `💰 Total invertido: ${fm(totalInv)}\n`;
      resp += `🪙 Total tokens: ${Number(totalTok).toLocaleString()}\n`;
      resp += `💵 Valor @$0.02: *${fm(totalTok * 0.02)}*\n\n`;
      resp += `*Top posiciones:*\n`;
      datos.slice(0, 5).forEach(i => {
        resp += `• ${i.inversionista_nombre} (${i.contrato}) — ${Number(i.total_tokens || 0).toLocaleString()} tokens\n`;
      });
      return resp;
    }
    let resp = '';
    datos.forEach(i => {
      resp += `⬡ *${i.inversionista_nombre}* · ${i.contrato}\n`;
      resp += `📅 Desde: ${fd(i.fecha_inversion)}\n`;
      resp += `💰 Invertido: ${fm(i.valor_inversion)}\n`;
      resp += `🪙 KII Coins: ${Number(i.kii_coins).toLocaleString()}\n`;
      resp += `📈 Staking: ${Number(i.staking_acumulado || 0).toLocaleString()}\n`;
      resp += `🏦 Total tokens: *${Number(i.total_tokens || 0).toLocaleString()}*\n`;
      resp += `💵 Valor @$0.02: *${fm((i.total_tokens || 0) * 0.02)}*\n\n`;
    });
    return resp.trim();
  }

  if (intencion === 'facturas' || intencion === 'cartera') {
    let resp = `💼 *Cartera pendiente Díaz Intl*\n\n`;
    datos.forEach(f => {
      resp += `${f.estado === 'Abono' ? '🟡' : '🔴'} *${f.cliente_nombre}*\n`;
      resp += `   #${f.numero_factura} · ${f.moneda} ${fm(f.valor)} · ${fd(f.fecha_factura)}\n`;
      if (f.observaciones) resp += `   📝 ${f.observaciones}\n`;
      resp += '\n';
    });
    const usd = datos.filter(f => f.moneda === 'USD').reduce((a, f) => a + f.valor, 0);
    const eur = datos.filter(f => f.moneda === 'EUR').reduce((a, f) => a + f.valor, 0);
    if (usd > 0) resp += `💵 USD pendiente: *${fm(usd)}*\n`;
    if (eur > 0) resp += `💶 EUR pendiente: *${fm(eur)}*\n`;
    return resp.trim();
  }

  return '❌ No pude procesar la consulta.';
}

// ── IA: INTERPRETAR MENSAJE ───────────────────────────────────
async function interpretarConIA(mensaje) {
  const apiKey = process.env.ANTHROPIC_API_KEY || ANTHROPIC_KEY;

  const prompt = `Eres el asistente interno de Díaz International Group. 
Analiza este mensaje y extrae la intención y el término de búsqueda.

Responde SOLO con JSON, sin explicaciones:
{
  "intencion": "saldo|resumen|vencimientos|contratos|kii|facturas|cartera|ayuda|desconocido",
  "termino": "nombre del inversionista o número de contrato si aplica, sino null"
}

Intenciones posibles:
- "saldo" o "resumen": cuando preguntan por información de un inversionista específico
- "vencimientos": cuando preguntan por contratos que vencen pronto
- "contratos": cuando quieren ver todos los contratos
- "kii": cuando preguntan por tokens KII
- "facturas" o "cartera": cuando preguntan por facturas o cobros pendientes
- "ayuda": cuando saludan o piden ayuda
- "desconocido": si no encaja en ninguna categoría

Mensaje: "${mensaje}"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    // Si la IA no extrajo el término, usar fallback
    if (!result.termino && result.intencion === 'resumen') {
      const fallback = detectarPorKeywords(mensaje);
      result.termino = fallback.termino;
    }
    return result;
  } catch(e) {
    // Fallback: detección por palabras clave
    return detectarPorKeywords(mensaje);
  }
}

// ── FALLBACK SIN IA ───────────────────────────────────────────
const STOP_WORDS = new Set([
  'necesito','saber','quiero','ver','dame','dime','muestra','muestrame',
  'cual','cuanto','cuantos','como','que','del','los','las','una','uno',
  'con','por','para','hay','esta','este','pero','mas','sin','muy',
  'saldo','resumen','historial','informacion','información','completo',
  'inversionista','contrato','contratos','tycoon','kii','diaz',
  'de','el','la','en','al','su','sus','tiene','tiene','queda',
  'devolverle','pendiente','pronto','vence','vencen','cobrar'
]);

function extraerNombre(texto) {
  // Buscar patrones de nombre después de palabras clave
  const patrones = [
    /(?:de|del|al|inversionista|saldo|resumen|historial)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i,
    /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/,
  ];
  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match && match[1]) {
      const nombre = match[1].trim();
      // Verificar que no sea una stop word
      if (!STOP_WORDS.has(nombre.toLowerCase()) && nombre.length > 3) {
        return nombre;
      }
    }
  }
  // Último recurso: palabras que parecen nombres propios
  const palabras = texto.split(/\s+/).filter(w => 
    w.length > 3 && 
    /^[A-ZÁÉÍÓÚÑ]/.test(w) && 
    !STOP_WORDS.has(w.toLowerCase())
  );
  return palabras.slice(0, 3).join(' ') || null;
}

function detectarPorKeywords(msg) {
  const m = msg.toLowerCase();
  
  if (m.includes('vencimiento') || m.includes('vence') || m.includes('próximo') || m.includes('proximo')) 
    return { intencion: 'vencimientos', termino: null };
  
  if (m.includes('factura') || m.includes('cartera') || m.includes('cobrar')) 
    return { intencion: 'facturas', termino: null };
  
  if (m.includes('kii') || m.includes('token')) 
    return { intencion: 'kii', termino: extraerNombre(msg) };
  
  if ((m.includes('todos') || m.includes('lista')) && m.includes('contrato')) 
    return { intencion: 'contratos', termino: null };
  
  const contractMatch = msg.match(/T\d+/i);
  if (contractMatch) 
    return { intencion: 'resumen', termino: contractMatch[0].toUpperCase() };
  
  if (m.includes('hola') || m.includes('ayuda') || m.includes('menu') || m === 'hola') 
    return { intencion: 'ayuda', termino: null };

  // Cualquier mensaje con nombre propio = consulta de inversionista
  const nombre = extraerNombre(msg);
  if (nombre) return { intencion: 'resumen', termino: nombre };
  
  return { intencion: 'desconocido', termino: null };
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot Díaz Intl activo ✅' });
  }

  try {
    const body = req.body;
    const from = body.data?.from || body.from || '';
    const text = (body.data?.body || body.body || '').trim();
    const type = body.data?.type || body.type || '';

    if (type !== 'chat' && type !== 'text') return res.status(200).json({ status: 'ignored' });
    if (body.data?.fromMe) return res.status(200).json({ status: 'own' });
    if (!text) return res.status(200).json({ status: 'empty' });

    // Log del número para diagnóstico
    console.log(`Mensaje de: ${from} | Texto: ${text}`);
    // Auth temporalmente desactivada para diagnóstico

    // Respuesta de ayuda
    if (/^(hola|ayuda|menu|menú|help|start|inicio)$/i.test(text.trim())) {
      await sendMsg(from, `🏢 *Díaz Intl Group*\n\nHola! Puedes preguntarme en lenguaje natural. Por ejemplo:\n\n• _"¿Cuánto tiene Caterine Ibarguen?"_\n• _"¿Qué contratos vencen pronto?"_\n• _"Muéstrame la posición KII de Alejandro"_\n• _"¿Qué facturas están pendientes?"_\n• _"Resumen de todos los contratos"_\n\n🚀 Solo escríbeme como le escribirías a un compañero.`);
      return res.status(200).json({ status: 'ok' });
    }

    // Interpretar con IA
    let { intencion, termino } = await interpretarConIA(text);
    
    // Si termino es undefined/null y hay intencion de resumen, intentar extraer nombre directamente
    if ((intencion === 'resumen' || intencion === 'saldo') && !termino) {
      termino = extraerNombre(text);
    }
    
    console.log(`From: ${from} | Intención: ${intencion} | Término: ${termino} | Texto: ${text}`);

    if (intencion === 'desconocido') {
      await sendMsg(from, `🤖 No entendí bien la consulta. Puedes preguntarme por:\n• Saldo de un inversionista\n• Vencimientos próximos\n• Posiciones KII\n• Cartera Díaz Intl\n\nEscribe *ayuda* para ver ejemplos.`);
      return res.status(200).json({ status: 'ok' });
    }

    if (intencion === 'ayuda') {
      await sendMsg(from, `🏢 *Díaz Intl Group*\n\nPuedes preguntarme en lenguaje natural:\n\n• _"¿Cuánto tiene Caterine?"_\n• _"¿Qué contratos vencen pronto?"_\n• _"KII de Alejandro Hoyos"_\n• _"Facturas pendientes"_\n• _"Resumen Juan Nicolás"_`);
      return res.status(200).json({ status: 'ok' });
    }

    // Obtener datos y formatear respuesta
    const datos = await obtenerDatos(intencion, termino);
    const respuesta = formatearRespuesta(intencion, termino, datos);
    await sendMsg(from, respuesta);

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ status: 'error' });
  }
}
