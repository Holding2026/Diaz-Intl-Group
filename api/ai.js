// api/ai.js — Proxy Groq + Supabase v8

var SB_URL = 'https://flmfgrgnmigdwdnrzgkw.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWZncmdubWlnZHdkbnJ6Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODU3MzUsImV4cCI6MjA5MDU2MTczNX0.xCXujNCVTc7D7S6J8qK3qM-2ROv0n6JADT9qTN9PBlI';

async function sbGet(path) {
  var r = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
  });
  return r.json();
}

function fm(n) { return n == null ? '--' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fd(s) { return s ? new Date(s+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '--'; }
function pct(n) { return n == null ? '--' : Number(n).toFixed(2) + '%'; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'ERROR: GROQ_API_KEY no configurada.' });

  try {
    var body = req.body || {};
    var query = body.query || '';
    if (!query) return res.status(400).json({ error: 'Se requiere query' });

    var hoy = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // ── Consultar Supabase en paralelo ──
    var [contratos, movimientos, contratosBase, posicionesKII, facturas, perfiles] = await Promise.all([
      sbGet('vista_contratos_vencimiento?select=*&order=inversionista.asc'),
      sbGet('movimientos?select=*&order=fecha.asc'),
      sbGet('contratos_tycoon?select=id,numero&order=numero.asc'),
      sbGet('posiciones_kii?select=*&order=valor_inversion.desc'),
      sbGet('vista_cartera_diaz?select=*&order=fecha_factura.desc'),
      sbGet('vista_perfil_contrato?select=*')
    ]);

    // Mapa numero -> id
    var contratoIdMap = {};
    if (Array.isArray(contratosBase)) {
      contratosBase.forEach(function(c) { contratoIdMap[c.numero] = c.id; });
    }

    // ── TYCOON context ──
    var totalSaldo = contratos.reduce(function(a,c){return a+(c.saldo_actual||0);},0);
    var totalInicial = contratos.reduce(function(a,c){return a+(c.valor_inicial||0);},0);
    var crecGlobal = totalInicial > 0 ? (((totalSaldo-totalInicial)/totalInicial)*100).toFixed(2) : 0;

    var tycoonCtx = '## TYCOON - FONDO DE INVERSIONES\n';
    tycoonCtx += 'Contratos: ' + contratos.length + ' | Capital inicial total: ' + fm(totalInicial) + ' | Capital gestionado: ' + fm(totalSaldo) + ' | Crecimiento global: ' + crecGlobal + '%\n\n';

    contratos.forEach(function(c) {
      var cid = contratoIdMap[c.numero];
      var perfil = Array.isArray(perfiles) ? perfiles.find(function(p){return p.numero===c.numero;}) : null;
      var movsCon = cid ? movimientos.filter(function(m){return m.contrato_id === cid;}) : [];
      var cortes = movsCon.filter(function(m){return m.tipo==='corte_rendimiento';});
      var retiros = movsCon.filter(function(m){return m.tipo==='retiro_capital';});
      var capNuevo = movsCon.filter(function(m){return m.tipo==='capital_nuevo';});

      var totalRend = cortes.reduce(function(a,m){return a+(m.valor_rendimiento||0);},0);
      var totalReinv = cortes.reduce(function(a,m){return a+(m.valor_reinversion||0);},0);
      var totalRetiros = retiros.reduce(function(a,m){return a+(Math.abs(m.pago_capital_mov||0));},0);
      var totalCapNuevo = capNuevo.reduce(function(a,m){return a+(m.capital_base||0);},0);
      var pctProm = cortes.length > 0 ? (cortes.reduce(function(a,m){return a+(m.porcentaje||0);},0)/cortes.length*100).toFixed(3) : 0;
      var crecPct = perfil ? (perfil.crecimiento_pct||0) : 0;
      var vd = c.fecha_vencimiento || c.proximo_vencimiento;

      tycoonCtx += '### ' + c.inversionista + ' - Contrato ' + c.numero + '\n';
      tycoonCtx += 'Capital inicial: ' + fm(c.valor_inicial) + ' | Saldo actual: ' + fm(c.saldo_actual) + ' | Crecimiento: ' + pct(crecPct) + '\n';
      tycoonCtx += 'Tipo liquidacion: ' + (c.tipo_liquidacion||'—') + ' | Fecha inicio: ' + fd(c.fecha_inicio) + ' | Vence: ' + fd(vd) + ' (' + c.dias_al_vencimiento + 'd) | Estado: ' + (c.estado||'Activo') + '\n';
      tycoonCtx += 'Total rendimientos generados: ' + fm(totalRend) + ' | Total reinvertido: ' + fm(totalReinv) + ' | Total retirado: ' + fm(totalRetiros) + '\n';
      tycoonCtx += 'Capital adicional ingresado: ' + fm(totalCapNuevo) + ' | % promedio por periodo: ' + pctProm + '% | Cortes realizados: ' + cortes.length + '\n';

      if (movsCon.length > 0) {
        tycoonCtx += 'MEMOS (' + movsCon.length + ' movimientos):\n';
        movsCon.forEach(function(m) {
          var tipo = m.tipo==='corte_rendimiento'?'CORTE':m.tipo==='retiro_capital'?'RETIRO':m.tipo==='capital_nuevo'?'CAPITAL_NUEVO':'AJUSTE';
          tycoonCtx += '  [' + (m.numero_memo||'S/N') + '] ' + fd(m.fecha) + ' ' + tipo;
          if (m.capital_base) tycoonCtx += ' | Base: ' + fm(m.capital_base);
          if (m.porcentaje) tycoonCtx += ' | ' + (m.porcentaje*100).toFixed(3) + '%';
          if (m.valor_rendimiento) tycoonCtx += ' | Rend: ' + fm(m.valor_rendimiento);
          if (m.valor_reinversion) tycoonCtx += ' | Reinv: ' + fm(m.valor_reinversion);
          if (m.pago_capital_mov) tycoonCtx += ' | Pago: ' + fm(m.pago_capital_mov);
          if (m.saldo_resultado) tycoonCtx += ' | Saldo: ' + fm(m.saldo_resultado);
          if (m.anotaciones) tycoonCtx += ' | "' + m.anotaciones + '"';
          tycoonCtx += '\n';
        });
      } else {
        tycoonCtx += 'Sin movimientos registrados.\n';
      }
      tycoonCtx += '\n';
    });

    // ── DÍAZ context ──
    var pendUSD = facturas.filter(function(f){return f.moneda==='USD'&&(f.saldo_pendiente||0)>0&&!['Pagada','Anulada','Castigo'].includes(f.estado);}).reduce(function(a,f){return a+(f.saldo_pendiente||0);},0);
    var fact2026 = facturas.filter(function(f){return f.año===2026;}).reduce(function(a,f){return a+(f.valor_factura||f.valor||0);},0);
    var fact2025 = facturas.filter(function(f){return f.año===2025;}).reduce(function(a,f){return a+(f.valor_factura||f.valor||0);},0);

    var diazCtx = '## DIAZ INTERNATIONAL\n';
    diazCtx += 'Facturas: ' + facturas.length + ' | 2026: ' + fm(fact2026) + ' | 2025: ' + fm(fact2025) + ' | Cartera pendiente USD: ' + fm(pendUSD) + '\n\n';
    var pendientes = facturas.filter(function(f){return ['Pendiente','Abono'].includes(f.estado);});
    pendientes.forEach(function(f) {
      var dias = Math.floor((new Date()-new Date(f.fecha_factura+'T12:00:00'))/(1000*60*60*24));
      diazCtx += '- #' + f.numero_factura + ' ' + f.cliente_nombre + ': ' + fm(f.valor_factura||f.valor) + ' ' + f.moneda + ' | Saldo: ' + fm(f.saldo_pendiente) + ' | ' + dias + 'd cartera | ' + f.estado + (f.fecha_pago_programado?' | Prog: '+fd(f.fecha_pago_programado):'') + '\n';
    });

    // ── KII context ──
    var totalInvKII = posicionesKII.reduce(function(a,i){return a+(i.valor_inversion||0);},0);
    var totalTok = posicionesKII.reduce(function(a,i){return a+(i.total_tokens||0);},0);
    var kiiCtx = '## KII EXCHANGE\n';
    kiiCtx += 'Posiciones: ' + posicionesKII.length + ' | Invertido: ' + fm(totalInvKII) + ' | Tokens: ' + totalTok.toLocaleString() + ' | Valor @$0.02: ' + fm(totalTok*0.02) + '\n\n';
    posicionesKII.forEach(function(i) {
      var sp = i.kii_coins > 0 ? ((i.staking_acumulado/i.kii_coins)*100).toFixed(1) : 0;
      kiiCtx += '- ' + i.inversionista_nombre + ' (' + i.contrato + '): Inv ' + fm(i.valor_inversion) + ' | Coins: ' + (i.kii_coins||0).toLocaleString() + ' | Staking: ' + (i.staking_acumulado||0).toLocaleString() + ' (' + sp + '%) | Total: ' + (i.total_tokens||0).toLocaleString() + ' | Valor: ' + fm((i.total_tokens||0)*0.02) + '\n';
    });

    var systemPrompt = 'Eres el analista financiero senior del Holding Diaz Intl Group. '
      + 'Tienes acceso a TODOS los datos en tiempo real: contratos, memos, movimientos, rendimientos, KII y facturacion. '
      + 'REGLAS DE RESPUESTA:\n'
      + '1. Estructura SIEMPRE el informe con secciones claras usando ## y ###\n'
      + '2. Usa tablas Markdown (| col | col |) para comparativos y resumenes numericos\n'
      + '3. Menciona SIEMPRE los numeros de memo relevantes con sus fechas y cifras\n'
      + '4. Calcula e incluye: rendimiento acumulado, % crecimiento, promedio por periodo\n'
      + '5. Agrega seccion de ALERTAS si hay vencimientos proximos, saldos negativos o anomalias\n'
      + '6. Termina con RECOMENDACIONES concretas y accionables\n'
      + '7. USA negrita (**) para todos los numeros importantes\n'
      + '8. Responde en espanol ejecutivo. Hoy: ' + hoy + '\n\n'
      + tycoonCtx + '\n' + diazCtx + '\n' + kiiCtx;

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      })
    });

    var rawText = await response.text();
    if (!response.ok) return res.status(200).json({ reply: 'ERROR ' + response.status + ': ' + rawText });
    var data = JSON.parse(rawText);
    var reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : 'Sin respuesta.';
    return res.status(200).json({ reply: reply });

  } catch (error) {
    return res.status(200).json({ reply: 'CATCH: ' + error.message });
  }
};
