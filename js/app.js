/* app/js/app.js — Pantallas y rutas. Script clásico, sin dependencias.
   Institución:  #ingreso · #inicio · #registrar?a=N | ?e=ID · #evidencia/ID
   Secretaría:   #secretaria · #panel · #evidencias · #pendientes · #evidencia/ID   (solo consulta: no aprueba ni devuelve) */
(function () {
  'use strict';
  const CFG = window.CONFIG, API = window.API;
  const main = document.getElementById('contenido'), shell = document.getElementById('shell'), avisoEl = document.getElementById('aviso');
  const LLAVE = 'ev25n_sesion';
  const MAX_ARCHIVOS = 10, MAX_LADO = 1600, MAX_IMG = 3 * 1024 * 1024, MAX_PDF = 4 * 1024 * 1024;
  const MANIZALES = '17001', VIGENCIA_TODO_MS = 2 * 60 * 1000, POR_PAGINA = 24;

  let S = null; try { S = JSON.parse(sessionStorage.getItem(LLAVE)); } catch (e) { S = null; }
  let TODO = null;            // listado completo de la Secretaría (con la hora en que se trajo)
  let MENSAJE = '';           // aviso que la pantalla siguiente muestra una vez
  let F = null;               // estado del formulario abierto
  let LOGIN = { correo: '' }; // ingreso de la Secretaría: paso del código
  const MINI = {};            // miniaturas ya traídas: id → data URI
  let limiteGaleria = POR_PAGINA;

  /* ── Utilidades ── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dane = d => String(d).replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');
  const nf = new Intl.NumberFormat('es-CO');
  const num = n => nf.format(n);
  const pct = p => Math.round(p * 100) + ' %';
  const fechaUTC = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fecha = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fechaUTC(iso));
  const diaMes = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(fechaUTC(iso));
  const diaCorto = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(fechaUTC(iso)).replace('.', '');
  const fechaHora = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const horaDe = d => new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(d);
  const hace = iso => {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'ahora mismo'; if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60); if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
    const d = Math.round(h / 24); return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  };
  const tam = b => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const sumarDias = (iso, n) => { const d = fechaUTC(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const difDias = (a, b) => Math.round((fechaUTC(b) - fechaUTC(a)) / 86400000);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const plural = (n, a, b) => (n === 1 ? a : b);
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el']);
  const nombrePropio = s => String(s || '').toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => (i && MENORES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  const iniciales = s => String(s || '').replace(/INSTITUCI[OÓ]N EDUCATIVA/i, '').split(/\s+/).filter(w => w && !MENORES.has(w.toLowerCase())).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '·';
  let _porNombre = null;
  // El municipio sale del nombre que trae fctMaestra, no del código DANE: 3 instituciones reales llevan en su código el de otro
  // municipio (Norcasia con el de Samaná, dos de San José con el de Risaralda). Si el nombre no está en el mapa, se usan los dígitos 2 a 6.
  const codMun = o => {
    if (!_porNombre) { _porNombre = {}; window.MAPA.munis.forEach(m => { _porNombre[norm(m.name)] = m.code; }); }
    return _porNombre[norm(o.municipio || '')] || String(o.dane_ie).slice(1, 6);
  };
  const nomMun = (cod, resp) => { const m = window.MAPA && window.MAPA.munis.find(x => x.code === cod); return m ? m.name : resp || cod; };

  function aviso(txt) {
    avisoEl.textContent = txt; avisoEl.classList.add('on');
    clearTimeout(aviso.t); aviso.t = setTimeout(() => avisoEl.classList.remove('on'), 4500);
  }
  function guardarSesion() { try { sessionStorage.setItem(LLAVE, JSON.stringify(S)); } catch (e) { /* sin almacenamiento: dura hasta recargar */ } }
  function cerrarSesion(msg) {
    const era = S && S.rol; S = null; TODO = null; LOGIN = { correo: '' };
    try { sessionStorage.removeItem(LLAVE); } catch (e) { /* nada */ }
    MENSAJE = msg || '';
    const destino = era === 'REVISOR' ? '#secretaria' : '#ingreso';
    if (location.hash === destino) router(); else location.hash = destino;
  }
  async function api(accion, datos) {
    const r = await API.llamar(accion, Object.assign({ token: S && S.token }, datos));
    if (!r.ok && r.error === 'Sesión inválida o vencida') { cerrarSesion('Su sesión venció. Vuelva a entrar.'); throw new Error('sesion'); }
    return r;
  }
  const demoNota = () => (API.demo() ? `<p class="cita"><b>Modo de demostración.</b> Lo que escriba aquí queda solo en este navegador y no llega a ninguna Secretaría.</p>` : '');
  const vacio = (t, d, error) => `<div class="vacio${error ? ' error' : ''}"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ''}</div>`;
  const cargando = () => { main.innerHTML = `<section class="panel"><div class="vacio" role="status"><b>Cargando…</b></div></section>`; };
  function pintar(titulo, html) {
    document.title = titulo + ' · Evidencias 25N';
    main.innerHTML = html;
    window.scrollTo(0, 0); main.focus({ preventScroll: true });
  }

  async function cargarMapa() {
    if (window.MAPA) return;
    try { window.MAPA = await (await fetch(CFG.MAPA_URL)).json(); } catch (e) { window.MAPA = { munis: [] }; }
  }
  function anillo(el, estados, texto, sub) {   // un segmento por elemento, del color de su estado: se cuenta, no se estima
    const n = estados.length, R = 52, C = 60, hueco = n > 1 ? 4 : 0, paso = 360 / n;
    const arco = (a0, a1) => { const r = a => (a - 90) * Math.PI / 180, p = a => [C + R * Math.cos(r(a)), C + R * Math.sin(r(a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
    el.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">${estados.map((k, i) => `<path d="${arco(i * paso + hueco / 2, (i + 1) * paso - hueco / 2)}" fill="none" stroke="var(--${k}-pt)" stroke-width="12"/>`).join('')}</svg>
      <div class="centro" aria-hidden="true"><b>${texto}</b><small>${sub}</small></div>`;
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', texto + ' ' + sub);
  }

  /* ── Armazón: riel y menú solo para la Secretaría; quién entró, arriba a la derecha ── */
  function barra(ruta) {
    const revisor = S && S.rol === 'REVISOR';
    shell.classList.toggle('sin-riel', !revisor);
    document.getElementById('nav-movil').hidden = !revisor;
    const activo = ruta === 'evidencia' ? 'evidencias' : ruta;
    document.querySelectorAll('[data-r]').forEach(a => { if (a.dataset.r === activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const yo = document.getElementById('yo'), av = document.getElementById('av');
    yo.hidden = !S; document.getElementById('salir').hidden = !S;
    if (!S) return;
    const nom = revisor ? nombrePropio(S.usuario && S.usuario.nombre) : (S.ie ? S.ie.institucion : '');
    const rol = revisor ? ((S.usuario && S.usuario.cargo) || 'Secretaría de Educación') : (S.ie ? `Institución educativa · ${nomMun(codMun(S.ie), S.ie.municipio)}` : '');
    document.getElementById('yo-nom').textContent = nom; document.getElementById('yo-rol').textContent = rol;
    av.textContent = iniciales(revisor ? S.usuario && S.usuario.nombre : nom); av.classList.toggle('azul', revisor);
    yo.title = nom + ' — ' + rol;
  }
  document.getElementById('salir').addEventListener('click', () => cerrarSesion());

  /* ── Rutas ── */
  function parsear() {
    const h = (location.hash || '#ingreso').slice(1), [ruta, qs] = h.split('?');
    return { partes: ruta.split('/'), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  async function router() {
    const { partes, q } = parsear();
    let r = partes[0] === 'revision' ? 'secretaria' : partes[0];
    await cargarMapa();
    barra(r);
    const libre = r === 'ingreso' || r === 'secretaria';
    const rol = S && S.rol, inicioDe = rol === 'IE' ? '#inicio' : '#panel';
    if (!S && !libre) { location.hash = '#ingreso'; return; }
    if (S && libre) { location.hash = inicioDe; return; }
    if (rol === 'IE' && ['panel', 'evidencias', 'pendientes'].includes(r)) { location.hash = '#inicio'; return; }
    if (rol === 'REVISOR' && ['inicio', 'registrar'].includes(r)) { location.hash = '#panel'; return; }
    try {
      if (r === 'ingreso') vistaIngreso();
      else if (r === 'secretaria') vistaSecretariaIngreso();
      else if (r === 'inicio') await vistaInicio();
      else if (r === 'registrar') await vistaRegistrar(q);
      else if (r === 'evidencia') await vistaEvidencia(partes[1]);
      else if (r === 'panel') await vistaResumen();
      else if (r === 'evidencias') await vistaEvidencias(q);
      else if (r === 'pendientes') await vistaPendientes(q);
      else location.hash = S ? inicioDe : '#ingreso';
    } catch (e) { if (e.message !== 'sesion') pintar('Error', `<section class="panel">${vacio('Algo no salió bien', 'Recargue la página. Si sigue igual, avise a la Secretaría de Educación.', true)}</section>`); }
  }
  window.addEventListener('hashchange', router);

  /* ── Portada y los dos ingresos ── */
  function errorCampo(id, msg) {
    const c = document.getElementById('c-' + id), ay = document.getElementById(id + '-ay'), el = document.getElementById(id);
    c.classList.add('mal'); ay.textContent = msg; ay.classList.add('mal'); el.setAttribute('aria-invalid', 'true'); el.focus();
  }
  function limpiarErrores(raiz) {
    raiz.querySelectorAll('.mal').forEach(x => x.classList.remove('mal'));
    raiz.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    raiz.querySelectorAll('.ayuda[data-orig]').forEach(x => { x.textContent = x.dataset.orig; });
  }
  const ICO_IE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6 8 2.5 14.5 6 8 9.5Z"/><path d="M4 7.4v3.4c1.2 1.3 2.6 1.9 4 1.9s2.8-.6 4-1.9V7.4"/></svg>';
  const ICO_SED = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 14.5h12M3 14.5V6.5h10v8M1.8 6.5 8 2l6.2 4.5M5.5 9v3M8 9v3M10.5 9v3"/></svg>';
  function portada(modo, cuerpo, pasos) {
    const sed = modo === 'sed';
    return `<div class="portada">
      <section class="panel lienzo"><h1>${esc(CFG.TITULO)}</h1>
        <p>${esc(diaMes(CFG.DIA))}. Las instituciones educativas de Caldas registran aquí lo que hicieron en la conmemoración, y la Secretaría de Educación lo consulta en un solo lugar.</p>
        <p class="lema">«${esc(CFG.CAMPANA)}: ${esc(CFG.LEMA)}»</p>
        ${window.ILUSTRACION || ''}
        <div class="pie-lienzo"><span><b>${CFG.ACTIVIDADES.length - 1}</b> actividades propuestas y otras que la institución haga</span><span><b>16 días</b> de activismo, del ${esc(diaMes(CFG.DIA))} al ${esc(diaMes(CFG.FIN))}</span></div></section>
      <section class="panel entrar${sed ? ' sed' : ''}">
        <nav class="puertas" aria-label="Tipo de ingreso">
          <a class="puerta ie" href="#ingreso"${sed ? '' : ' aria-current="page"'}>${ICO_IE}Institución educativa</a>
          <a class="puerta sed" href="#secretaria"${sed ? ' aria-current="page"' : ''}>${ICO_SED}Secretaría de Educación</a></nav>
        ${cuerpo}
        <h2 class="como-t">Cómo funciona</h2>
        <ol class="ruta ruta-v" style="--pasos:1">${pasos.map(([t, d], i) => `<li><span class="bola">${i + 1}</span><h3>${esc(t)}</h3><span class="sub">${esc(d)}</span></li>`).join('')}</ol>
      </section></div>`;
  }
  function vistaIngreso() {
    const ejemplos = API.demo() ? window.DEMO.instituciones().slice(0, 3).map(i => `<span translate="no">${i.dane_ie}</span>`).join(', ') : '';
    pintar('Ingreso', `${demoNota()}${API.demo() ? `<p class="cita"><b>Códigos de ejemplo:</b> ${ejemplos}.</p>` : ''}
      ${portada('ie', `<h2>Entre con el código de su institución</h2><p class="sub">Es el código DANE de la institución educativa (12 dígitos), no el de una sede.</p>
        <form id="f-ingreso" novalidate>
          <div class="campo" id="c-dane"><label for="dane">Código DANE de la institución</label>
            <input id="dane" class="dane-campo" type="text" inputmode="numeric" autocomplete="off" placeholder="000 000 000 000" aria-describedby="dane-ay" translate="no">
            <div class="ayuda" id="dane-ay" data-orig="Escríbalo con o sin espacios.">Escríbalo con o sin espacios.</div></div>
          <button class="btn pri grande" type="submit">Entrar</button></form>`,
      [['Entre con el código', 'El código DANE de su institución educativa, de 12 dígitos.'], ['Registre cada actividad', 'Qué se hizo, cuántas personas participaron y las fotografías o el video.'], ['Queda guardada', 'La Secretaría la consulta. Usted puede corregirla cuando quiera.']])}`);
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    const inp = document.getElementById('dane');
    inp.addEventListener('input', () => { inp.value = dane(inp.value.slice(0, 16)); });
    document.getElementById('f-ingreso').addEventListener('submit', async ev => {
      ev.preventDefault();
      const digitos = inp.value.replace(/\D/g, ''), btn = ev.target.querySelector('button');
      limpiarErrores(ev.target);
      if (digitos.length !== 12) return errorCampo('dane', 'El código tiene 12 dígitos. Revise que no falte ninguno.');
      btn.disabled = true; btn.textContent = 'Entrando…';
      const r = await API.llamar('ingresar', { dane_ie: digitos });
      if (!r.ok) { btn.disabled = false; btn.textContent = 'Entrar'; return errorCampo('dane', r.error); }
      S = { token: r.token, rol: 'IE', ie: r.institucion }; guardarSesion(); location.hash = '#inicio';
    });
  }

  function vistaSecretariaIngreso() {
    const paso = LOGIN.correo ? 'codigo' : 'correo';
    const demoTx = !API.demo() ? '' : paso === 'correo'
      ? `<p class="cita codigo-demo"><b>Demostración:</b> use <span translate="no">${esc(window.DEMO.USUARIOS[0].correo)}</span>.</p>`
      : (window.DEMO.codigo() ? `<p class="cita codigo-demo"><b>Código de demostración:</b> <span translate="no">${window.DEMO.codigo()}</span> (en producción llega al correo).</p>` : '<p class="cita codigo-demo">En la demostración solo el correo de ejemplo recibe código.</p>');
    const cuerpo = paso === 'correo'
      ? `<h2>Ingreso de la Secretaría</h2><p class="sub">Para quien consulta las evidencias. Le enviaremos un código a su correo; no hay contraseñas.</p>
         <form id="f-correo" novalidate><div class="campo" id="c-correo"><label for="correo">Correo institucional</label>
           <input id="correo" type="email" autocomplete="email" inputmode="email" aria-describedby="correo-ay"><div class="ayuda" id="correo-ay" data-orig="Debe estar registrado por la Secretaría.">Debe estar registrado por la Secretaría.</div></div>
           <button class="btn azul grande" type="submit">Enviarme un código</button></form>${demoTx}`
      : `<h2>Escriba el código</h2><p class="sub">Si <b translate="no">${esc(LOGIN.correo)}</b> está registrado, le llegó un código de 6 dígitos. Vence en 10 minutos.</p>
         <form id="f-codigo" novalidate><div class="campo" id="c-codigo"><label for="codigo">Código</label>
           <input id="codigo" class="dane-campo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" aria-describedby="codigo-ay"><div class="ayuda" id="codigo-ay" data-orig="Revise también la carpeta de correo no deseado.">Revise también la carpeta de correo no deseado.</div></div>
           <button class="btn azul grande" type="submit">Entrar</button></form>${demoTx}
         <p><button type="button" class="btn sutil" id="otro-correo">Usar otro correo</button></p>`;
    pintar('Ingreso de la Secretaría', `${demoNota()}${portada('sed', cuerpo,
      [['Escriba su correo', 'El que la Secretaría registró para consultar las evidencias.'], ['Escriba el código', 'Llega a ese correo y sirve una sola vez.'], ['Consulte', 'El resumen de la campaña, las evidencias de cada institución y las que faltan.']])}`);
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    if (paso === 'correo') {
      document.getElementById('f-correo').addEventListener('submit', async ev => {
        ev.preventDefault(); limpiarErrores(ev.target);
        const correo = document.getElementById('correo').value.trim().toLowerCase(), btn = ev.target.querySelector('button');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return errorCampo('correo', 'Escriba un correo válido, por ejemplo nombre@dominio.gov.co.');
        btn.disabled = true; btn.textContent = 'Enviando…';
        const r = await API.llamar('solicitarCodigo', { correo });
        if (!r.ok) { btn.disabled = false; btn.textContent = 'Enviarme un código'; return errorCampo('correo', r.error); }
        LOGIN.correo = correo; vistaSecretariaIngreso();
        document.getElementById('codigo').focus();
      });
    } else {
      document.getElementById('otro-correo').addEventListener('click', () => { LOGIN.correo = ''; vistaSecretariaIngreso(); });
      document.getElementById('f-codigo').addEventListener('submit', async ev => {
        ev.preventDefault(); limpiarErrores(ev.target);
        const codigo = document.getElementById('codigo').value.replace(/\D/g, ''), btn = ev.target.querySelector('button');
        if (codigo.length !== 6) return errorCampo('codigo', 'El código tiene 6 dígitos.');
        btn.disabled = true; btn.textContent = 'Entrando…';
        const r = await API.llamar('validarCodigo', { correo: LOGIN.correo, codigo });
        if (!r.ok) { btn.disabled = false; btn.textContent = 'Entrar'; return errorCampo('codigo', r.error); }
        S = { token: r.token, rol: 'REVISOR', usuario: r.usuario }; LOGIN = { correo: '' }; guardarSesion(); location.hash = '#panel';
      });
    }
  }

  /* ── Inicio de la institución ── */
  async function vistaInicio() {
    cargando();
    const r = await api('misEvidencias');
    if (!r.ok) return pintar('Inicio', `<section class="panel">${vacio('No se pudo cargar', r.error, true)}</section>`);
    S.ie = r.institucion; guardarSesion(); barra('inicio');
    const ev = r.evidencias, ie = r.institucion, A = CFG.ACTIVIDADES;
    const porAct = A.map(a => ev.filter(e => e.actividad === a.nombre));
    const hechas = porAct.filter(l => l.length).length;
    const participantes = ev.reduce((s, e) => s + e.participantes, 0);
    const fichas = A.map((a, i) => {
      const l = porAct[i], n = l.length, p = l.reduce((s, e) => s + e.participantes, 0);
      return `<a class="ficha" style="--pt:var(${n ? '--ok-pt' : '--gris-pt'})" href="#registrar?a=${i}">
        <span class="chip ${n ? 'e-ok' : 'e-gris'}">${n ? `${n} ${plural(n, 'registro', 'registros')}` : 'Sin registrar'}</span>
        <h3>${esc(a.nombre)}</h3><p class="que">${esc(a.que)}</p>
        <span class="dato"><span>Participantes</span><b>${n ? num(p) : '—'}</b></span>
        <span class="ir">${n ? 'Registrar otra vez' : 'Registrar'}</span></a>`;
    }).join('');
    const filasEv = ev.map(e => `<li><div style="flex:1;min-width:0"><b>${esc(e.actividad)}</b>
        <small>${esc(fecha(e.fecha_actividad))} · ${num(e.participantes)} ${plural(e.participantes, 'participante', 'participantes')} · ${e.archivos.length} ${plural(e.archivos.length, 'archivo', 'archivos')}</small></div>
        <div class="der"><a class="btn sutil" href="#evidencia/${esc(e.id)}">Ver<span class="oculto"> ${esc(e.actividad)}</span></a></div></li>`).join('');
    pintar(ie.institucion, `
      ${MENSAJE ? `<p class="cita" role="status">${esc(MENSAJE)}</p>` : ''}${demoNota()}
      <section class="panel heroe">
        <div class="anillo" id="anillo"></div>
        <div><h1>${esc(ie.institucion)}</h1>
          <p>${esc(nomMun(codMun(ie), ie.municipio))} · código <span translate="no">${dane(ie.dane_ie)}</span> · ${ie.num_sedes} ${plural(ie.num_sedes, 'sede', 'sedes')}. Registre cada actividad que se hizo en la institución para la campaña «${esc(CFG.CAMPANA)}».</p></div>
        <div class="caja"><span>Participantes</span><b>${num(participantes)}</b><small>suma de ${ev.length} ${plural(ev.length, 'actividad registrada', 'actividades registradas')}</small></div>
      </section>
      <h2 class="seccion">Actividades de la campaña</h2>
      <p class="sub">Un registro por cada vez que se realizó. Puede registrar la misma actividad más de una vez.</p>
      <div class="fichas">${fichas}</div>
      <h2 class="seccion">Lo que ya registró</h2>
      <section class="panel">${ev.length ? `<ul class="lista">${filasEv}</ul>` : vacio('Aún no ha registrado ninguna actividad', 'Elija una actividad de arriba y pulse «Registrar».')}</section>`);
    anillo(document.getElementById('anillo'), porAct.map(l => (l.length ? 'ok' : 'gris')), `${hechas}/${A.length}`, 'actividades');
    MENSAJE = '';
  }

  /* ── Registrar o corregir ── */
  function bloqueAyuda(a) {
    return a ? `<div class="bloque"><b>De qué se trata</b>${esc(a.que)}</div><div class="bloque"><b>Evidencia sugerida</b>${esc(a.pista)}</div><div class="bloque"><b>Cuidado</b>${esc(a.cuidado)}</div>`
      : `<div class="bloque">Elija una actividad y aquí aparecerá de qué se trata, qué evidencia suele servir y qué cuidar.</div>`;
  }
  async function vistaRegistrar(q) {
    let previa = null;
    if (q.e) {
      cargando();
      const r = await api('misEvidencias');
      previa = r.ok && r.evidencias.find(e => e.id === q.e);
      if (!previa) { location.hash = '#inicio'; return; }
    }
    const editar = !!previa;
    const idxAct = q.a != null && CFG.ACTIVIDADES[+q.a] ? +q.a : -1;
    const actual = editar ? previa.actividad : (idxAct >= 0 ? CFG.ACTIVIDADES[idxAct].nombre : '');
    F = { cid: uuid(), nuevos: [], existentes: editar ? previa.archivos.slice() : [], id: editar ? previa.id : null };
    const opciones = `<option value="">Elija la actividad</option>` + CFG.ACTIVIDADES.map(a => `<option value="${esc(a.nombre)}"${a.nombre === actual ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('');
    pintar(editar ? 'Corregir registro' : 'Registrar actividad', `
      <p class="migas"><a href="#inicio">Inicio</a> / ${editar ? 'Corregir un registro' : 'Registrar una actividad'}</p>
      <div class="cab densa"><div><h1>${editar ? 'Corregir un registro' : 'Registrar una actividad'}</h1>
        <p>${editar ? 'Cambie lo que necesite. Lo anterior queda guardado en el historial.' : 'Cuente qué se hizo y adjunte las evidencias.'}</p></div></div>
      <div class="rejilla">
      <form id="f-reg" class="panel c8" novalidate>
        <div class="campo" id="c-act"><label for="act">Actividad</label><select id="act" aria-describedby="act-ay">${opciones}</select>
          <div class="ayuda" id="act-ay" data-orig=""></div></div>
        <div class="fila2">
          <div class="campo" id="c-fecha"><label for="fecha">Fecha en que se realizó</label><input id="fecha" type="date" max="${hoy()}" value="${editar ? esc(previa.fecha_actividad) : ''}" aria-describedby="fecha-ay"><div class="ayuda" id="fecha-ay" data-orig=""></div></div>
          <div class="campo" id="c-part"><label for="part">Número de participantes</label><input id="part" type="text" inputmode="numeric" autocomplete="off" value="${editar ? previa.participantes : ''}" aria-describedby="part-ay"><div class="ayuda" id="part-ay" data-orig="Personas que participaron, sin nombres.">Personas que participaron, sin nombres.</div></div>
        </div>
        <div class="campo" id="c-desc"><label for="desc">¿Qué se hizo?</label><textarea id="desc" maxlength="800" aria-describedby="desc-ay">${editar ? esc(previa.descripcion) : ''}</textarea>
          <div class="ayuda" id="desc-ay" data-orig="Dos o tres frases. No escriba nombres ni relatos de casos reales.">Dos o tres frases. No escriba nombres ni relatos de casos reales.</div><div class="contar" id="desc-n" aria-hidden="true">0 / 800</div></div>
        <div class="campo" id="c-enlace"><label for="enlace">Enlace al video o la publicación <span style="font-weight:400">(opcional)</span></label><input id="enlace" type="url" inputmode="url" placeholder="https://" value="${editar ? esc(previa.enlace) : ''}" aria-describedby="enlace-ay"><div class="ayuda" id="enlace-ay" data-orig=""></div></div>
        <div class="campo" id="c-arch"><span class="lbl" id="arch-l">Fotografías o PDF</span>
          <div><button type="button" class="btn" id="b-arch" aria-describedby="arch-ay">Agregar fotografías o PDF</button><input type="file" id="i-arch" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple hidden></div>
          <ul class="arch" id="l-arch" aria-labelledby="arch-l"></ul>
          <div class="ayuda" id="arch-ay" data-orig="Hasta ${MAX_ARCHIVOS} archivos. Las fotos se reducen solas antes de enviarse.">Hasta ${MAX_ARCHIVOS} archivos. Las fotos se reducen solas antes de enviarse.</div></div>
        <div class="campo"><div class="confirma" id="c-conf"><input type="checkbox" id="conf" aria-describedby="conf-ay"><label for="conf">Confirmo que en las fotografías y videos <b>no aparecen niñas, niños ni adolescentes identificables</b>, o que se cuenta con la autorización informada de sus familias para su uso.</label></div>
          <div class="ayuda" id="conf-ay" data-orig=""></div></div>
        <div id="envio-error" class="ayuda" role="alert"></div>
        <button class="btn pri grande" type="submit" id="b-enviar">${editar ? 'Guardar la corrección' : 'Guardar el registro'}</button>
      </form>
      <aside class="panel c4 lado" aria-live="polite"><h2>Sobre esta actividad</h2><div id="ayuda-act">${bloqueAyuda(CFG.ACTIVIDADES.find(a => a.nombre === actual))}</div></aside></div>`);
    if (editar) document.getElementById('conf').checked = true;
    const desc = document.getElementById('desc'), cont = document.getElementById('desc-n'), sel = document.getElementById('act');
    const actualizarN = () => { cont.textContent = desc.value.length + ' / 800'; };
    desc.addEventListener('input', actualizarN); actualizarN();
    sel.addEventListener('change', () => { document.getElementById('ayuda-act').innerHTML = bloqueAyuda(CFG.ACTIVIDADES.find(x => x.nombre === sel.value)); });
    document.getElementById('b-arch').addEventListener('click', () => document.getElementById('i-arch').click());
    document.getElementById('i-arch').addEventListener('change', async ev => { await agregarArchivos([...ev.target.files]); ev.target.value = ''; });
    document.getElementById('l-arch').addEventListener('click', ev => quitarDeLista(ev));
    document.getElementById('f-reg').addEventListener('submit', enviarFormulario);
    pintarLista();
  }

  function pintarLista() {
    const ul = document.getElementById('l-arch'); if (!ul) return;
    const ex = F.existentes.map(a => `<li><span class="mini" aria-hidden="true">${a.mime === 'application/pdf' ? 'PDF' : 'FOTO'}</span><div class="nom"><b>${esc(a.nombre)}</b><small>Ya guardado · ${tam(a.tamano)}</small></div>
      <button type="button" class="quitar" data-ex="${esc(a.id)}" aria-label="Quitar ${esc(a.nombre)}">×</button></li>`);
    const nu = F.nuevos.map(a => `<li>${a.url ? `<img class="mini" src="${a.url}" alt="">` : `<span class="mini" aria-hidden="true">PDF</span>`}<div class="nom"><b>${esc(a.nombre)}</b><small>${tam(a.tam)}</small></div>
      <button type="button" class="quitar" data-nu="${esc(a.cid)}" aria-label="Quitar ${esc(a.nombre)}">×</button></li>`);
    ul.innerHTML = ex.concat(nu).join('');
  }
  async function quitarDeLista(ev) {
    const b = ev.target.closest('button.quitar'); if (!b) return;
    if (b.dataset.nu) { const a = F.nuevos.find(x => x.cid === b.dataset.nu); if (a && a.url) URL.revokeObjectURL(a.url); F.nuevos = F.nuevos.filter(x => x.cid !== b.dataset.nu); pintarLista(); return; }
    b.disabled = true;
    const r = await api('quitarArchivo', { id: F.id, archivo_id: b.dataset.ex });
    if (!r.ok) { b.disabled = false; return aviso(r.error); }
    F.existentes = r.evidencia.archivos; pintarLista();
  }
  async function agregarArchivos(lista) {
    const ay = document.getElementById('arch-ay'); ay.classList.remove('mal'); ay.textContent = ay.dataset.orig;
    for (const f of lista) {
      if (F.existentes.length + F.nuevos.length >= MAX_ARCHIVOS) { ay.textContent = `Solo se pueden adjuntar ${MAX_ARCHIVOS} archivos por actividad.`; ay.classList.add('mal'); break; }
      try { F.nuevos.push(await prepararArchivo(f)); } catch (e) { ay.textContent = `${f.name}: ${e.message}`; ay.classList.add('mal'); }
    }
    pintarLista();
  }
  function aBase64(blob) {
    return new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => mal(new Error('No se pudo leer el archivo.')); r.readAsDataURL(blob); });
  }
  // Foto reducida a ≤ 1600 px y, aparte, una miniatura de ≤ 320 px para la galería de la Secretaría.
  async function prepararArchivo(f) {
    if (f.type === 'application/pdf') {
      if (f.size > MAX_PDF) throw new Error('el PDF pesa más de 4 MB.');
      return { cid: uuid(), nombre: f.name, mime: 'application/pdf', tam: f.size, b64: await aBase64(f), url: '', mini: '' };
    }
    if (!/^image\//.test(f.type)) throw new Error('solo se aceptan fotografías y PDF.');
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { throw new Error('no se pudo abrir esta imagen. Use una foto JPEG o PNG.'); }
    const lienzo = lado => { const k = Math.min(1, lado / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c; };
    const c = lienzo(MAX_LADO), mini = lienzo(320).toDataURL('image/jpeg', 0.7);
    bmp.close && bmp.close();
    let blob = null;
    for (const q of [0.82, 0.68, 0.5]) { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= MAX_IMG) break; }
    if (!blob || blob.size > MAX_IMG) throw new Error('la foto sigue pesando más de 3 MB.');
    return { cid: uuid(), nombre: f.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', tam: blob.size, b64: await aBase64(blob), url: URL.createObjectURL(blob), mini: mini.length <= 45000 ? mini : '' };
  }
  const subir = (id, a) => api('subirArchivo', { id, cid: a.cid, nombre: a.nombre, mime: a.mime, contenido_base64: a.b64, miniatura: a.mini || undefined });

  function leerFormulario() {
    return { actividad: document.getElementById('act').value, fecha_actividad: document.getElementById('fecha').value,
      participantes: document.getElementById('part').value.trim(), descripcion: document.getElementById('desc').value.trim(),
      enlace: document.getElementById('enlace').value.trim(), autoriza_imagen: document.getElementById('conf').checked };
  }
  function validarFormulario(d) {
    const e = {};
    if (!d.actividad) e.act = 'Elija la actividad.';
    if (!d.fecha_actividad) e.fecha = 'Escriba la fecha en que se realizó.';
    else if (d.fecha_actividad > hoy()) e.fecha = 'La fecha no puede ser posterior a hoy.';
    if (!/^\d{1,4}$/.test(d.participantes) && d.participantes !== '5000') e.part = 'Escriba un número entero, por ejemplo 35.';
    if (d.descripcion.length < 10) e.desc = 'Cuente brevemente qué se hizo (al menos 10 caracteres).';
    if (d.enlace && !/^https?:\/\/\S+$/i.test(d.enlace)) e.enlace = 'El enlace debe empezar por http:// o https://.';
    if (!d.enlace && F.existentes.length + F.nuevos.length === 0) e.arch = 'Agregue al menos una fotografía o PDF, o el enlace al video.';
    if (!d.autoriza_imagen) e.conf = 'Marque la casilla para poder guardar.';
    return e;
  }
  async function enviarFormulario(ev) {
    ev.preventDefault();
    const form = ev.target, btn = document.getElementById('b-enviar'), err = document.getElementById('envio-error');
    limpiarErrores(form); err.textContent = ''; err.classList.remove('mal');
    const d = leerFormulario(), errs = validarFormulario(d), claves = Object.keys(errs);
    if (claves.length) {
      claves.forEach(k => { const c = document.getElementById(k === 'conf' ? 'c-conf' : 'c-' + k), ay = document.getElementById(k + '-ay'); c.classList.add('mal'); ay.textContent = errs[k]; ay.classList.add('mal'); });
      const primero = document.getElementById(claves[0] === 'arch' ? 'b-arch' : claves[0]); if (primero) primero.focus(); return;
    }
    const original = btn.textContent; btn.disabled = true; btn.textContent = 'Guardando…';
    const r = F.id ? await api('editarEvidencia', Object.assign({ id: F.id }, d)) : await api('crearEvidencia', Object.assign({ cid: F.cid }, d));
    if (!r.ok) { btn.disabled = false; btn.textContent = original; err.textContent = r.error; err.classList.add('mal'); return; }
    const id = r.evidencia.id, fallos = [];
    for (let i = 0; i < F.nuevos.length; i++) {
      btn.textContent = `Subiendo archivo ${i + 1} de ${F.nuevos.length}…`;
      const s = await subir(id, F.nuevos[i]);
      if (!s.ok) fallos.push(`${F.nuevos[i].nombre}: ${s.error}`);
    }
    F.nuevos.forEach(a => a.url && URL.revokeObjectURL(a.url));
    MENSAJE = fallos.length
      ? `El registro quedó guardado, pero ${fallos.length === 1 ? 'un archivo no se pudo subir' : fallos.length + ' archivos no se pudieron subir'} (${fallos.join('; ')}). Agréguelos con «Agregar archivos».`
      : (F.id ? 'Corrección guardada.' : 'Registro guardado.');
    location.hash = '#evidencia/' + id;
  }

  /* ── Detalle de un registro (institución y Secretaría): las fotos se muestran solas ── */
  function datosEvidencia(e, conInstitucion) {
    return `<dl class="datos">
      ${conInstitucion ? `<dt>Institución</dt><dd>${esc(e.institucion)}<br><small class="peq" style="color:var(--t3)">${esc(nomMun(codMun(e), e.municipio))} · <span translate="no">${dane(e.dane_ie)}</span></small></dd>` : ''}
      <dt>Fecha de la actividad</dt><dd>${esc(fecha(e.fecha_actividad))}</dd>
      <dt>Participantes</dt><dd class="n">${num(e.participantes)}</dd>
      <dt>Qué se hizo</dt><dd>${esc(e.descripcion)}</dd>
      ${e.enlace ? `<dt>Enlace</dt><dd><a href="${esc(e.enlace)}" target="_blank" rel="noopener noreferrer">${esc(e.enlace)}</a></dd>` : ''}
      <dt>Registrada</dt><dd>${esc(fechaHora(e.registrado))}</dd>
      ${e.version > 1 ? `<dt>Corregida</dt><dd>${esc(fechaHora(e.actualizado))} · versión ${e.version}</dd>` : ''}</dl>`;
  }
  const b64aUrl = (b64, mime) => { const bin = atob(b64), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([by], { type: mime })); };
  async function cargarFotos(e) {
    for (const a of e.archivos) {
      const caja = document.getElementById('f-' + a.id); if (!caja) return;     // la pantalla cambió
      if (a.mime === 'application/pdf') continue;
      const r = await api('verArchivo', { id: e.id, archivo_id: a.id });
      const ahora = document.getElementById('f-' + a.id); if (!ahora) return;
      ahora.innerHTML = r.ok ? `<img src="${b64aUrl(r.contenido_base64, r.mime)}" alt="Fotografía adjunta: ${esc(a.nombre)}">` : esc(r.error);
    }
  }
  async function vistaEvidencia(id) {
    cargando();
    const revisor = S.rol === 'REVISOR';
    let e;
    if (revisor) { await traerTodo(); e = TODO.evidencias.find(x => x.id === id); }
    else { const r = await api('misEvidencias'); e = r.ok && r.evidencias.find(x => x.id === id); }
    if (!e) { location.hash = revisor ? '#evidencias' : '#inicio'; return; }
    const volver = revisor ? '#evidencias' : '#inicio';
    const fotos = e.archivos.map(a => `<figure><div class="img" id="f-${esc(a.id)}">${a.mime === 'application/pdf' ? `<button type="button" class="btn" data-pdf="${esc(a.id)}">Abrir el PDF</button>` : 'Cargando…'}</div>
      <figcaption>${esc(a.nombre)} · ${tam(a.tamano)}</figcaption></figure>`).join('');
    pintar(e.actividad, `
      <div class="angosto">
      <p class="migas"><a href="${volver}">${revisor ? 'Evidencias' : 'Inicio'}</a> / ${esc(e.actividad)}</p>
      <div class="cab densa"><div><h1>${esc(e.actividad)}</h1><p>${revisor ? esc(e.institucion) : 'Registro de su institución'}</p></div>
        <div class="der">${revisor ? '' : `<a class="btn" href="#registrar?e=${esc(e.id)}">Corregir el registro</a>`}</div></div>
      ${MENSAJE ? `<p class="cita" role="status">${esc(MENSAJE)}</p>` : ''}
      <section class="panel">${datosEvidencia(e, revisor)}</section>
      <section class="panel"><h2>Evidencias adjuntas</h2>
        ${e.archivos.length ? `<div class="fotos-det" id="fotos">${fotos}</div>` : `<p class="sub" style="margin:0">Sin archivos adjuntos${e.enlace ? '; la evidencia es el enlace de arriba' : ''}.</p>`}
        ${revisor ? '' : `<div style="margin-top:16px"><button type="button" class="btn" id="b-mas">Agregar archivos</button><input type="file" id="i-mas" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple hidden>
          <div class="ayuda mal" id="mas-ay" role="alert"></div></div>`}</section></div>`);
    MENSAJE = '';
    const cont = document.getElementById('fotos');
    if (cont) cont.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-pdf]'); if (!b) return;
      b.disabled = true; b.textContent = 'Cargando…';
      const r = await api('verArchivo', { id: e.id, archivo_id: b.dataset.pdf });
      const caja = document.getElementById('f-' + b.dataset.pdf);
      caja.innerHTML = r.ok ? `<a class="enlace-sutil" href="${b64aUrl(r.contenido_base64, r.mime)}" target="_blank" rel="noopener">Abrir el PDF en otra pestaña</a>` : esc(r.error);
    });
    cargarFotos(e);
    if (!revisor) {
      const entrada = document.getElementById('i-mas'), ay = document.getElementById('mas-ay'), b = document.getElementById('b-mas');
      b.addEventListener('click', () => entrada.click());
      entrada.addEventListener('change', async () => {
        const archivos = [...entrada.files]; entrada.value = ''; ay.textContent = '';
        if (e.archivos.length + archivos.length > MAX_ARCHIVOS) { ay.textContent = `Solo se pueden adjuntar ${MAX_ARCHIVOS} archivos por actividad.`; return; }
        b.disabled = true; const fallos = [];
        for (let i = 0; i < archivos.length; i++) {
          b.textContent = `Subiendo archivo ${i + 1} de ${archivos.length}…`;
          try { const a = await prepararArchivo(archivos[i]); const s = await subir(e.id, a); if (!s.ok) fallos.push(`${a.nombre}: ${s.error}`); }
          catch (x) { if (x.message === 'sesion') return; fallos.push(`${archivos[i].name}: ${x.message}`); }
        }
        MENSAJE = fallos.length ? 'No se pudieron subir: ' + fallos.join('; ') : 'Archivos agregados.';
        vistaEvidencia(e.id);
      });
    }
  }

  /* ── Secretaría: datos compartidos por las tres pantallas ── */
  async function traerTodo(forzar) {
    if (TODO && !forzar && Date.now() - TODO.en < VIGENCIA_TODO_MS) return TODO;
    const r = await api('listarTodo');
    if (!r.ok) throw new Error(r.error);
    if (r.usuario) { S.usuario = r.usuario; guardarSesion(); barra(parsear().partes[0]); }
    TODO = Object.assign(r, { en: Date.now() });
    return TODO;
  }
  function calcular(t) {
    const N = t.instituciones.length, ev = t.evidencias;
    const primera = {}; ev.forEach(e => { if (!primera[e.dane_ie] || e.registrado < primera[e.dane_ie]) primera[e.dane_ie] = e.registrado; });
    const con = new Set(Object.keys(primera)), rep = t.instituciones.filter(i => con.has(i.dane_ie));
    const hace7 = sumarDias(hoy(), -7);
    const M = {};
    t.instituciones.forEach(i => { const c = codMun(i); (M[c] = M[c] || { cod: c, nombre: nomMun(c, i.municipio), n: 0, rep: 0, reg: 0 }).n++; if (con.has(i.dane_ie)) M[c].rep++; });
    ev.forEach(e => { const m = M[codMun(e)]; if (m) m.reg++; });
    const munis = Object.values(M).map(m => Object.assign(m, { p: m.rep / m.n }));
    return { N, ev, con, nCon: rep.length, nuevas7: rep.filter(i => primera[i.dane_ie].slice(0, 10) > hace7).length,
      mat: t.instituciones.reduce((s, i) => s + (i.matricula || 0), 0), matCon: rep.reduce((s, i) => s + (i.matricula || 0), 0),
      participantes: ev.reduce((s, e) => s + e.participantes, 0), munis };
  }
  const universo = t => `${num(t.instituciones.length)} instituciones educativas oficiales de Caldas con sedes en la base maestra (sin Manizales, que es secretaría certificada), contadas por código DANE de institución`;
  const cabSecretaria = (titulo, bajada, extra) => `<div class="cab"><div><h1>${titulo}</h1><p>${bajada}</p></div>
    <div class="der">${extra || ''}<button type="button" class="btn" id="b-actualizar">Actualizar</button></div></div>`;
  function enlazarActualizar(fn) { const b = document.getElementById('b-actualizar'); if (b) b.addEventListener('click', async () => { b.disabled = true; await traerTodo(true); fn(); aviso('Datos actualizados.'); }); }
  const sembrarBtn = ev => (API.demo() && !ev.length ? `<p class="cita"><b>Modo de demostración, sin datos todavía.</b> <button type="button" class="btn" id="b-sembrar" style="margin-left:8px">Cargar datos de ejemplo</button></p>` : demoNota());
  function enlazarSembrar(fn) { const b = document.getElementById('b-sembrar'); if (b) b.addEventListener('click', async () => { window.DEMO.sembrar(); await traerTodo(true); aviso('Se cargaron datos de ejemplo.'); fn(); }); }

  // Miniaturas: se piden de a 24 y se guardan para no volver a pedirlas
  async function cargarMiniaturas(raiz) {
    const faltan = [...raiz.querySelectorAll('[data-mini]')].map(x => x.dataset.mini).filter(id => !(id in MINI));
    for (let i = 0; i < faltan.length; i += 24) {
      const r = await api('verMiniaturas', { ids: faltan.slice(i, i + 24) });
      faltan.slice(i, i + 24).forEach(id => { MINI[id] = (r.ok && r.miniaturas[id]) || ''; });
    }
    raiz.querySelectorAll('[data-mini]').forEach(x => { const m = MINI[x.dataset.mini]; if (m && !x.querySelector('img')) x.innerHTML = `<img src="${m}" alt="">`; else if (!m) x.textContent = 'Sin foto'; });
  }
  const figura = (e, tarjeta) => `<a class="foto" href="#evidencia/${esc(e.id)}"><span class="img" ${e.con_miniatura ? `data-mini="${esc(e.id)}"` : ''}>${e.con_miniatura ? 'Cargando…' : (e.enlace ? 'Video o enlace' : 'Sin foto')}</span>
    <b>${esc(e.actividad)}</b><small>${esc(e.institucion)}</small><small>${esc(nomMun(codMun(e), e.municipio))} · ${tarjeta ? esc(fecha(e.fecha_actividad)) : hace(e.registrado)}</small></a>`;

  /* Registros por día, desde dos semanas atrás hasta el cierre de los 16 días de activismo */
  function graficoDias(ev) {
    const hoyIso = hoy(), primero = ev.reduce((m, e) => (e.registrado.slice(0, 10) < m ? e.registrado.slice(0, 10) : m), sumarDias(hoyIso, -13));
    // Antes del 25 de noviembre el eje llega hasta ese día; después, hasta el cierre de los 16 días de activismo.
    const fin = hoyIso < CFG.DIA ? sumarDias(CFG.DIA, 1) : (CFG.FIN > hoyIso ? CFG.FIN : hoyIso), dias = difDias(primero, fin) + 1;
    const cuenta = {}; ev.forEach(e => { const d = e.registrado.slice(0, 10); cuenta[d] = (cuenta[d] || 0) + 1; });
    const W = 720, H = 230, L = 30, R = 8, T = 30, B = 30, iw = W - L - R, ih = H - T - B, bw = iw / dias;
    const max = Math.max(4, ...Object.values(cuenta)), tope = Math.ceil(max / 4) * 4, y = v => T + ih - (v / tope) * ih;
    const x = i => L + i * bw, idx = iso => difDias(primero, iso);
    let s = '';
    const iHoy = idx(hoyIso);
    if (iHoy < dias - 1) s += `<rect class="futuro" x="${x(iHoy + 1)}" y="${T}" width="${(dias - iHoy - 1) * bw}" height="${ih}" rx="6"/><text x="${x(iHoy + 1) + 8}" y="${T + 16}">Por venir</text>`;
    [0, tope / 2, tope].forEach(v => { s += `<line class="eje" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
    for (let i = 0; i <= Math.min(iHoy, dias - 1); i++) {
      const d = sumarDias(primero, i), v = cuenta[d] || 0; if (!v) continue;
      s += `<rect class="bar${i === iHoy ? ' hoy' : ''}" x="${x(i) + bw * 0.16}" y="${y(v)}" width="${bw * 0.68}" height="${y(0) - y(v)}" rx="2"><title>${diaMes(d)}: ${v} ${plural(v, 'registro', 'registros')}</title></rect>`;
      if (bw >= 14) s += `<text class="val" x="${x(i) + bw / 2}" y="${y(v) - 5}" text-anchor="middle">${v}</text>`;
    }
    for (let i = 0; i < dias; i += 7) s += `<text x="${x(i) + bw / 2}" y="${H - 8}" text-anchor="middle">${diaCorto(sumarDias(primero, i))}</text>`;
    const iDia = idx(CFG.DIA);
    if (iDia >= 0 && iDia < dias) s += `<line class="marca" x1="${x(iDia) + bw / 2}" x2="${x(iDia) + bw / 2}" y1="${T - 12}" y2="${T + ih}"/><text class="marca-tx" x="${x(iDia) + bw / 2 + (iDia > dias * 0.75 ? -6 : 6)}" y="${T - 2}" text-anchor="${iDia > dias * 0.75 ? 'end' : 'start'}">25 de noviembre</text>`;
    s += `<text x="${x(Math.min(iHoy, dias - 1)) + bw / 2}" y="${H - 8 - 14}" text-anchor="middle" style="fill:var(--t1);font-weight:600">hoy</text>`;
    const dias_con = Object.keys(cuenta).length, mejor = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
    const titulo = !ev.length ? 'Aún no hay registros' : `${num(ev.length)} ${plural(ev.length, 'actividad registrada', 'actividades registradas')} en ${dias_con} ${plural(dias_con, 'día', 'días')}; el día con más registros fue el ${diaMes(mejor[0])} (${mejor[1]})`;
    const filas = Object.entries(cuenta).sort().map(([d, v]) => `<tr><td>${esc(fecha(d))}</td><td class="d">${v}</td></tr>`).join('');
    return { titulo, svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Registros por día. ${esc(titulo)}">${s}</svg>`,
      tabla: `<details class="datos-graf"><summary>Ver los datos por día</summary><div class="tabla-scroll"><table class="tabla densa"><thead><tr><th>Día</th><th class="d">Registros</th></tr></thead><tbody>${filas}</tbody></table></div></details>` };
  }
  function cifraPlazo() {
    const h = hoy();
    if (h < CFG.DIA) { const n = difDias(h, CFG.DIA); return { et: 'Para el 25 de noviembre', b: `${n} ${plural(n, 'día', 'días')}`, de: `después siguen los 16 días de activismo, hasta el ${diaMes(CFG.FIN)}` }; }
    if (h <= CFG.FIN) { const n = difDias(CFG.DIA, h) + 1; return { et: 'Días de activismo', b: `Día ${n} de 16`, de: `terminan el ${diaMes(CFG.FIN)}` }; }
    return { et: 'Campaña', b: 'Terminada', de: `los 16 días de activismo terminaron el ${diaMes(CFG.FIN)}` };
  }

  /* ── Pantalla 1: Resumen ── */
  async function vistaResumen() {
    cargando();
    const t = await traerTodo(), c = calcular(t), ev = c.ev, plazo = cifraPlazo(), g = graficoDias(ev);
    const porAct = CFG.ACTIVIDADES.map(a => { const l = ev.filter(e => e.actividad === a.nombre); return { nombre: a.nombre, n: l.length, ies: new Set(l.map(e => e.dane_ie)).size }; });
    const maxAct = Math.max(1, ...porAct.map(x => x.n));
    const recientes = [...ev].filter(e => e.con_miniatura).sort((a, b) => (a.registrado < b.registrado ? 1 : -1)).slice(0, 8);
    const munis = [...c.munis].sort((a, b) => a.p - b.p || b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
    const bajos = munis.filter(m => m.p < 1).slice(0, 3).map(m => m.nombre);
    const tituloMun = !bajos.length ? 'Todas las instituciones de todos los municipios ya reportaron' : `Faltan más en ${bajos.length > 1 ? bajos.slice(0, -1).join(', ') + ' y ' + bajos[bajos.length - 1] : bajos[0]}`;
    const pbar = (a, b) => `<span class="barrita" aria-hidden="true"><i style="width:${b ? Math.round(100 * a / b) : 0}%"></i></span>`;
    pintar('Resumen', `
      ${cabSecretaria('Resumen de la campaña', `Universo: ${esc(universo(t))}. Datos consultados a las ${horaDe(new Date(t.en))}`)}
      ${sembrarBtn(ev)}
      <section class="panel cifras" aria-label="Cifras principales">
        <div><span class="et">Instituciones que ya reportaron</span><b class="n">${num(c.nCon)}</b>${pbar(c.nCon, c.N)}<span class="de">de ${num(c.N)} instituciones oficiales, el ${pct(c.N ? c.nCon / c.N : 0)}</span>
          <span class="tend${c.nuevas7 ? '' : ' cero'}">${c.nuevas7 ? `${num(c.nuevas7)} más en los últimos 7 días` : 'Ninguna nueva en los últimos 7 días'}</span><a href="#pendientes">Ver las ${num(c.N - c.nCon)} que faltan</a></div>
        <div><span class="et">Estudiantes en esas instituciones</span><b class="n">${num(c.matCon)}</b>${pbar(c.matCon, c.mat)}<span class="de">de ${num(c.mat)} matriculados en el universo, el ${pct(c.mat ? c.matCon / c.mat : 0)}</span><a href="#panel" id="ir-munis">Ver por municipio</a></div>
        <div><span class="et">Participantes en las actividades</span><b class="n">${num(c.participantes)}</b><span class="de">en ${num(ev.length)} ${plural(ev.length, 'actividad', 'actividades')}${ev.length ? `, ${num(Math.round(c.participantes / ev.length))} en promedio` : ''}; suma de lo que reporta cada institución</span><a href="#evidencias">Ver las evidencias</a></div>
        <div class="plazo"><span class="et">${plazo.et}</span><b class="n">${plazo.b}</b><span class="de">${plazo.de}</span></div>
      </section>
      <div class="rejilla">
        <section class="panel c8 grafico"><h2>${esc(g.titulo)}</h2><p class="sub">Registros guardados por día. La línea naranja marca el 25 de noviembre.</p>${g.svg}${g.tabla}</section>
        <section class="panel c4"><h2>Qué actividades se hicieron</h2><p class="sub">Registros de cada actividad y en cuántas instituciones.</p>
          <ul class="mini-lista">${porAct.map(a => `<li><div class="fila-n"><b>${esc(a.nombre)}</b><span class="n">${num(a.n)}</span></div><div class="m-barra" aria-hidden="true"><i style="width:${Math.round(100 * a.n / maxAct)}%"></i></div><small>${a.ies ? `en ${a.ies} ${plural(a.ies, 'institución', 'instituciones')}` : 'ninguna institución todavía'}</small></li>`).join('')}</ul></section>
      </div>
      <section class="panel"><div class="cab-panel"><h2>Lo más reciente de las instituciones</h2><a href="#evidencias">Ver todas las evidencias</a></div>
        <p class="sub">Las últimas ${recientes.length} actividades registradas con fotografía.</p>
        ${recientes.length ? `<div class="galeria" id="gal">${recientes.map(e => figura(e, false)).join('')}</div>` : vacio('Aún no hay fotografías', 'Aparecerán aquí cuando las instituciones registren sus actividades.')}</section>
      <section class="panel" id="munis"><div class="cab-panel"><h2>${esc(tituloMun)}</h2><a href="#pendientes">Ver las instituciones sin reportar</a></div>
        <p class="sub">Instituciones que ya reportaron sobre las de cada municipio, de menor a mayor avance. Cada municipio lleva a sus instituciones pendientes.</p>
        <ul class="munis">${munis.map(m => `<li><a href="#pendientes?mun=${m.cod}"><span class="nom">${esc(m.nombre)}</span><span class="pista" role="img" aria-label="${m.rep} de ${m.n}"><i style="width:${Math.round(m.p * 100)}%"></i></span><span class="cuenta">${m.rep} de ${m.n}</span></a></li>`).join('')}</ul></section>`);
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    document.getElementById('ir-munis').addEventListener('click', ev => { ev.preventDefault(); document.getElementById('munis').scrollIntoView({ behavior: 'smooth' }); });
    enlazarActualizar(vistaResumen); enlazarSembrar(vistaResumen);
    const gal = document.getElementById('gal'); if (gal) cargarMiniaturas(gal);
  }

  /* ── Pantalla 2: Evidencias ── */
  async function vistaEvidencias(q) {
    cargando();
    const t = await traerTodo(), ev = t.evidencias;
    const ver = q.ver === 'tabla' ? 'tabla' : 'galeria', fMun = q.mun || '', fAct = q.act || '', fTxt = q.q || '';
    const municipios = [...new Set(t.instituciones.map(i => codMun(i)))].sort((a, b) => nomMun(a).localeCompare(nomMun(b), 'es'));
    const filas = ev.filter(e => (!fMun || codMun(e) === fMun) && (!fAct || e.actividad === fAct) && (!fTxt || norm(e.institucion).includes(norm(fTxt))))
      .sort((a, b) => (a.registrado < b.registrado ? 1 : -1));
    const href = o => { const p = Object.assign({ ver, mun: fMun, act: fAct, q: fTxt }, o); return '#evidencias?' + Object.keys(p).filter(k => p[k] && !(k === 'ver' && p[k] === 'galeria')).map(k => k + '=' + encodeURIComponent(p[k])).join('&'); };
    const opt = (valores, sel, todos, et) => `<option value="">${todos}</option>` + valores.map(x => `<option value="${esc(x)}"${x === sel ? ' selected' : ''}>${esc(et ? et(x) : x)}</option>`).join('');
    const visibles = filas.slice(0, limiteGaleria);
    const cuerpo = !filas.length ? `<section class="panel">${vacio(ev.length ? 'No hay registros con esos filtros' : 'Aún no hay registros', ev.length ? 'Pruebe con otros filtros.' : 'Cuando una institución guarde una actividad, aparecerá aquí.')}</section>`
      : ver === 'galeria'
        ? `<div class="galeria tarjetas" id="gal">${visibles.map(e => figura(e, true)).join('')}</div>${filas.length > visibles.length ? `<p style="margin-top:16px;text-align:center"><button type="button" class="btn" id="b-mas">Mostrar ${Math.min(POR_PAGINA, filas.length - visibles.length)} más</button></p>` : ''}`
        : `<section class="panel"><div class="tabla-scroll alto"><table class="tabla densa"><thead><tr><th>Registrada</th><th>Institución</th><th>Actividad</th><th class="d">Participantes</th><th class="d">Archivos</th><th><span class="oculto">Acción</span></th></tr></thead><tbody>${filas.map(e => `<tr>
          <td>${esc(fechaHora(e.registrado))}</td><td>${esc(e.institucion)}<span class="sec">${esc(nomMun(codMun(e), e.municipio))}</span></td><td>${esc(e.actividad)}</td>
          <td class="d">${num(e.participantes)}</td><td class="d">${e.archivos.length}</td><td><a class="btn sutil" href="#evidencia/${esc(e.id)}">Ver<span class="oculto"> ${esc(e.institucion)}, ${esc(e.actividad)}</span></a></td></tr>`).join('')}</tbody></table></div></section>`;
    pintar('Evidencias', `
      ${cabSecretaria('Evidencias registradas', `${num(ev.length)} ${plural(ev.length, 'registro', 'registros')} de ${num(new Set(ev.map(e => e.dane_ie)).size)} de las ${num(t.instituciones.length)} instituciones del universo. Datos consultados a las ${horaDe(new Date(t.en))}`,
        `<button type="button" class="btn" id="b-csv">Descargar para Excel</button>`)}
      ${sembrarBtn(ev)}
      <section class="panel"><form class="filtros" id="f-filtros" role="search">
        <div class="campo"><label for="f-q">Institución</label><input id="f-q" type="search" value="${esc(fTxt)}" placeholder="Buscar por nombre"></div>
        <div class="campo"><label for="f-mun">Municipio</label><select id="f-mun">${opt(municipios, fMun, 'Todos los municipios', nomMun)}</select></div>
        <div class="campo"><label for="f-act">Actividad</label><select id="f-act">${opt(t.actividades, fAct, 'Todas las actividades')}</select></div>
        <div class="der"><div class="seg" role="group" aria-label="Cómo ver"><button type="button" data-ver="galeria" aria-pressed="${ver === 'galeria'}">Fotos</button><button type="button" data-ver="tabla" aria-pressed="${ver === 'tabla'}">Tabla</button></div></div>
      </form><p class="sub" role="status" style="margin:0">${num(filas.length)} ${plural(filas.length, 'registro', 'registros')}${fMun || fAct || fTxt ? ' con los filtros elegidos' : ''}.</p></section>
      ${cuerpo}`);
    enlazarActualizar(() => vistaEvidencias(q)); enlazarSembrar(() => vistaEvidencias(q));
    document.getElementById('b-csv').addEventListener('click', () => descargarCSV('registros', filas));
    main.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => { location.hash = href({ ver: b.dataset.ver }); }));
    [['f-mun', 'mun'], ['f-act', 'act']].forEach(([id, k]) => document.getElementById(id).addEventListener('change', ev => { limiteGaleria = POR_PAGINA; location.hash = href({ [k]: ev.target.value }); }));
    document.getElementById('f-filtros').addEventListener('submit', ev => { ev.preventDefault(); limiteGaleria = POR_PAGINA; location.hash = href({ q: document.getElementById('f-q').value.trim() }); });
    const fq = document.getElementById('f-q'); fq.addEventListener('search', () => { location.hash = href({ q: fq.value.trim() }); });
    const mas = document.getElementById('b-mas'); if (mas) mas.addEventListener('click', () => { limiteGaleria += POR_PAGINA; const y = window.scrollY; vistaEvidencias(q).then(() => window.scrollTo(0, y)); });
    const gal = document.getElementById('gal'); if (gal) cargarMiniaturas(gal);
  }

  /* ── Pantalla 3: Sin reportar ── */
  async function vistaPendientes(q) {
    cargando();
    const t = await traerTodo(), c = calcular(t), fMun = q.mun || '';
    const faltan = t.instituciones.filter(i => !c.con.has(i.dane_ie) && (!fMun || codMun(i) === fMun));
    const grupos = {}; faltan.forEach(i => { const k = codMun(i); (grupos[k] = grupos[k] || []).push(i); });
    const orden = Object.keys(grupos).sort((a, b) => nomMun(a).localeCompare(nomMun(b), 'es'));
    const municipios = [...new Set(t.instituciones.map(i => codMun(i)))].sort((a, b) => nomMun(a).localeCompare(nomMun(b), 'es'));
    const total = m => c.munis.find(x => x.cod === m) || { n: 0 };
    const matFaltan = faltan.reduce((s, i) => s + (i.matricula || 0), 0);
    pintar('Sin reportar', `
      ${cabSecretaria('Instituciones sin reportar', `${num(c.N - c.nCon)} de las ${num(c.N)} instituciones del universo aún no registran ninguna actividad. Datos consultados a las ${horaDe(new Date(t.en))}`,
        `<button type="button" class="btn" id="b-csv">Descargar para Excel</button>`)}
      ${demoNota()}
      <section class="panel"><div class="filtros" style="margin-bottom:8px"><div class="campo" style="max-width:340px"><label for="f-mun">Municipio</label><select id="f-mun"><option value="">Todos los municipios</option>${municipios.map(m => `<option value="${m}"${m === fMun ? ' selected' : ''}>${esc(nomMun(m))}</option>`).join('')}</select></div></div>
        <p class="sub" role="status">${num(faltan.length)} ${plural(faltan.length, 'institución', 'instituciones')}${fMun ? ` en ${esc(nomMun(fMun))}` : ''}, con ${num(matFaltan)} estudiantes matriculados.</p>
        ${faltan.length ? `<div class="tabla-scroll"><table class="tabla densa"><thead><tr><th>Institución</th><th>Código DANE</th><th class="d">Sedes</th><th class="d">Matrícula</th></tr></thead><tbody>
          ${orden.map(k => `<tr class="grupo"><th colspan="4" scope="colgroup">${esc(nomMun(k))}<small>${grupos[k].length} de ${total(k).n} sin reportar</small></th></tr>` +
            grupos[k].sort((a, b) => a.institucion.localeCompare(b.institucion, 'es')).map(i => `<tr><td>${esc(i.institucion)}</td><td class="n" translate="no">${dane(i.dane_ie)}</td><td class="d">${i.num_sedes}</td><td class="d">${num(i.matricula || 0)}</td></tr>`).join('')).join('')}
          </tbody></table></div>` : vacio(fMun ? 'Todas las instituciones de este municipio ya reportaron' : 'Todas las instituciones ya reportaron', '')}</section>`);
    enlazarActualizar(() => vistaPendientes(q));
    document.getElementById('f-mun').addEventListener('change', ev => { location.hash = ev.target.value ? '#pendientes?mun=' + ev.target.value : '#pendientes'; });
    document.getElementById('b-csv').addEventListener('click', () => descargarCSV('sin_reportar', faltan));
  }

  function descargarCSV(tipo, filas) {
    const cel = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    const texto = d => '="' + d + '"';   // Excel no convierte el código DANE a notación científica
    const sin = tipo === 'sin_reportar';
    const enc = sin ? ['Municipio', 'Institución', 'Código DANE I.E.', 'Sedes', 'Matrícula']
      : ['Registrada', 'Municipio', 'Institución', 'Código DANE I.E.', 'Actividad', 'Fecha de la actividad', 'Participantes', 'Archivos', 'Enlace', 'Versión', 'Descripción'];
    const cuerpo = filas.map(f => (sin
      ? [cel(nomMun(codMun(f))), cel(f.institucion), texto(f.dane_ie), f.num_sedes, f.matricula || 0]
      : [cel(f.registrado.replace('T', ' ')), cel(nomMun(codMun(f), f.municipio)), cel(f.institucion), texto(f.dane_ie), cel(f.actividad), cel(f.fecha_actividad), f.participantes, f.archivos.length, cel(f.enlace), f.version, cel(f.descripcion)]).join(';'));
    const blob = new Blob(['﻿' + enc.map(cel).join(';') + '\r\n' + cuerpo.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `evidencias25N_${tipo}_${hoy()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  router();
})();
