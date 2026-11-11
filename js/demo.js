/* js/demo.js — Backend de demostración: la misma API que backend/Codigo.gs (con el cierre del reporte y una miniatura
   por cada foto), guardado en localStorage. Solo se usa si CONFIG.BACKEND_URL
   está vacío. Instituciones, personas, registros y fotos son de ejemplo: las fotos son escenas dibujadas en el navegador. */
window.DEMO = (function () {
  const LLAVE = 'ev25n_demo3';
  const USUARIOS = [{ correo: 'coordinacion@ejemplo.gov.co', nombre: 'USUARIA DE EJEMPLO', cargo: 'Profesional de convivencia escolar (ejemplo)' }];
  const nombres = () => window.CONFIG.ACTIVIDADES.map(a => a.nombre);
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  let ultimoCodigo = '', _otp = {};

  let _inst = null;
  function instituciones() {
    if (_inst) return _inst;
    _inst = [];
    ((window.MAPA && window.MAPA.munis) || []).filter(m => m.code !== '17001').forEach(m => {
      const k = 2 + (Number(m.code) % 4);
      for (let i = 1; i <= k; i++) {
        const sedes = 1 + ((Number(m.code) + i * 7) % 9);
        _inst.push({ dane_ie: '2' + m.code + '900' + String(i).padStart(3, '0'),
          institucion: `INSTITUCIÓN EDUCATIVA DE EJEMPLO ${sinTilde(m.name).toUpperCase()} ${i}`,
          municipio: sinTilde(m.name).toUpperCase(), num_sedes: sedes, matricula: 90 * sedes + ((Number(m.code) * i) % 260), sector: 'OFICIAL' });
      }
      // No oficiales de ejemplo en algunos municipios; la mitad sin dato de matrícula, como en la lista real.
      const nNo = Number(m.code) % 3 === 0 ? 2 : Number(m.code) % 3 === 1 ? 1 : 0;
      for (let i = 1; i <= nNo; i++) {
        _inst.push({ dane_ie: '3' + m.code + '000' + String(800 + i), institucion: `COLEGIO PRIVADO DE EJEMPLO ${sinTilde(m.name).toUpperCase()} ${i}`,
          municipio: sinTilde(m.name).toUpperCase(), num_sedes: 1, matricula: i % 2 ? 60 + (Number(m.code) % 140) : null, sector: 'NO OFICIAL' });
      }
    });
    return _inst;
  }

  function leer() { try { return JSON.parse(localStorage.getItem(LLAVE)) || { ev: [], n: 0, cierres: {} }; } catch (e) { return { ev: [], n: 0, cierres: {} }; } }
  function guardar(b) { try { localStorage.setItem(LLAVE, JSON.stringify(b)); } catch (e) { /* sin espacio: sigue en memoria */ } }
  const local = d => { const t = new Date(d); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 19); };
  const hoy = () => local(new Date()).slice(0, 10);
  const ahora = () => local(new Date());
  const sesion = t => { try { return JSON.parse(decodeURIComponent(escape(atob(t)))); } catch (e) { return null; } };
  const token = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const iePorDane = d => instituciones().find(i => i.dane_ie === d);
  const pub = e => Object.assign({}, e, { archivos: e.archivos.map(a => ({ id: a.id, nombre: a.nombre, mime: a.mime, tamano: a.tamano })) });
  const NO = e => ({ ok: false, error: e });
  const SIN_SESION = NO('Sesión inválida o vencida');
  const guardarItem = (k, v) => { try { localStorage.setItem(LLAVE + k, v); } catch (x) { /* sin espacio */ } };
  const base0 = b => { b.cierres = b.cierres || {}; return b; };
  const cierreDe = (b, d) => { const c = b.cierres[d]; return c && c.vigente ? c : null; };
  const CERRADO = c => NO(`El reporte de su institución se finalizó el ${c.fecha.slice(0, 10)}. Si necesita agregar o corregir algo, pida a la Secretaría de Educación que lo reabra.`);

  function validar(b) {
    if (nombres().indexOf(b.actividad) < 0) return 'Elija una de las actividades de la lista.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha_actividad || '')) return 'Escriba la fecha en que se realizó la actividad.';
    if (b.fecha_actividad > hoy()) return 'La fecha de la actividad no puede ser posterior a hoy.';
    const p = Number(b.participantes);
    if (b.participantes === '' || b.participantes == null || !isFinite(p) || p < 0 || p > 5000 || Math.floor(p) !== p) return 'El número de participantes debe ser un entero entre 0 y 5.000.';
    const d = String(b.descripcion || '').trim();
    if (d.length < 10) return 'Describa brevemente qué se hizo (al menos 10 caracteres).';
    if (d.length > 800) return 'La descripción supera los 800 caracteres.';
    if (b.enlace && !/^https?:\/\/\S+$/i.test(String(b.enlace).trim())) return 'El enlace debe empezar por http:// o https://.';
    if (b.autoriza_imagen !== true) return 'Confirme lo relativo a las imágenes de niñas, niños y adolescentes para poder registrar.';
    return '';
  }
  const campos = b => ({ actividad: b.actividad, fecha_actividad: b.fecha_actividad, participantes: Number(b.participantes),
    descripcion: String(b.descripcion).trim(), enlace: String(b.enlace || '').trim(), autoriza_imagen: true });
  const ieDe = b => { const s = sesion(b.token); return s && s.rol === 'IE' ? s : null; };
  const revDe = b => { const s = sesion(b.token); return s && s.rol === 'REVISOR' && USUARIOS.some(u => u.correo === s.correo) ? s : null; };
  // Código de verificación de la constancia: huella corta de la institución, la hora y lo reportado.
  function huella(txt) { let h = 2166136261; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7); }
  function resumenDe(ev) { return { registros: ev.length, actividades: new Set(ev.map(e => e.actividad)).size, participantes: ev.reduce((s, e) => s + e.participantes, 0), fotos: ev.reduce((s, e) => s + e.archivos.filter(a => a.mime !== 'application/pdf').length, 0) }; }

  const acciones = {
    ingresar(b) {
      const d = String(b.dane_ie || '').replace(/\D/g, '');
      if (d.length !== 12) return NO('El código DANE de la institución tiene 12 dígitos.');
      const ie = iePorDane(d);
      if (!ie) return NO('Ese código no corresponde a una institución educativa de la lista. Revise que sea el de la institución y no el de una sede.');
      return { ok: true, token: token({ rol: 'IE', dane_ie: d }), rol: 'IE', institucion: ie, actividades: nombres() };
    },
    solicitarCodigo(b) {
      const c = String(b.correo || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return NO('Escriba un correo válido.');
      ultimoCodigo = '';
      if (USUARIOS.some(u => u.correo === c)) { ultimoCodigo = String(Math.floor(100000 + Math.random() * 900000)); _otp[c] = ultimoCodigo; }
      return { ok: true };
    },
    validarCodigo(b) {
      const c = String(b.correo || '').trim().toLowerCase(), u = USUARIOS.find(x => x.correo === c);
      if (!u || !_otp[c] || _otp[c] !== String(b.codigo || '').replace(/\D/g, '')) return NO('El código no es válido o ya venció. Pida uno nuevo.');
      delete _otp[c];
      return { ok: true, token: token({ rol: 'REVISOR', correo: c }), rol: 'REVISOR', usuario: u, actividades: nombres() };
    },
    misEvidencias(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const ie = iePorDane(s.dane_ie); if (!ie) return SIN_SESION;
      const base = base0(leer());
      const mias = base.ev.filter(e => e.dane_ie === s.dane_ie).map(pub).sort((a, c) => (a.registrado < c.registrado ? 1 : -1));
      return { ok: true, institucion: ie, evidencias: mias, cierre: cierreDe(base, s.dane_ie), actividades: nombres() };
    },
    crearEvidencia(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()), c = cierreDe(base, s.dane_ie); if (c) return CERRADO(c);
      const err = validar(b); if (err) return NO(err);
      const previa = base.ev.find(e => e.cid === b.cid && e.dane_ie === s.dane_ie);
      if (previa) return { ok: true, evidencia: pub(previa), repetida: true };
      const ie = iePorDane(s.dane_ie);
      base.n++;
      const e = Object.assign(campos(b), { id: 'EV-DEMO-' + String(base.n).padStart(4, '0'), cid: b.cid, registrado: ahora(),
        dane_ie: ie.dane_ie, institucion: ie.institucion, municipio: ie.municipio, archivos: [], version: 1, actualizado: ahora(), con_miniatura: false });
      base.ev.push(e); guardar(base);
      return { ok: true, evidencia: pub(e) };
    },
    editarEvidencia(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()), c = cierreDe(base, s.dane_ie); if (c) return CERRADO(c);
      const err = validar(b); if (err) return NO(err);
      const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      Object.assign(e, campos(b), { version: e.version + 1, actualizado: ahora() }); guardar(base);
      return { ok: true, evidencia: pub(e) };
    },
    subirArchivo(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()), c = cierreDe(base, s.dane_ie); if (c) return CERRADO(c);
      const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      if (e.archivos.some(a => a.cid === b.cid)) return { ok: true, evidencia: pub(e), repetido: true };
      if (e.archivos.length >= 10) return NO('Se pueden adjuntar hasta 10 archivos por actividad.');
      const id = 'A-' + b.cid;
      e.archivos.push({ id, cid: b.cid, nombre: b.nombre, mime: b.mime || 'image/jpeg', tamano: Math.round(String(b.contenido_base64).length * 0.75) });
      e.actualizado = ahora();
      guardarItem('_f_' + id, b.contenido_base64);
      if (b.miniatura) { guardarItem('_m_' + id, b.miniatura); e.con_miniatura = true; }   // una miniatura por foto
      guardar(base);
      return { ok: true, evidencia: pub(e) };
    },
    quitarArchivo(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()), c = cierreDe(base, s.dane_ie); if (c) return CERRADO(c);
      const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      e.archivos = e.archivos.filter(a => a.id !== b.archivo_id); e.actualizado = ahora(); e.con_miniatura = e.archivos.some(a => a.mime !== 'application/pdf'); guardar(base);
      try { localStorage.removeItem(LLAVE + '_f_' + b.archivo_id); localStorage.removeItem(LLAVE + '_m_' + b.archivo_id); } catch (x) { /* nada */ }
      return { ok: true, evidencia: pub(e) };
    },
    verArchivo(b) {
      const s = sesion(b.token); if (!s) return SIN_SESION;
      const e = leer().ev.find(x => x.id === b.id);
      if (!e || (s.rol === 'IE' && e.dane_ie !== s.dane_ie)) return NO('No se encontró esa evidencia.');
      const a = e.archivos.find(x => x.id === b.archivo_id); if (!a) return NO('No se encontró ese archivo.');
      if (a.semilla != null) return { ok: true, nombre: a.nombre, mime: a.mime, contenido_base64: escena(a.semilla, a.escena, 1200, 800).split(',')[1] };
      const c = localStorage.getItem(LLAVE + '_f_' + a.id);
      if (!c) return NO('En la demostración este archivo no quedó guardado (sin espacio en el navegador).');
      return { ok: true, nombre: a.nombre, mime: a.mime, contenido_base64: c };
    },
    // Las miniaturas se piden por foto (id del archivo), no por registro.
    verMiniaturas(b) {
      const s = sesion(b.token); if (!s) return SIN_SESION;
      const ev = leer().ev, salida = {};
      (b.ids || []).slice(0, 48).forEach(id => {
        const e = ev.find(x => x.archivos.some(a => a.id === id)); if (!e || (s.rol === 'IE' && e.dane_ie !== s.dane_ie)) return;
        const a = e.archivos.find(x => x.id === id);
        const m = a.semilla != null ? escena(a.semilla, a.escena, 360, 240) : localStorage.getItem(LLAVE + '_m_' + id);
        if (m) salida[id] = m;
      });
      return { ok: true, miniaturas: salida };
    },
    listarTodo(b) {
      const s = revDe(b); if (!s) return SIN_SESION;
      const base = base0(leer());
      return { ok: true, usuario: USUARIOS.find(u => u.correo === s.correo), instituciones: instituciones(), evidencias: base.ev.map(pub),
        cierres: Object.values(base.cierres).filter(c => c.vigente), actividades: nombres() };
    },
    // La institución finaliza su reporte; desde ahí no puede agregar ni corregir.
    finalizarReporte(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()); if (cierreDe(base, s.dane_ie)) return CERRADO(cierreDe(base, s.dane_ie));
      const nombre = String(b.nombre || '').trim(), cargo = String(b.cargo || '').trim(), correo = String(b.correo || '').trim().toLowerCase();
      if (nombre.length < 5) return NO('Escriba el nombre completo de quien finaliza el reporte.');
      if (!cargo) return NO('Elija el cargo.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return NO('Escriba un correo válido para recibir la constancia.');
      if (b.confirma !== true) return NO('Marque la confirmación para finalizar.');
      const mias = base.ev.filter(e => e.dane_ie === s.dane_ie), sin = !mias.length;
      const motivo = String(b.motivo || '').trim();
      if (sin && motivo.length < 10) return NO('Cuente brevemente por qué la institución no realizó actividades.');
      const fecha = ahora(), res = resumenDe(mias);
      const c = { dane_ie: s.dane_ie, fecha, nombre: nombre.toUpperCase(), cargo, correo, sin_actividades: sin, motivo: sin ? motivo : '',
        resumen: res, codigo: '25N-' + huella(s.dane_ie + fecha + JSON.stringify(res)), vigente: true };
      base.cierres[s.dane_ie] = c; guardar(base);
      return { ok: true, cierre: c, correo_enviado: false };
    },
    // La Secretaría reabre un reporte finalizado (D1).
    reabrirReporte(b) {
      const s = revDe(b); if (!s) return SIN_SESION;
      const base = base0(leer()), c = cierreDe(base, b.dane_ie); if (!c) return NO('Ese reporte no está finalizado.');
      c.vigente = false; c.reabierto = ahora(); c.reabierto_por = s.correo; guardar(base);
      return { ok: true };
    }
  };

  async function llamar(accion, datos) {
    await new Promise(r => setTimeout(r, 120));
    const f = acciones[accion];
    const r = f ? f(datos) : NO('Acción desconocida: ' + accion);
    r.accion = accion; return r;
  }

  /* ── Fotos de ejemplo: escenas dibujadas en el navegador, una por tipo de actividad. Deterministas: la misma semilla da
     siempre la misma imagen, así no ocupan espacio en el navegador. Llevan la marca «Foto de ejemplo». ── */
  const _cache = new Map();
  function escena(semilla, tipo, W, H) {
    const llave = semilla + '|' + tipo + '|' + W;
    if (_cache.has(llave)) return _cache.get(llave);
    let s = semilla * 7 + 13; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), k = W / 1200;
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
    const col = l => css(l[Math.floor(az() * l.length)]);
    const rect = (x, y, w, h, f, r) => { g.fillStyle = f; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r || 0) : g.rect(x, y, w, h); g.fill(); };
    const degr = (a, b) => { const d = g.createLinearGradient(0, 0, 0, H); d.addColorStop(0, a); d.addColorStop(1, b); return d; };
    const persona = (x, y, h, f, alfa) => {   // silueta: cabeza, hombros y cuerpo
      g.save(); g.globalAlpha = alfa == null ? 1 : alfa; g.fillStyle = f;
      g.beginPath(); g.arc(x, y - h * 0.82, h * 0.12, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - h * 0.2, y); g.quadraticCurveTo(x - h * 0.24, y - h * 0.62, x, y - h * 0.66); g.quadraticCurveTo(x + h * 0.24, y - h * 0.62, x + h * 0.2, y); g.fill();
      g.restore();
    };
    const publico = (n, y0, h0, alfa) => { for (let i = 0; i < n; i++) persona(W * (i + 0.5 + (az() - 0.5) * 0.4) / n, y0 + az() * 20 * k, h0 * (0.85 + az() * 0.3), col(['--t1', '--t2', '--v8', '--env-tx', '--c-des-tx']), alfa); };
    const lineas = (x, y, w, n, f) => { for (let i = 0; i < n; i++) rect(x, y + i * 14 * k, w * (0.55 + az() * 0.45), 5 * k, f, 3); };
    const pared = col(['--c-des-bg', '--oro0', '--v0', '--sup2']);
    switch (tipo % 6) {
      case 0: { // Cambia la frase: tendedero de frases
        g.fillStyle = degr(pared, css('--sup2')); g.fillRect(0, 0, W, H);
        rect(0, H * 0.78, W, H * 0.22, css('--contorno'));
        g.strokeStyle = css('--t2'); g.lineWidth = 3 * k; g.beginPath(); g.moveTo(0, H * 0.18); g.quadraticCurveTo(W / 2, H * 0.3, W, H * 0.16); g.stroke();
        for (let i = 0; i < 9; i++) {
          const x = W * (0.04 + i * 0.106), y = H * (0.2 + Math.sin(i / 8 * Math.PI) * 0.1), w = 96 * k, h = 128 * k;
          g.save(); g.translate(x + w / 2, y); g.rotate((az() - 0.5) * 0.18);
          rect(-w / 2, 0, w, h, i % 3 ? css('--sup') : col(['--oro', '--c-des-pt', '--v1'])); lineas(-w / 2 + 12 * k, 18 * k, w - 24 * k, 5, css('--t3'));
          rect(-6 * k, -10 * k, 12 * k, 22 * k, css('--oro-osc'), 3); g.restore();
        }
        publico(5, H * 1.02, H * 0.55, 0.92); break;
      }
      case 1: { // Pausa la escena: escenario con tres personas y público
        g.fillStyle = degr(css('--v8'), css('--t1')); g.fillRect(0, 0, W, H);
        const luz = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W * 0.45); luz.addColorStop(0, 'rgba(255,240,200,.55)'); luz.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = luz; g.fillRect(0, 0, W, H);
        rect(0, 0, W * 0.12, H, css('--c-des-tx')); rect(W * 0.88, 0, W * 0.12, H, css('--c-des-tx'));
        rect(0, H * 0.72, W, H * 0.28, css('--oro-osc'));
        [0.38, 0.5, 0.62].forEach((x, i) => persona(W * x, H * 0.76, H * (0.5 + i % 2 * 0.06), col(['--oro', '--sup', '--c-des-pt', '--v1'])));
        publico(9, H * 1.04, H * 0.3, 1); break;
      }
      case 2: { // El tráiler: un celular grabando, con la escena detrás
        g.fillStyle = degr(css('--env-bg'), pared); g.fillRect(0, 0, W, H);
        publico(6, H * 0.95, H * 0.5, 0.35);
        const pw = W * 0.22, ph = pw * 1.9, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        rect(px - 10 * k, py - 10 * k, pw + 20 * k, ph + 20 * k, css('--t1'), 28 * k);
        g.fillStyle = degr(css('--c-des-pt'), css('--oro')); g.beginPath(); g.roundRect ? g.roundRect(px, py, pw, ph, 18 * k) : g.rect(px, py, pw, ph); g.fill();
        persona(W / 2, py + ph * 0.86, ph * 0.5, css('--sup'), 0.9);
        g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(W / 2 - 18 * k, H / 2 - 24 * k); g.lineTo(W / 2 + 26 * k, H / 2); g.lineTo(W / 2 - 18 * k, H / 2 + 24 * k); g.fill();
        lineas(px + 18 * k, py + ph - 70 * k, pw - 36 * k, 2, 'rgba(255,255,255,.8)'); break;
      }
      case 3: { // Muro de los compromisos: árbol con tarjetas
        g.fillStyle = degr(pared, css('--sup')); g.fillRect(0, 0, W, H);
        rect(0, H * 0.8, W, H * 0.2, css('--contorno'));
        g.strokeStyle = css('--oro-osc'); g.lineCap = 'round';
        g.lineWidth = 46 * k; g.beginPath(); g.moveTo(W / 2, H * 0.82); g.lineTo(W / 2, H * 0.42); g.stroke();
        g.lineWidth = 16 * k; [[-0.22, 0.2], [0.2, 0.18], [-0.12, 0.3], [0.14, 0.32], [0, 0.12]].forEach(([dx, y]) => { g.beginPath(); g.moveTo(W / 2, H * 0.5); g.lineTo(W * (0.5 + dx), H * y); g.stroke(); });
        for (let i = 0; i < 26; i++) {
          const a = az() * Math.PI * 2, r = az() * 0.3;
          g.save(); g.translate(W / 2 + Math.cos(a) * r * W, H * 0.3 + Math.sin(a) * r * H * 0.55); g.rotate((az() - 0.5) * 0.7);
          rect(-34 * k, -22 * k, 68 * k, 44 * k, col(['--v7', '--oro', '--c-des-pt', '--v1', '--sup', '--env-pt'])); g.restore();
        }
        publico(4, H * 1.03, H * 0.5, 0.92); break;
      }
      case 4: { // Ruta de atención: punto informativo
        g.fillStyle = degr(css('--sup2'), pared); g.fillRect(0, 0, W, H);
        rect(W * 0.56, H * 0.1, W * 0.32, H * 0.5, css('--sup'), 8 * k);
        const caja = (x, y, f) => rect(W * x, H * y, W * 0.08, H * 0.07, css(f), 6 * k);
        caja(0.6, 0.16, '--c-des-pt'); caja(0.76, 0.16, '--env-pt'); caja(0.6, 0.3, '--v7'); caja(0.76, 0.3, '--oro'); caja(0.68, 0.45, '--c-des-tx');
        g.strokeStyle = css('--t3'); g.lineWidth = 3 * k; g.beginPath(); g.moveTo(W * 0.68, H * 0.195); g.lineTo(W * 0.76, H * 0.195); g.moveTo(W * 0.64, H * 0.23); g.lineTo(W * 0.64, H * 0.3); g.moveTo(W * 0.8, H * 0.23); g.lineTo(W * 0.8, H * 0.3); g.moveTo(W * 0.64, H * 0.37); g.lineTo(W * 0.72, H * 0.45); g.stroke();
        rect(W * 0.08, H * 0.58, W * 0.6, H * 0.08, css('--v7'), 6 * k); rect(W * 0.1, H * 0.66, W * 0.56, H * 0.34, css('--v8'));
        for (let i = 0; i < 7; i++) { g.save(); g.translate(W * (0.14 + i * 0.07), H * 0.6); g.rotate((az() - 0.5) * 0.4); rect(0, 0, 50 * k, 34 * k, i % 2 ? css('--sup') : css('--oro0'), 3); g.restore(); }
        persona(W * 0.3, H * 0.6, H * 0.4, css('--c-des-tx')); publico(4, H * 1.05, H * 0.45, 0.95); break;
      }
      default: { // Otra actividad: jornada en el auditorio, con pancarta
        g.fillStyle = degr(css('--oro0'), css('--sup2')); g.fillRect(0, 0, W, H);
        rect(W * 0.12, H * 0.08, W * 0.76, H * 0.16, css('--c-des-pt'), 10 * k); lineas(W * 0.2, H * 0.12, W * 0.6, 3, 'rgba(255,255,255,.85)');
        publico(7, H * 0.78, H * 0.36, 0.55); publico(6, H * 0.92, H * 0.42, 0.8); publico(5, H * 1.06, H * 0.5, 1);
      }
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    if (W >= 600) { g.font = `600 ${Math.round(18 * k)}px sans-serif`; const t = 'Foto de ejemplo', tw = g.measureText(t).width; rect(W - tw - 40 * k, H - 46 * k, tw + 24 * k, 32 * k, 'rgba(15,23,42,.62)', 8 * k); g.fillStyle = '#fff'; g.fillText(t, W - tw - 28 * k, H - 24 * k); }
    const url = c.toDataURL('image/jpeg', W >= 600 ? 0.8 : 0.7);
    _cache.set(llave, url); return url;
  }

  /* Reparte registros de ejemplo: unas instituciones finalizaron, otras van reportando y otras no han empezado. Determinista. */
  function sembrar() {
    let s = 11; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const base = { ev: [], n: 0, cierres: {} }, acts = window.CONFIG.ACTIVIDADES, ins = instituciones();
    const desc = ['Mural con las frases que el grado noveno decidió dejar atrás y las que eligió en su lugar.', 'Tres escenas breves con los estudiantes de décimo; el público propuso otro final para cada una.',
      'Video vertical de 30 segundos con los mensajes de la campaña, grabado por el grupo de comunicación.', 'Árbol de compromisos en el patio central con las tarjetas de primaria y bachillerato.',
      'Punto informativo en la entrada con la ruta municipal de atención y volantes para las familias.', 'Jornada con docentes y familias en el auditorio sobre el 25 de noviembre.'];
    let foto = 0;
    ins.forEach((ie, n) => {
      if (az() > 0.66) return;                      // un tercio no ha empezado
      const k = 1 + Math.floor(az() * 3);
      for (let j = 0; j < k; j++) {
        const d = new Date(); d.setDate(d.getDate() - Math.floor(az() * 13)); d.setHours(7 + Math.floor(az() * 10), Math.floor(az() * 60), 0, 0);
        const ts = local(d), a = j === 0 ? n % acts.length : Math.floor(az() * acts.length);
        base.n++;
        const id = 'EV-DEMO-' + String(base.n).padStart(4, '0');
        const nf = a === 2 ? Math.floor(az() * 2) : 1 + Math.floor(az() * 4), archivos = [];
        for (let f = 0; f < nf; f++) { foto++; archivos.push({ id: 'A-sem-' + foto, cid: 'A-sem-' + foto, nombre: `foto_${f + 1}.jpg`, mime: 'image/jpeg', tamano: 280000 + Math.floor(az() * 400000), semilla: foto, escena: a }); }
        if (az() > 0.85) archivos.push({ id: 'A-pdf-' + base.n, cid: 'A-pdf-' + base.n, nombre: 'acta_de_la_actividad.pdf', mime: 'application/pdf', tamano: 412000 });
        base.ev.push({ id, cid: 'sem-' + base.n, registrado: ts, actualizado: ts, dane_ie: ie.dane_ie, institucion: ie.institucion, municipio: ie.municipio,
          actividad: acts[a].nombre, fecha_actividad: ts.slice(0, 10), participantes: 15 + Math.floor(az() * 180), descripcion: desc[a],
          enlace: a === 2 ? 'https://www.ejemplo.com/video-de-la-campana' : '', autoriza_imagen: true, archivos, version: 1, con_miniatura: nf > 0 });
      }
      if (az() < 0.42) {                            // algunas ya finalizaron
        const mias = base.ev.filter(e => e.dane_ie === ie.dane_ie), ultimo = mias.reduce((m, e) => (e.registrado > m ? e.registrado : m), '');
        const fecha = local(new Date(new Date(ultimo).getTime() + 3 * 3600000)), res = resumenDe(mias);
        base.cierres[ie.dane_ie] = { dane_ie: ie.dane_ie, fecha: fecha > ahora() ? ahora() : fecha, nombre: 'RESPONSABLE DE EJEMPLO', cargo: 'Rector o rectora', correo: 'rectoria@ejemplo.edu.co',
          sin_actividades: false, motivo: '', resumen: res, codigo: '25N-' + huella(ie.dane_ie + fecha + JSON.stringify(res)), vigente: true };
      }
    });
    // Una institución finalizó sin actividades, para ver ese caso
    const sinAct = ins.find(i => !base.ev.some(e => e.dane_ie === i.dane_ie));
    if (sinAct) base.cierres[sinAct.dane_ie] = { dane_ie: sinAct.dane_ie, fecha: ahora(), nombre: 'RESPONSABLE DE EJEMPLO', cargo: 'Coordinador o coordinadora', correo: 'coordinacion@ejemplo.edu.co',
      sin_actividades: true, motivo: 'La institución estuvo en jornada de nivelación y realizará las actividades en la semana del 25 de noviembre.', resumen: resumenDe([]), codigo: '25N-' + huella(sinAct.dane_ie), vigente: true };
    guardar(base); return base.ev.length;
  }
  // Tres códigos para entrar como institución: una que va reportando, una que no ha empezado y una que ya finalizó.
  function ejemplos() {
    const base = base0(leer()), ins = instituciones(), con = new Set(base.ev.map(e => e.dane_ie));
    const rep = ins.find(i => con.has(i.dane_ie) && !cierreDe(base, i.dane_ie) && base.ev.filter(e => e.dane_ie === i.dane_ie).length >= 2);
    const sin = ins.find(i => !con.has(i.dane_ie) && !cierreDe(base, i.dane_ie));
    const fin = ins.find(i => con.has(i.dane_ie) && cierreDe(base, i.dane_ie));
    return [[rep, 'va reportando'], [sin, 'no ha empezado'], [fin, 'ya finalizó']].filter(x => x[0]).map(([i, t]) => ({ dane_ie: i.dane_ie, estado: t }));
  }

  return { llamar, instituciones, sembrar, ejemplos, USUARIOS, codigo: () => ultimoCodigo, vacio: () => !leer().ev.length,
    reiniciar() { _inst = null; _otp = {}; Object.keys(localStorage).filter(k => k.indexOf(LLAVE) === 0).forEach(k => localStorage.removeItem(k)); } };
})();
