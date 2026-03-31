// DIAZ INTL GROUP - WhatsApp Bot
const SUPABASE_URL = 'https://flmfgrgnmigdwdnrzgkw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWZncmdubWlnZHdkbnJ6Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODU3MzUsImV4cCI6MjA5MDU2MTczNX0.xCXujNCVTc7D7S6J8qK3qM-2ROv0n6JADT9qTN9PBlI';
const ULTRAMSG_INSTANCE = 'instance168037';
const ULTRAMSG_TOKEN = '7b6klistnx4jz7gu';

const fm = function(n) { return n == null ? '--' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };
const fd = function(s) { return s ? new Date(s+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '--'; };
const nl = '\n';

async function db(table, params) {
  params = params || '';
  var r = await fetch(SUPABASE_URL + '/rest/v1/' + table + params, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  });
  return r.json();
}

async function send(to, body) {
  await fetch('https://api.ultramsg.com/' + ULTRAMSG_INSTANCE + '/messages/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({token: ULTRAMSG_TOKEN, to: to, body: body})
  });
}

function limpiarNombre(texto) {
  var stopwords = 'necesito saber quiero ver dame dime muestra cual cuanto como que del los las una uno con por para hay esta este pero mas sin muy saldo resumen historial informacion completo inversionista contrato tycoon kii diaz de el la en al su sus tiene queda devolverle pendiente pronto vence vencen cobrar me le fue ultimo reporte informe datos estado situacion portafolio inversion dinero plata capital cuenta balance nueva nuevo reciente'.split(' ');
  var palabras = texto.split(/\s+/).filter(function(w) {
    return w.length > 1 && stopwords.indexOf(w.toLowerCase()) === -1;
  });
  return palabras.slice(-3).join(' ').trim() || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({status:'Bot activo OK'});
  }

  try {
    var body = req.body;
    var from = (body.data && body.data.from) || body.from || '';
    var text = ((body.data && body.data.body) || body.body || '').trim();
    var type = (body.data && body.data.type) || body.type || '';
    var fromMe = body.data && body.data.fromMe;

    if (type !== 'chat' && type !== 'text') return res.status(200).json({status:'ignored'});
    if (fromMe) return res.status(200).json({status:'own'});
    if (!text) return res.status(200).json({status:'empty'});

    console.log('MSG from ' + from + ': ' + text);
    var m = text.toLowerCase().trim();

    // AYUDA
    if (/^(hola|ayuda|menu|help|inicio|start)$/.test(m)) {
      await send(from, 'Diaz Intl Group' + nl + nl + 'Escribe el nombre de un inversionista para ver su resumen.' + nl + nl + 'Ejemplos:' + nl + '- caterine' + nl + '- alejandro hoyos' + nl + '- T8' + nl + '- vencimientos' + nl + '- kii todos' + nl + '- facturas');
      return res.status(200).json({status:'ok'});
    }

    // VENCIMIENTOS
    if (m.indexOf('vencimiento') >= 0 || m.indexOf('vence') >= 0 || m.indexOf('proximo') >= 0) {
      var data = await db('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc&limit=15');
      if (!Array.isArray(data) || !data.length) { await send(from, 'Sin datos de vencimientos.'); return res.status(200).json({status:'ok'}); }
      var urg = data.filter(function(c){ return c.dias_al_vencimiento < 60; });
      var resp = 'PROXIMOS VENCIMIENTOS' + nl + nl;
      urg.forEach(function(c) {
        var e = c.dias_al_vencimiento < 30 ? '[!!!]' : '[!]';
        resp += e + ' ' + c.inversionista + ' - ' + c.numero + nl;
        resp += '   ' + fd(c.fecha_vencimiento) + ' - ' + c.dias_al_vencimiento + 'd - ' + fm(c.saldo_actual) + nl + nl;
      });
      var otros = data.filter(function(c){ return c.dias_al_vencimiento >= 60 && c.dias_al_vencimiento < 180; });
      if (otros.length) {
        resp += 'Proximos 6 meses:' + nl;
        otros.forEach(function(c){ resp += '[OK] ' + c.inversionista + ' - ' + c.numero + ' - ' + c.dias_al_vencimiento + 'd' + nl; });
      }
      var total = data.reduce(function(a,c){ return a + (c.saldo_actual||0); }, 0);
      resp += nl + 'Capital total: ' + fm(total);
      await send(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // CONTRATOS
    if (m === 'contratos' || m === 'todos los contratos') {
      var data = await db('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc');
      var resp = 'CONTRATOS TYCOON (' + data.length + ')' + nl + nl;
      data.forEach(function(c){
        var e = c.estado === 'On Hold' ? '[HOLD]' : c.estado === 'Terminado' ? '[FIN]' : '[OK]';
        resp += e + ' ' + c.numero + ' - ' + c.inversionista + ' - ' + fm(c.saldo_actual) + ' - ' + c.dias_al_vencimiento + 'd' + nl;
      });
      var total = data.reduce(function(a,c){ return a+(c.saldo_actual||0); },0);
      resp += nl + 'Total: ' + fm(total);
      await send(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // FACTURAS
    if (m.indexOf('factura') >= 0 || m.indexOf('cartera') >= 0 || m.indexOf('cobrar') >= 0) {
      var data = await db('facturas_diaz', '?estado=in.(Abono,Pendiente)&order=fecha_factura.desc');
      if (!Array.isArray(data) || !data.length) { await send(from, 'Sin cartera pendiente.'); return res.status(200).json({status:'ok'}); }
      var resp = 'CARTERA PENDIENTE DIAZ INTL' + nl + nl;
      data.forEach(function(f){
        resp += (f.estado === 'Abono' ? '[!]' : '[!!!]') + ' ' + f.cliente_nombre + nl;
        resp += '   #' + f.numero_factura + ' - ' + f.moneda + ' ' + fm(f.valor) + ' - ' + fd(f.fecha_factura) + nl;
        if (f.observaciones) resp += '   Nota: ' + f.observaciones + nl;
        resp += nl;
      });
      var usd = data.filter(function(f){ return f.moneda==='USD'; }).reduce(function(a,f){ return a+f.valor; },0);
      var eur = data.filter(function(f){ return f.moneda==='EUR'; }).reduce(function(a,f){ return a+f.valor; },0);
      if (usd > 0) resp += 'USD pendiente: ' + fm(usd) + nl;
      if (eur > 0) resp += 'EUR pendiente: ' + fm(eur) + nl;
      await send(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // KII TODOS
    if (m === 'kii' || m === 'kii todos' || m === 'kii total') {
      var data = await db('posiciones_kii', '?order=valor_inversion.desc');
      if (!Array.isArray(data) || !data.length) { await send(from, 'Sin datos KII.'); return res.status(200).json({status:'ok'}); }
      var tt = data.reduce(function(a,i){ return a+(i.total_tokens||0); },0);
      var ti = data.reduce(function(a,i){ return a+(i.valor_inversion||0); },0);
      var resp = 'KII EXCHANGE (' + data.length + ' posiciones)' + nl + nl;
      resp += 'Total invertido: ' + fm(ti) + nl;
      resp += 'Total tokens: ' + Number(tt).toLocaleString() + nl;
      resp += 'Valor @$0.02: ' + fm(tt*0.02) + nl + nl;
      resp += 'Top 5:' + nl;
      data.slice(0,5).forEach(function(i){ resp += '- ' + i.inversionista_nombre + ' (' + i.contrato + ') - ' + Number(i.total_tokens||0).toLocaleString() + nl; });
      await send(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // ULTIMO REPORTE
    if (m.indexOf('ultimo') >= 0 || m.indexOf('reporte') >= 0 || m.indexOf('memo') >= 0 || m.indexOf('liquidacion') >= 0) {
      var nombreRep = limpiarNombre(text);
      if (nombreRep && nombreRep.length >= 3) {
        var t = encodeURIComponent(nombreRep);
        var contratos = await db('contratos_tycoon', '?nombre_inversionista=ilike.*' + t + '*&select=id,numero,nombre_inversionista,saldo_actual');
        if (Array.isArray(contratos) && contratos.length) {
          var resp = 'ULTIMO CORTE - ' + contratos[0].nombre_inversionista + nl + nl;
          for (var ci = 0; ci < Math.min(contratos.length, 3); ci++) {
            var c = contratos[ci];
            var movs = await db('movimientos', '?contrato_id=eq.' + c.id + '&tipo=eq.corte_rendimiento&order=fecha.desc&limit=1');
            if (Array.isArray(movs) && movs.length) {
              var mv = movs[0];
              var pct = mv.porcentaje ? (mv.porcentaje*100).toFixed(2) + '%' : '--';
              resp += 'Contrato: ' + c.numero + nl;
              resp += '----------------' + nl;
              resp += 'Fecha: ' + fd(mv.fecha) + nl;
              resp += 'Memo: ' + (mv.numero_memo||'--') + nl;
              resp += 'Capital base: ' + fm(mv.capital_base) + nl;
              resp += '% Periodo: ' + pct + nl;
              resp += 'Rendimiento: ' + fm(mv.valor_rendimiento) + nl;
              resp += 'Reinversion: ' + fm(mv.valor_reinversion) + nl;
              resp += 'Saldo resultado: ' + fm(mv.saldo_resultado) + nl;
              if (mv.anotaciones) resp += 'Nota: ' + mv.anotaciones + nl;
              resp += 'Saldo actual: ' + fm(c.saldo_actual) + nl + nl;
            } else {
              resp += 'Contrato ' + c.numero + ': Sin cortes registrados' + nl + nl;
            }
          }
          await send(from, resp.trim());
        } else {
          await send(from, 'No encontre contratos para "' + nombreRep + '".');
        }
        return res.status(200).json({status:'ok'});
      }
    }

    // KII POR NOMBRE
    if (m.indexOf('kii ') === 0) {
      var nombreKii = limpiarNombre(text.replace(/^kii\s+/i,''));
      if (nombreKii) {
        var kiiData = await db('posiciones_kii', '?inversionista_nombre=ilike.*' + encodeURIComponent(nombreKii) + '*');
        if (Array.isArray(kiiData) && kiiData.length) {
          var resp = 'KII EXCHANGE' + nl + '----------------' + nl;
          kiiData.forEach(function(i) {
            resp += i.inversionista_nombre + ' - ' + i.contrato + nl;
            resp += 'Desde: ' + fd(i.fecha_inversion) + nl;
            resp += 'Invertido: ' + fm(i.valor_inversion) + nl;
            resp += 'KII Coins: ' + Number(i.kii_coins||0).toLocaleString() + nl;
            resp += 'Staking: ' + Number(i.staking_acumulado||0).toLocaleString() + nl;
            resp += 'Total tokens: ' + Number(i.total_tokens||0).toLocaleString() + nl;
            resp += 'Valor @$0.02: ' + fm((i.total_tokens||0)*0.02) + nl + nl;
          });
          await send(from, resp.trim());
        } else {
          await send(from, 'No encontre posicion KII para "' + nombreKii + '".');
        }
        return res.status(200).json({status:'ok'});
      }
    }

    // BUSQUEDA POR NOMBRE - Tycoon + KII
    var nombre = limpiarNombre(text);
    if (nombre && nombre.length >= 3) {
      var t = encodeURIComponent(nombre);
      var results = await Promise.all([
        db('vista_perfil_contrato', '?or=(inversionista.ilike.*' + t + '*,numero.ilike.*' + t + '*)'),
        db('posiciones_kii', '?inversionista_nombre=ilike.*' + t + '*')
      ]);
      var ty = Array.isArray(results[0]) ? results[0] : [];
      var ki = Array.isArray(results[1]) ? results[1] : [];

      if (!ty.length && !ki.length) {
        await send(from, 'No encontre a "' + nombre + '".' + nl + 'Intente con el nombre exacto o numero de contrato (T8, T17, TK7...)');
        return res.status(200).json({status:'ok'});
      }

      var resp = '';

      if (ty.length) {
        ty.slice(0,3).forEach(function(c) {
          var dias = c.dias_al_vencimiento;
          var alerta = dias < 30 ? '[!!! VENCE PRONTO]' : dias < 60 ? '[! Proximo]' : '[OK Al dia]';
          resp += 'TYCOON' + nl;
          resp += '----------------' + nl;
          resp += c.inversionista + nl;
          resp += 'Contrato: ' + c.numero + ' - ' + c.tipo_liquidacion + nl + nl;
          resp += 'Capital inicial: ' + fm(c.valor_inicial) + nl;
          resp += 'Saldo actual: ' + fm(c.saldo_actual) + nl;
          resp += 'Crecimiento: ' + (c.crecimiento_pct||0) + '%' + nl;
          resp += 'Rendimientos: ' + fm(c.total_rendimientos) + ' (' + (c.rendimiento_total_pct||0) + '%)' + nl;
          resp += 'Retiros: ' + fm(c.total_retiros) + nl + nl;
          resp += 'Vencimiento: ' + fd(c.fecha_vencimiento) + ' - ' + dias + 'd' + nl;
          resp += alerta + nl + nl;
        });
      }

      if (ki.length) {
        resp += 'KII EXCHANGE' + nl;
        resp += '----------------' + nl;
        ki.forEach(function(i) {
          resp += i.contrato + ' - Desde: ' + fd(i.fecha_inversion) + nl;
          resp += 'Invertido: ' + fm(i.valor_inversion) + nl;
          resp += 'KII Coins: ' + Number(i.kii_coins||0).toLocaleString() + nl;
          resp += 'Staking: ' + Number(i.staking_acumulado||0).toLocaleString() + nl;
          resp += 'Total tokens: ' + Number(i.total_tokens||0).toLocaleString() + nl;
          resp += 'Valor @$0.02: ' + fm((i.total_tokens||0)*0.02) + nl + nl;
        });
      }

      await send(from, resp.trim());
      return res.status(200).json({status:'ok'});
    }

    // No entendido
    await send(from, 'Escribe el nombre de un inversionista o un comando:' + nl + '- vencimientos' + nl + '- contratos' + nl + '- facturas' + nl + '- kii todos' + nl + '- ayuda');
    return res.status(200).json({status:'ok'});

  } catch(e) {
    console.error(e);
    return res.status(200).json({status:'error', msg: e.message});
  }
};
