/* js/app.js — Evidencias 25N, propuesta 4 (aprobada el 2026-11-09): carrusel y visor de fotos, cierre del reporte por la
   institución y página de cada institución para la Secretaría.
   Institución:  #ingreso · #inicio · #registrar?a=N | ?e=ID · #evidencia/ID
   Secretaría:   #secretaria · #panel · #evidencias · #pendientes · #institucion/DANE · #evidencia/ID   (solo consulta) */
(function () {
  'use strict';
  const CFG = window.CONFIG, API = window.API;
  const main = document.getElementById('contenido'), shell = document.getElementById('shell'), avisoEl = document.getElementById('aviso');
  const LLAVE = 'ev25n_sesion';
  const MAX_ARCHIVOS = 10, MAX_LADO = 1600, MAX_IMG = 3 * 1024 * 1024, MAX_PDF = 4 * 1024 * 1024;
  const VIGENCIA_TODO_MS = 2 * 60 * 1000, POR_PAGINA = 24, DUR_FOTO = 6500;
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let S = null; try { S = JSON.parse(sessionStorage.getItem(LLAVE)); } catch (e) { S = null; }
  let TODO = null, MENSAJE = '', F = null, LOGIN = { correo: '' }, limiteGaleria = POR_PAGINA;
  let ANIM_QUIETA = RM;       // la ilustración arranca quieta si el equipo pide menos movimiento
  const MINI = {};            // miniaturas por foto: id del archivo → data URI
  const FULL = new Map(), EN_CURSO = new Map();   // fotos grandes ya traídas (máximo 40)

  /* ── Utilidades ── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dane = d => String(d).replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');
  const nf = new Intl.NumberFormat('es-CO');
  const num = n => nf.format(n);
  const pctDe = (a, b) => { if (!b || !a) return '0 %'; const p = a / b; return p < 0.01 ? 'menos del 1 %' : Math.round(p * 100) + ' %'; };
  const fechaUTC = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fecha = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fechaUTC(iso));
  const diaMes = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(fechaUTC(iso));
  const diaCorto = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(fechaUTC(iso)).replace('.', '');
  const fechaHora = iso => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fechaLarga = iso => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
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
  const lista = l => (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0] || '');
  let _porNombre = null;
  // El municipio sale del nombre que trae fctMaestra, no del código DANE (3 instituciones reales llevan el código de otro municipio).
  const codMun = o => {
    if (!_porNombre) { _porNombre = {}; window.MAPA.munis.forEach(m => { _porNombre[norm(m.name)] = m.code; }); }
    return _porNombre[norm(o.municipio || '')] || String(o.dane_ie).slice(1, 6);
  };
  const nomMun = (cod, resp) => { const m = window.MAPA && window.MAPA.munis.find(x => x.code === cod); return m ? m.name : resp || cod; };
  const $ = id => document.getElementById(id);
  const esImg = a => a.mime !== 'application/pdf';
  const recientes = ev => [...ev].sort((a, b) => (a.registrado < b.registrado ? 1 : -1));
  const imagenes = ev => recientes(ev).flatMap(e => e.archivos.filter(esImg).map(a => ({ e, a })));
  const primeraFoto = e => e.archivos.find(esImg);

  // Estados de una institución: cada uno con su color y su palabra, igual en todas las pantallas.
  const ESTADO = {
    fin: { k: 'ok', chip: 'e-ok', et: 'Finalizó', larga: 'finalizaron su reporte' },
    rep: { k: 'bor', chip: 'e-bor', et: 'Sin finalizar', larga: 'tienen registros pero no han finalizado' },
    sin: { k: 'gris', chip: 'e-gris', et: 'Sin reportar', larga: 'no han reportado' }
  };
  const chipEstado = k => `<span class="chip ${ESTADO[k].chip}">${ESTADO[k].et}</span>`;
  const barra3 = (c, total, alto) => `<span class="barra3${alto ? ' alta' : ''}" role="img" aria-label="${c.fin} finalizaron, ${c.rep} sin finalizar y ${c.sin} sin reportar, de ${total}">${['fin', 'rep', 'sin'].map(k => c[k] ? `<i style="width:${100 * c[k] / total}%;background:var(--${ESTADO[k].k}-pt)"></i>` : '').join('')}</span>`;

  function aviso(txt) {
    avisoEl.textContent = txt; avisoEl.classList.add('on');
    clearTimeout(aviso.t); aviso.t = setTimeout(() => avisoEl.classList.remove('on'), 4500);
  }
  function guardarSesion() { try { sessionStorage.setItem(LLAVE, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ } }
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
  const demoNota = () => (API.demo() ? `<p class="cita"><b>Modo de demostración, con datos de ejemplo.</b> Lo que escriba aquí queda solo en este navegador y no llega a ninguna Secretaría.</p>` : '');
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
    const n = estados.length, R = 52, C = 60, hueco = n > 1 ? (n > 24 ? 2 : 4) : 0, paso = 360 / n;
    const arco = (a0, a1) => { const r = a => (a - 90) * Math.PI / 180, p = a => [C + R * Math.cos(r(a)), C + R * Math.sin(r(a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
    el.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">${n === 1 ? `<circle cx="60" cy="60" r="52" fill="none" stroke="var(--${estados[0]}-pt)" stroke-width="12"/>` : estados.map((k, i) => `<path d="${arco(i * paso + hueco / 2, (i + 1) * paso - hueco / 2)}" fill="none" stroke="var(--${k}-pt)" stroke-width="12"/>`).join('')}</svg>
      <div class="centro" aria-hidden="true"><b>${texto}</b><small>${sub}</small></div>`;
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', texto + ' ' + sub);
  }

  /* ── Fotos: miniatura por foto (se piden de a 48) y foto grande bajo demanda, guardadas para no volver a pedirlas ── */
  async function cargarMinis(ids) {
    const faltan = [...new Set(ids)].filter(id => !(id in MINI));
    for (let i = 0; i < faltan.length; i += 48) {
      const r = await api('verMiniaturas', { ids: faltan.slice(i, i + 48) });
      faltan.slice(i, i + 48).forEach(id => { MINI[id] = (r.ok && r.miniaturas[id]) || ''; });
    }
  }
  function ponerMinis(raiz) {
    raiz.querySelectorAll('[data-mini]').forEach(x => { const m = MINI[x.dataset.mini]; if (m && !x.querySelector('img')) { x.innerHTML = `<img src="${m}" alt="" decoding="async">`; x.classList.add('lista'); } else if (m === '') x.textContent = 'Sin vista previa'; });
  }
  // Solo pide las miniaturas que están a la vista (o cerca): la galería y la tira del carrusel pueden tener cientos.
  function minisPerezosas(raiz, rootEl) {
    const todos = [...raiz.querySelectorAll('[data-mini]')], ya = todos.slice(0, 24), els = todos.slice(24);
    cargarMinis(ya.map(x => x.dataset.mini)).then(() => ponerMinis(raiz)).catch(() => {});   // las primeras, de una vez
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { cargarMinis(els.map(x => x.dataset.mini)).then(() => ponerMinis(raiz)); return; }
    let lote = new Set(), t = null;
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { lote.add(en.target.dataset.mini); io.unobserve(en.target); } });
      clearTimeout(t); t = setTimeout(async () => { const ids = [...lote]; lote = new Set(); try { await cargarMinis(ids); } catch (e) { return; } ponerMinis(raiz); }, 60);
    }, { root: rootEl || null, rootMargin: '400px' });
    els.forEach(x => io.observe(x));
  }
  const b64aUrl = (b64, mime) => { const bin = atob(b64), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([by], { type: mime })); };
  function fotoGrande(e, a) {
    if (FULL.has(a.id)) { const u = FULL.get(a.id); FULL.delete(a.id); FULL.set(a.id, u); return Promise.resolve(u); }
    if (EN_CURSO.has(a.id)) return EN_CURSO.get(a.id);
    const p = api('verArchivo', { id: e.id, archivo_id: a.id }).then(r => {
      EN_CURSO.delete(a.id);
      if (!r.ok) throw new Error(r.error);
      const u = b64aUrl(r.contenido_base64, r.mime); FULL.set(a.id, u);
      if (FULL.size > 40) { const [k, v] = FULL.entries().next().value; URL.revokeObjectURL(v); FULL.delete(k); }
      return u;
    }, x => { EN_CURSO.delete(a.id); throw x; });
    EN_CURSO.set(a.id, p); return p;
  }

  /* ── Visor de fotografías: pantalla completa, con flechas, teclado, deslizar en el celular y los datos del registro ── */
  const V = { items: [], i: 0, el: null, de: null, turno: 0 };
  const ICO_ANT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICO_SIG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICO_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const ICO_PAUSA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  const ICO_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/></svg>';
  function visor() {
    if (V.el) return V.el;
    const d = document.createElement('dialog'); d.className = 'visor'; d.setAttribute('aria-label', 'Visor de fotografías');
    d.innerHTML = `<div class="v-escena"><figure class="v-fig" id="v-fig"><img id="v-img" alt=""></figure>
        <button type="button" class="v-b v-cerrar" id="v-cerrar" aria-label="Cerrar el visor">${ICO_X}</button>
        <button type="button" class="v-b v-ant" id="v-ant" aria-label="Foto anterior">${ICO_ANT}</button>
        <button type="button" class="v-b v-sig" id="v-sig" aria-label="Foto siguiente">${ICO_SIG}</button>
        <span class="v-cuenta" id="v-cuenta" aria-live="polite"></span></div>
      <aside class="v-datos" id="v-datos"></aside>`;
    document.body.appendChild(d);
    $('v-cerrar').addEventListener('click', () => d.close());
    $('v-ant').addEventListener('click', () => moverVisor(-1));
    $('v-sig').addEventListener('click', () => moverVisor(1));
    d.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') { ev.preventDefault(); moverVisor(1); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); moverVisor(-1); } });
    d.addEventListener('close', () => { if (V.de && document.contains(V.de)) V.de.focus({ preventScroll: true }); });
    let x0 = null;
    $('v-fig').addEventListener('pointerdown', ev => { x0 = ev.clientX; });
    $('v-fig').addEventListener('pointerup', ev => { if (x0 != null && Math.abs(ev.clientX - x0) > 50) moverVisor(ev.clientX < x0 ? 1 : -1); x0 = null; });
    $('v-datos').addEventListener('click', ev => { const b = ev.target.closest('[data-vi]'); if (b) { V.i = +b.dataset.vi; mostrarVisor(); } });
    V.el = d; return d;
  }
  function abrirVisor(items, i) {
    if (!items.length) return;
    const d = visor(); V.items = items; V.i = i; V.de = document.activeElement;
    if (!d.open) d.showModal();
    mostrarVisor();
  }
  function moverVisor(k) { V.i = (V.i + k + V.items.length) % V.items.length; mostrarVisor(); }
  async function mostrarVisor() {
    const { e, a } = V.items[V.i], yo = ++V.turno, img = $('v-img'), revisor = S && S.rol === 'REVISOR';
    img.src = MINI[a.id] || ''; img.classList.add('baja'); img.alt = `Fotografía de «${e.actividad}» en ${e.institucion}`;
    $('v-cuenta').textContent = `${V.i + 1} de ${V.items.length}`;
    $('v-ant').hidden = $('v-sig').hidden = V.items.length < 2;
    const propias = V.items.map((x, k) => [x, k]).filter(([x]) => x.e.id === e.id);
    $('v-datos').innerHTML = `<span class="chip e-neutro">${esc(e.actividad)}</span>
      <h2>${esc(e.institucion)}</h2><p class="v-lugar">${esc(nomMun(codMun(e), e.municipio))}, ${esc(fecha(e.fecha_actividad))}</p>
      <dl class="v-dl"><dt>Participantes</dt><dd class="n">${num(e.participantes)}</dd><dt>Qué se hizo</dt><dd>${esc(e.descripcion)}</dd>
        ${e.enlace ? `<dt>Video o publicación</dt><dd><a href="${esc(e.enlace)}" target="_blank" rel="noopener noreferrer">Abrir el enlace</a></dd>` : ''}</dl>
      ${propias.length > 1 ? `<p class="v-sub">${propias.length} fotos de este registro</p><div class="v-minis">${propias.map(([x, k]) => `<button type="button" data-vi="${k}" aria-label="Foto ${k + 1}"${k === V.i ? ' aria-current="true"' : ''}><span class="img">${MINI[x.a.id] ? `<img src="${MINI[x.a.id]}" alt="">` : ''}</span></button>`).join('')}</div>` : ''}
      <div class="v-acc"><a class="btn" href="#evidencia/${esc(e.id)}">Ver el registro completo</a>
        ${revisor ? `<a class="btn sutil" href="#institucion/${esc(e.dane_ie)}">Todo lo de esta institución</a>` : ''}
        <a class="btn sutil" id="v-desc" download="${esc(a.nombre)}" aria-disabled="true">Descargar esta foto</a></div>`;
    if (propias.some(([x]) => !(x.a.id in MINI))) cargarMinis(propias.map(([x]) => x.a.id)).then(() => { if (yo === V.turno) mostrarVisor(); }).catch(() => {});
    try {
      const u = await fotoGrande(e, a);
      if (yo !== V.turno) return;
      img.src = u; img.classList.remove('baja');
      const dl = $('v-desc'); if (dl) { dl.href = u; dl.removeAttribute('aria-disabled'); }
    } catch (x) { if (yo === V.turno && x.message !== 'sesion') $('v-cuenta').textContent = 'No se pudo abrir la foto: ' + x.message; }
    [1, -1].forEach(k => { const n = V.items[(V.i + k + V.items.length) % V.items.length]; if (n) fotoGrande(n.e, n.a).catch(() => {}); });
  }

  /* ── Carrusel del Resumen: todas las fotos, de la más reciente a la más antigua, con pausa (WCAG 2.2.2) ── */
  let CARR = null;
  function detenerCarrusel() { if (CARR) { CARR.stop(); CARR = null; } }
  function carrusel(raiz, items, titulo) {
    const n = items.length;
    let i = 0, t = null, manual = RM, temporal = false, vivo = true, capa = 0, turno = 0;
    raiz.innerHTML = `<div class="esc-marco" id="esc-marco" tabindex="-1">
        <img class="esc-img" alt=""><img class="esc-img" alt="">
        <span class="esc-tit">${titulo}</span>
        <button type="button" class="esc-abrir" id="esc-abrir"><span class="oculto">Ampliar esta fotografía</span></button>
        <div class="esc-pie" id="esc-pie"></div>
        <div class="esc-ctrl">
          <button type="button" class="esc-b" id="esc-ant" aria-label="Foto anterior">${ICO_ANT}</button>
          <button type="button" class="esc-b" id="esc-pausa"></button>
          <button type="button" class="esc-b" id="esc-sig" aria-label="Foto siguiente">${ICO_SIG}</button>
          <span class="esc-cuenta" id="esc-cuenta"></span></div>
        <div class="esc-prog" aria-hidden="true"><i id="esc-prog"></i></div></div>
      <div class="esc-tira" id="esc-tira" aria-label="Todas las fotografías">${items.map((x, k) => `<button type="button" class="esc-mini" data-k="${k}" aria-label="Foto ${k + 1} de ${n}: ${esc(x.e.actividad)}, ${esc(x.e.institucion)}"><span class="img" data-mini="${esc(x.a.id)}"></span></button>`).join('')}</div>`;
    const imgs = raiz.querySelectorAll('.esc-img'), tira = $('esc-tira'), prog = $('esc-prog'), bPausa = $('esc-pausa'), marco = $('esc-marco');
    const ponerPausa = () => { bPausa.innerHTML = manual ? ICO_PLAY : ICO_PAUSA; bPausa.setAttribute('aria-label', manual ? 'Reproducir las fotos' : 'Pausar las fotos'); };
    function progreso(on) {
      prog.style.transition = 'none'; prog.style.width = '0'; void prog.offsetWidth;
      if (on) { prog.style.transition = `width ${DUR_FOTO}ms linear`; prog.style.width = '100%'; }
    }
    function programar() {
      clearTimeout(t);
      if (manual || temporal || !vivo || document.hidden || n < 2) { progreso(false); return; }
      progreso(true); t = setTimeout(() => ir(i + 1), DUR_FOTO);
    }
    async function ir(k) {
      i = (k + n) % n; const { e, a } = items[i], yo = ++turno;
      clearTimeout(t); progreso(false);
      $('esc-pie').innerHTML = `<span class="chip e-neutro">${esc(e.actividad)}</span><b>${esc(e.institucion)}</b><small>${esc(nomMun(codMun(e), e.municipio))}, ${esc(diaMes(e.fecha_actividad))}, ${num(e.participantes)} participantes</small>`;
      $('esc-cuenta').textContent = `${i + 1} de ${n}`;
      tira.querySelectorAll('[aria-current]').forEach(b => b.removeAttribute('aria-current'));
      const b = tira.querySelector(`[data-k="${i}"]`);
      if (b) { b.setAttribute('aria-current', 'true'); tira.scrollTo({ left: b.offsetLeft - tira.clientWidth / 2 + b.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth' }); }
      let url = MINI[a.id] || '';
      try { url = await fotoGrande(e, a); } catch (x) { if (x.message === 'sesion') return; }
      if (yo !== turno || !vivo || !url) { if (yo === turno) programar(); return; }
      const nueva = imgs[capa ^ 1], vieja = imgs[capa];
      nueva.src = url; nueva.style.transformOrigin = `${[20, 50, 80][i % 3]}% ${[30, 60, 40][i % 3]}%`;
      try { await nueva.decode(); } catch (x) { /* se muestra igual */ }
      if (yo !== turno || !vivo) return;
      nueva.classList.add('ver'); vieja.classList.remove('ver'); capa ^= 1;
      const sig = items[(i + 1) % n]; fotoGrande(sig.e, sig.a).catch(() => {});
      programar();
    }
    $('esc-ant').addEventListener('click', () => ir(i - 1));
    $('esc-sig').addEventListener('click', () => ir(i + 1));
    bPausa.addEventListener('click', () => { manual = !manual; ponerPausa(); programar(); });
    $('esc-abrir').addEventListener('click', () => abrirVisor(items, i));
    tira.addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (b) ir(+b.dataset.k); });
    raiz.addEventListener('keydown', ev => { if (ev.target.closest('.esc-tira, .esc-ctrl, .esc-abrir') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { ev.preventDefault(); ir(i + (ev.key === 'ArrowRight' ? 1 : -1)); } });
    // Se detiene mientras el mouse o el foco están encima, para leer con calma
    marco.addEventListener('mouseenter', () => { temporal = true; programar(); });
    marco.addEventListener('mouseleave', () => { temporal = false; programar(); });
    raiz.addEventListener('focusin', () => { temporal = true; programar(); });
    raiz.addEventListener('focusout', ev => { if (!raiz.contains(ev.relatedTarget)) { temporal = false; programar(); } });
    const vis = () => programar(); document.addEventListener('visibilitychange', vis);
    ponerPausa(); minisPerezosas(tira, tira); ir(0);
    return { stop() { vivo = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); } };
  }

  /* ── Armazón: riel y menú solo para la Secretaría; quién entró, arriba a la derecha ── */
  function barra(ruta) {
    const revisor = S && S.rol === 'REVISOR';
    shell.classList.toggle('sin-riel', !revisor);
    $('nav-movil').hidden = !revisor;
    const activo = ruta === 'evidencia' || ruta === 'institucion' ? 'evidencias' : ruta;
    document.querySelectorAll('[data-r]').forEach(a => { if (a.dataset.r === activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const yo = $('yo'), av = $('av');
    yo.hidden = !S; $('salir').hidden = !S;
    if (!S) return;
    const nom = revisor ? nombrePropio(S.usuario && S.usuario.nombre) : (S.ie ? S.ie.institucion : '');
    const rol = revisor ? ((S.usuario && S.usuario.cargo) || 'Secretaría de Educación') : (S.ie ? `Institución educativa de ${nomMun(codMun(S.ie), S.ie.municipio)}` : '');
    $('yo-nom').textContent = nom; $('yo-rol').textContent = rol;
    av.textContent = iniciales(revisor ? S.usuario && S.usuario.nombre : nom); av.classList.toggle('azul', revisor);
    yo.title = nom + ', ' + rol;
  }
  $('salir').addEventListener('click', () => { if (formularioPendiente() && !F.guardando) dialogoSalir(() => cerrarSesion()); else if (!formularioPendiente()) cerrarSesion(); });

  /* ── Rutas ── */
  function parsear() {
    const h = (location.hash || '#ingreso').slice(1), [ruta, qs] = h.split('?');
    return { partes: ruta.split('/'), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  async function router() {
    detenerCarrusel();
    if (V.el && V.el.open) V.el.close();
    const { partes, q } = parsear();
    const r = partes[0] === 'revision' ? 'secretaria' : partes[0];
    await cargarMapa();
    if (API.demo() && window.DEMO.vacio()) window.DEMO.sembrar();
    barra(r);
    const libre = r === 'ingreso' || r === 'secretaria';
    const rol = S && S.rol, inicioDe = rol === 'IE' ? '#inicio' : '#panel';
    if (!S && !libre) { location.hash = '#ingreso'; return; }
    if (S && libre) { location.hash = inicioDe; return; }
    if (rol === 'IE' && ['panel', 'evidencias', 'pendientes', 'institucion'].includes(r)) { location.hash = '#inicio'; return; }
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
      else if (r === 'institucion') await vistaInstitucion(partes[1]);
      else location.hash = S ? inicioDe : '#ingreso';
    } catch (e) { if (e.message !== 'sesion') { console.error(e); pintar('Error', `<section class="panel">${vacio('Algo no salió bien', 'Recargue la página. Si sigue igual, avise a la Secretaría de Educación.', true)}</section>`); } }
  }
  window.addEventListener('hashchange', router);

  /* ── Portada y los dos ingresos ── */
  function errorCampo(id, msg) {
    const c = $('c-' + id), ay = $(id + '-ay'), el = $(id);
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
        <div class="ilus-caja">${window.ILUSTRACION || ''}<button type="button" class="btn-anim" id="b-anim"></button></div>
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
  function enlazarAnimacion() {
    const svg = $('ilus'), b = $('b-anim'); if (!svg || !b) return;
    const poner = () => {
      svg.classList.toggle('pausa', ANIM_QUIETA);
      try { if (ANIM_QUIETA) svg.pauseAnimations(); else svg.unpauseAnimations(); } catch (e) { /* sin SMIL */ }
      b.innerHTML = (ANIM_QUIETA ? ICO_PLAY : ICO_PAUSA) + `<span>${ANIM_QUIETA ? 'Animar la ilustración' : 'Pausar la animación'}</span>`;
    };
    poner(); b.addEventListener('click', () => { ANIM_QUIETA = !ANIM_QUIETA; poner(); });
  }
  function vistaIngreso() {
    const ejemplos = API.demo() ? window.DEMO.ejemplos().map(i => `<span translate="no">${i.dane_ie}</span> (${i.estado})`).join(', ') : '';
    pintar('Ingreso', `${demoNota()}${API.demo() ? `<p class="cita"><b>Códigos de ejemplo:</b> ${ejemplos}.</p>` : ''}
      ${portada('ie', `<h2>Entre con el código de su institución</h2><p class="sub">Es el código DANE de la institución educativa (12 dígitos), no el de una sede.</p>
        <form id="f-ingreso" novalidate>
          <div class="campo" id="c-dane"><label for="dane">Código DANE de la institución</label>
            <input id="dane" class="dane-campo" type="text" inputmode="numeric" autocomplete="off" placeholder="000 000 000 000" aria-describedby="dane-ay" translate="no">
            <div class="ayuda" id="dane-ay" data-orig="Escríbalo con o sin espacios.">Escríbalo con o sin espacios.</div></div>
          <button class="btn pri grande" type="submit">Entrar</button></form>`,
      [['Entre con el código', 'El código DANE de su institución educativa, de 12 dígitos.'], ['Registre cada actividad', 'Qué se hizo, cuántas personas participaron y las fotografías o el video.'], ['Finalice el reporte', 'Cuando ya no tenga nada más que registrar. Recibe una constancia en su correo.']])}`);
    enlazarAnimacion();
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    const inp = $('dane');
    inp.addEventListener('input', () => { inp.value = dane(inp.value.slice(0, 16)); });
    $('f-ingreso').addEventListener('submit', async ev => {
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

  // Solo en demostración: cómo llega el correo con el código (el texto real lo arma SolicitarCodigo en backend/Codigo.gs).
  const correoCodigo = (nombre, codigo) => `<section class="panel correo-muestra" aria-labelledby="cm-t"><h2 id="cm-t">Así llega el correo con el código</h2>
    <div class="correo"><p class="c-meta"><span>De</span> Secretaría de Educación de Caldas</p><p class="c-meta"><span>Asunto</span> Su código para ver las evidencias del 25 de noviembre: ${esc(codigo)}</p>
      <div class="c-cuerpo"><p>Hola, ${esc(nombrePropio(nombre).split(' ')[0])}:</p>
        <p>Su código es <b class="c-cod" translate="no">${esc(codigo.replace(/(\d{3})(\d{3})/, '$1 $2'))}</b>. Vence en 10 minutos y sirve una sola vez.</p>
        <p>Con él entra al tablero de la conmemoración del 25 de noviembre: ahí están, en un solo lugar y sin recibirlas por correo, las actividades y fotografías que registran las instituciones educativas de Caldas, y cuáles faltan por reportar.</p>
        <p class="c-peq">Si usted no pidió este código, ignore este mensaje: sin él nadie puede entrar.</p></div></div></section>`;
  function vistaSecretariaIngreso() {
    const paso = LOGIN.correo ? 'codigo' : 'correo';
    const demoTx = !API.demo() ? '' : paso === 'correo'
      ? `<p class="cita codigo-demo"><b>Demostración:</b> use <span translate="no">${esc(window.DEMO.USUARIOS[0].correo)}</span>.</p>`
      : (window.DEMO.codigo() ? `<p class="cita codigo-demo"><b>Código de demostración:</b> <span translate="no">${window.DEMO.codigo()}</span> (en producción llega al correo; abajo, cómo se ve).</p>` : '<p class="cita codigo-demo">En la demostración solo el correo de ejemplo recibe código.</p>');
    const cuerpo = paso === 'correo'
      ? `<h2>Ingreso de la Secretaría</h2><p class="sub">Para quien acompaña la campaña: aquí ve lo que reporta cada institución, sus fotos y cuáles faltan. Le enviaremos un código a su correo; no hay contraseñas.</p>
         <form id="f-correo" novalidate><div class="campo" id="c-correo"><label for="correo">Correo institucional</label>
           <input id="correo" type="email" autocomplete="email" inputmode="email" aria-describedby="correo-ay"><div class="ayuda" id="correo-ay" data-orig="Debe estar registrado por la Secretaría.">Debe estar registrado por la Secretaría.</div></div>
           <button class="btn azul grande" type="submit">Enviarme un código</button></form>${demoTx}`
      : `<h2>Revise su correo</h2><p class="sub">Si <b translate="no">${esc(LOGIN.correo)}</b> está registrado, le llegó un código de 6 dígitos de la Secretaría de Educación. Vence en 10 minutos.</p>
         <form id="f-codigo" novalidate><div class="campo" id="c-codigo"><label for="codigo">Código</label>
           <input id="codigo" class="dane-campo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" aria-describedby="codigo-ay"><div class="ayuda" id="codigo-ay" data-orig="¿No le llegó? Revise la carpeta de correo no deseado.">¿No le llegó? Revise la carpeta de correo no deseado.</div></div>
           <button class="btn azul grande" type="submit">Entrar al tablero</button></form>${demoTx}
         <p><button type="button" class="btn sutil" id="otro-correo">Usar otro correo</button></p>`;
    const usuarioDemo = API.demo() && window.DEMO.USUARIOS.find(u => u.correo === LOGIN.correo);
    pintar('Ingreso de la Secretaría', `${demoNota()}${portada('sed', cuerpo,
      [['Escriba su correo', 'El que la Secretaría registró para consultar las evidencias.'], ['Escriba el código', 'Llega a ese correo y sirve una sola vez.'], ['Consulte', 'Las fotos de la campaña, lo que reporta cada institución y las que faltan.']])}
      ${paso === 'codigo' && usuarioDemo && window.DEMO.codigo() ? correoCodigo(usuarioDemo.nombre, window.DEMO.codigo()) : ''}`);
    enlazarAnimacion();
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    if (paso === 'correo') {
      $('f-correo').addEventListener('submit', async ev => {
        ev.preventDefault(); limpiarErrores(ev.target);
        const correo = $('correo').value.trim().toLowerCase(), btn = ev.target.querySelector('button');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return errorCampo('correo', 'Escriba un correo válido, por ejemplo nombre@dominio.gov.co.');
        btn.disabled = true; btn.textContent = 'Enviando…';
        const r = await API.llamar('solicitarCodigo', { correo });
        if (!r.ok) { btn.disabled = false; btn.textContent = 'Enviarme un código'; return errorCampo('correo', r.error); }
        LOGIN.correo = correo; vistaSecretariaIngreso();
        $('codigo').focus();
      });
    } else {
      $('otro-correo').addEventListener('click', () => { LOGIN.correo = ''; vistaSecretariaIngreso(); });
      $('f-codigo').addEventListener('submit', async ev => {
        ev.preventDefault(); limpiarErrores(ev.target);
        const codigo = $('codigo').value.replace(/\D/g, ''), btn = ev.target.querySelector('button');
        if (codigo.length !== 6) return errorCampo('codigo', 'El código tiene 6 dígitos.');
        btn.disabled = true; btn.textContent = 'Entrando…';
        const r = await API.llamar('validarCodigo', { correo: LOGIN.correo, codigo });
        if (!r.ok) { btn.disabled = false; btn.textContent = 'Entrar al tablero'; return errorCampo('codigo', r.error); }
        S = { token: r.token, rol: 'REVISOR', usuario: r.usuario }; LOGIN = { correo: '' }; guardarSesion(); location.hash = '#panel';
      });
    }
  }

  /* ── Inicio de la institución: tres pasos, las actividades con lo registrado debajo de cada una y el cierre del reporte ── */
  async function vistaInicio() {
    cargando();
    const r = await api('misEvidencias');
    if (!r.ok) return pintar('Inicio', `<section class="panel">${vacio('No se pudo cargar', r.error, true)}</section>`);
    S.ie = r.institucion; S.cierre = r.cierre; guardarSesion(); barra('inicio');
    const ev = r.evidencias, ie = r.institucion, A = CFG.ACTIVIDADES, cierre = r.cierre;
    const porAct = A.map(a => recientes(ev.filter(e => e.actividad === a.nombre)));
    const hechas = porAct.filter(l => l.length).length, participantes = ev.reduce((s, e) => s + e.participantes, 0), nFotos = imagenes(ev).length;
    const estado = cierre ? 'fin' : ev.length ? 'rep' : 'sin';
    const chip = { fin: '<span class="chip e-ok">Reporte finalizado</span>', rep: '<span class="chip e-bor">Reporte sin finalizar</span>', sin: '<span class="chip e-gris">Sin registros todavía</span>' }[estado];
    const hecho = [ev.length > 0 || (cierre && cierre.sin_actividades), !!cierre, !!cierre], actual = hecho.indexOf(false);
    const pasos = [['Registre lo que hicieron', 'Una vez por cada actividad realizada.'], ['Revise lo registrado', 'Corrija o agregue fotos si hace falta.'], ['Finalice el reporte', 'Cuando no tenga nada más que registrar.']];
    const filas = A.map((a, i) => {
      const l = porAct[i], n = l.length;
      return `<li class="${n ? 'hecha' : ''}"><span class="ai-punto" style="--pt:var(--${n ? 'ok' : 'gris'}-pt)" aria-hidden="true"></span>
        <div class="ai-tx"><h3>${esc(a.nombre)}</h3><p>${esc(a.que)}</p>
          ${n ? `<ul class="ai-regs">${l.map(e => { const f = primeraFoto(e); return `<li><a href="#evidencia/${esc(e.id)}"><span class="img"${f ? ` data-mini="${esc(f.id)}"` : ''}>${f ? '' : (e.enlace ? 'Video' : 'PDF')}</span><span class="ai-dato"><b>${esc(diaCorto(e.fecha_actividad))}</b><small>${num(e.participantes)} ${plural(e.participantes, 'participante', 'participantes')}</small></span></a></li>`; }).join('')}</ul>` : ''}</div>
        ${cierre ? (n ? `<span class="chip e-ok">${n} ${plural(n, 'registro', 'registros')}</span>` : '<span class="chip e-gris">No se hizo</span>') : `<a class="btn${n ? '' : ' pri'}" href="#registrar?a=${i}">${n ? 'Registrar otra vez' : 'Registrar'}<span class="oculto"> ${esc(a.nombre)}</span></a>`}</li>`;
    }).join('');
    const fin = cierre ? `<section class="panel fin-banner" role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--ok-pt)"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div><h2>Su reporte quedó finalizado</h2><p>El ${esc(fechaLarga(cierre.fecha))} a las ${esc(horaDe(new Date(cierre.fecha)))}, por ${esc(nombrePropio(cierre.nombre))} (${esc(cierre.cargo.toLowerCase())}). La Secretaría de Educación ya lo ve como terminado. Código de verificación <b translate="no">${esc(cierre.codigo)}</b>.</p>
          <p class="peq">Si necesita agregar o corregir algo, pida a la Secretaría de Educación que reabra el reporte.</p></div>
        <button type="button" class="btn" id="b-const">Imprimir la constancia</button></section>` : '';
    pintar(ie.institucion, `
      ${MENSAJE ? `<p class="cita" role="status">${esc(MENSAJE)}</p>` : ''}${demoNota()}
      <section class="panel heroe-ie">
        <div class="hi-id"><h1>${esc(ie.institucion)}</h1>
          <p>${esc(nomMun(codMun(ie), ie.municipio))}, código <span translate="no">${dane(ie.dane_ie)}</span>, ${ie.num_sedes} ${plural(ie.num_sedes, 'sede', 'sedes')}</p>${chip}</div>
        <ol class="ruta pasos-ie" style="--pasos:3">${pasos.map(([t, d], i) => `<li class="${hecho[i] ? 'fin' : ''}${i === actual ? ' ahora' : ''}" style="--pt:var(--ok-pt)"><span class="bola">${hecho[i] ? '✓' : i + 1}</span><h3>${t}</h3><span class="sub">${d}</span></li>`).join('')}</ol>
      </section>
      ${fin}
      <div class="rejilla ie-cuerpo">
        <section class="panel c8"><h2 class="sec-t">Actividades de la campaña</h2>
          <p class="sub">${cierre ? 'Lo que la institución reportó.' : 'Registre cada vez que se realizó una actividad. Lo que ya registró aparece debajo de cada una: tóquelo para verlo o corregirlo.'}</p>
          <ul class="acts-ie">${filas}</ul></section>
        <aside class="panel c4 lado reporte" aria-labelledby="rep-t"><h2 id="rep-t">Su reporte</h2>
          <div class="rep-cab"><div class="anillo chico" id="anillo"></div>
            <dl class="mini-cifras"><div><dt>Registros</dt><dd class="n">${num(ev.length)}</dd></div><div><dt>Participantes</dt><dd class="n">${num(participantes)}</dd></div><div><dt>Fotografías</dt><dd class="n">${num(nFotos)}</dd></div></dl></div>
          ${cierre ? `<p class="peq rep-fin">Finalizado el ${esc(fechaHora(cierre.fecha))}</p>`
            : `<div class="cierre-caja"><h3>¿Ya registró todo?</h3><p>Cuando no tenga nada más que registrar, finalice el reporte: la Secretaría verá que su institución terminó y usted recibirá una constancia en su correo.</p>
              <button type="button" class="btn pri grande" id="b-fin">${ev.length ? 'Finalizar el reporte' : 'Finalizar sin actividades'}</button></div>`}
        </aside>
      </div>
      ${cierre ? constancia(ie, cierre, ev) : ''}`);
    anillo($('anillo'), porAct.map(l => (l.length ? 'ok' : 'gris')), `${hechas}/${A.length}`, 'actividades');
    cargarMinis([...main.querySelectorAll('[data-mini]')].map(x => x.dataset.mini)).then(() => ponerMinis(main)).catch(() => {});
    MENSAJE = '';
    if ($('b-fin')) $('b-fin').addEventListener('click', () => dialogoFinalizar(ev));
    if ($('b-const')) $('b-const').addEventListener('click', imprimirConstancia);
  }
  function constancia(ie, c, ev) {
    const A = CFG.ACTIVIDADES, filas = A.map(a => { const l = ev.filter(e => e.actividad === a.nombre); return l.length ? `<tr><td>${esc(a.nombre)}</td><td class="d">${l.length}</td><td class="d">${num(l.reduce((s, e) => s + e.participantes, 0))}</td></tr>` : ''; }).join('');
    return `<section class="panel constancia" id="constancia" aria-labelledby="const-t">
      <img src="img/logo-ingreso.png" alt="Gobernación de Caldas, Secretaría de Educación" width="188" height="45">
      <h2 id="const-t">Constancia de reporte</h2><p class="sub">${esc(CFG.TITULO)}, campaña «${esc(CFG.CAMPANA)}».</p>
      <dl class="datos"><dt>Institución</dt><dd>${esc(ie.institucion)}</dd><dt>Código DANE</dt><dd translate="no">${dane(ie.dane_ie)}</dd><dt>Municipio</dt><dd>${esc(nomMun(codMun(ie), ie.municipio))}</dd>
        <dt>Reporte finalizado</dt><dd>${esc(fechaHora(c.fecha))}</dd><dt>Finalizado por</dt><dd>${esc(nombrePropio(c.nombre))}, ${esc(c.cargo.toLowerCase())}</dd>
        ${c.sin_actividades ? `<dt>Actividades</dt><dd>La institución no realizó actividades. Motivo: ${esc(c.motivo)}</dd>` : `<dt>Registros</dt><dd>${num(c.resumen.registros)} ${plural(c.resumen.registros, 'registro', 'registros')} en ${c.resumen.actividades} de las ${A.length} actividades, con ${num(c.resumen.participantes)} participantes y ${num(c.resumen.fotos)} fotografías</dd>`}
        <dt>Código de verificación</dt><dd><b translate="no">${esc(c.codigo)}</b></dd></dl>
      ${filas ? `<div class="tabla-scroll"><table class="tabla densa"><thead><tr><th>Actividad</th><th class="d">Registros</th><th class="d">Participantes</th></tr></thead><tbody>${filas}</tbody></table></div>` : ''}</section>`;
  }
  function imprimirConstancia() { document.body.classList.add('imp'); window.print(); setTimeout(() => document.body.classList.remove('imp'), 500); }

  function dialogoFinalizar(ev) {
    const sin = !ev.length, A = CFG.ACTIVIDADES, nAct = new Set(ev.map(e => e.actividad)).size;
    const part = ev.reduce((s, e) => s + e.participantes, 0), fotos = imagenes(ev).length;
    const d = document.createElement('dialog'); d.className = 'dialogo fin-dlg'; d.setAttribute('aria-labelledby', 'fin-t');
    d.innerHTML = `<form id="f-fin" novalidate><h2 id="fin-t">${sin ? 'Finalizar sin actividades' : 'Finalizar el reporte'}</h2>
      ${sin ? `<p class="sub">Su institución no tiene actividades registradas. Si no realizó ninguna, finalice contando por qué. Si sí las hizo, vuelva y regístrelas primero.</p>
          <div class="campo" id="c-motivo"><label for="motivo">¿Por qué no se realizaron actividades?</label><textarea id="motivo" maxlength="500" aria-describedby="motivo-ay"></textarea><div class="ayuda" id="motivo-ay" data-orig=""></div></div>`
        : `<p class="sub">Así queda el reporte de su institución:</p><ul class="fin-res"><li><b>${num(ev.length)}</b> ${plural(ev.length, 'registro', 'registros')} en ${nAct} de las ${A.length} actividades</li><li><b>${num(part)}</b> participantes</li><li><b>${num(fotos)}</b> ${plural(fotos, 'fotografía', 'fotografías')}</li></ul>`}
      <div class="campo" id="c-fnom"><label for="fnom">Nombre de quien finaliza</label><input id="fnom" type="text" autocomplete="name" aria-describedby="fnom-ay"><div class="ayuda" id="fnom-ay" data-orig=""></div></div>
      <div class="campo" id="c-fcargo"><label for="fcargo">Cargo</label><select id="fcargo" aria-describedby="fcargo-ay"><option value="">Elija el cargo</option>${['Rector o rectora', 'Coordinador o coordinadora', 'Docente orientador u orientadora', 'Docente', 'Otro cargo'].map(c => `<option>${c}</option>`).join('')}</select><div class="ayuda" id="fcargo-ay" data-orig=""></div></div>
      <div class="campo" id="c-fcorreo"><label for="fcorreo">Correo para recibir la constancia</label><input id="fcorreo" type="email" autocomplete="email" inputmode="email" aria-describedby="fcorreo-ay"><div class="ayuda" id="fcorreo-ay" data-orig="Le llega la constancia con el código de verificación.">Le llega la constancia con el código de verificación.</div></div>
      <div class="campo"><div class="confirma" id="c-fconf"><input type="checkbox" id="fconf" aria-describedby="fconf-ay"><label for="fconf">Confirmo que la institución terminó de registrar. Después de finalizar <b>ya no se puede agregar ni corregir</b>; si hace falta, hay que pedir a la Secretaría de Educación que reabra el reporte.</label></div><div class="ayuda" id="fconf-ay" data-orig=""></div></div>
      <div id="fin-error" class="ayuda" role="alert"></div>
      <div class="acciones"><button type="button" class="btn" id="fin-volver">Volver</button><button type="submit" class="btn pri" id="fin-ok">${sin ? 'Finalizar sin actividades' : 'Finalizar el reporte'}</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', () => d.remove());
    $('fin-volver').addEventListener('click', () => d.close());
    $('f-fin').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; limpiarErrores(f); $('fin-error').textContent = '';
      const datos = { nombre: $('fnom').value.trim(), cargo: $('fcargo').value, correo: $('fcorreo').value.trim(), confirma: $('fconf').checked, motivo: sin ? $('motivo').value.trim() : '' };
      const errs = [];
      if (sin && datos.motivo.length < 10) errs.push(['motivo', 'Cuente brevemente por qué (al menos 10 caracteres).']);
      if (datos.nombre.length < 5) errs.push(['fnom', 'Escriba su nombre completo.']);
      if (!datos.cargo) errs.push(['fcargo', 'Elija su cargo.']);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo)) errs.push(['fcorreo', 'Escriba un correo válido para recibir la constancia.']);
      if (!datos.confirma) errs.push(['fconf', 'Marque la confirmación para finalizar.']);
      if (errs.length) { errs.slice().reverse().forEach(([id, m]) => errorCampo(id, m)); return; }
      const b = $('fin-ok'); b.disabled = true; b.textContent = 'Finalizando…';
      const r = await api('finalizarReporte', datos);
      if (!r.ok) { b.disabled = false; b.textContent = 'Finalizar el reporte'; $('fin-error').textContent = r.error; $('fin-error').classList.add('mal'); return; }
      d.close(); d.remove();
      MENSAJE = API.demo() ? `Reporte finalizado. En la demostración no se envía correo; en producción la constancia llega a ${datos.correo}.`
        : r.correo_enviado ? `Reporte finalizado correctamente. Le enviamos la constancia a ${datos.correo}.`
        : 'Reporte finalizado correctamente. Hoy no se pudo enviar la constancia por correo: imprímala o guárdela en PDF desde esta página.';
      vistaInicio();
    });
  }

  /* ── Registrar o corregir: actividad, fecha y participantes, luego las fotos (la evidencia principal), luego el texto ── */
  // Salir del formulario con algo escrito o fotos elegidas: se pregunta antes, con un diálogo (no confirm()).
  function dialogoSalir(despues) {
    const dl = document.createElement('dialog'); dl.className = 'dialogo';
    dl.innerHTML = `<h2>¿Salir sin guardar?</h2><p>Lo que escribió y las fotos que eligió en este registro se pierden si sale ahora.</p>
      <div class="acciones"><button type="button" class="btn" id="sg-no">Seguir llenando</button><button type="button" class="btn peligro" id="sg-si">Salir sin guardar</button></div>`;
    document.body.appendChild(dl); dl.showModal(); dl.addEventListener('close', () => dl.remove());
    $('sg-no').addEventListener('click', () => dl.close());
    $('sg-si').addEventListener('click', () => { F.sucio = false; F.nuevos = []; dl.close(); if (despues) despues(); else location.hash = '#inicio'; });
  }
  const formularioPendiente = () => /^#registrar/.test(location.hash) && F && (F.guardando || F.sucio || F.nuevos.length);
  // Cerrar o recargar la pestaña con un registro a medias (o mientras sube las fotos): el navegador pregunta.
  window.addEventListener('beforeunload', ev => { if (formularioPendiente()) { ev.preventDefault(); ev.returnValue = ''; } });
  function bloqueAyuda(a) {
    return a ? `<div class="bloque"><b>De qué se trata</b>${esc(a.que)}</div><div class="bloque"><b>Evidencia sugerida</b>${esc(a.pista)}</div><div class="bloque"><b>Cuidado</b>${esc(a.cuidado)}</div>`
      : `<div class="bloque">Elija una actividad y aquí aparecerá de qué se trata, qué evidencia suele servir y qué cuidar.</div>`;
  }
  async function vistaRegistrar(q) {
    cargando();
    const r0 = await api('misEvidencias');
    if (r0.ok && r0.cierre) { MENSAJE = 'Su reporte ya está finalizado: no se puede registrar ni corregir. Si hace falta, pida a la Secretaría de Educación que lo reabra.'; location.hash = '#inicio'; return; }
    const previa = q.e ? r0.ok && r0.evidencias.find(e => e.id === q.e) : null;
    if (q.e && !previa) { location.hash = '#inicio'; return; }
    const editar = !!previa;
    const idxAct = q.a != null && CFG.ACTIVIDADES[+q.a] ? +q.a : -1;
    const actual = editar ? previa.actividad : (idxAct >= 0 ? CFG.ACTIVIDADES[idxAct].nombre : '');
    // La actividad viene fija del botón que se tocó en el inicio: aquí no se cambia, para que nadie registre en la equivocada.
    if (!actual) { location.hash = '#inicio'; return; }
    const infoAct = CFG.ACTIVIDADES.find(a => a.nombre === actual);
    F = { cid: uuid(), nuevos: [], existentes: editar ? previa.archivos.slice() : [], id: editar ? previa.id : null, sucio: false, guardando: false };
    pintar(editar ? 'Corregir registro' : 'Registrar actividad', `
      <p class="migas"><a href="#inicio" id="m-inicio">Inicio</a> / ${editar ? 'Corregir un registro' : 'Registrar una actividad'}</p>
      <div class="cab densa"><div><h1>${editar ? 'Corregir' : 'Registrar'}: ${esc(actual)}</h1>
        <p>${editar ? 'Cambie lo que necesite. Lo anterior queda guardado en el historial.' : 'Un registro por cada vez que se hizo esta actividad. Llene los campos de arriba abajo y guarde al final.'}</p></div></div>
      <div class="rejilla">
      <form id="f-reg" class="panel c8" novalidate>
        <input type="hidden" id="act" value="${esc(actual)}">
        <div class="act-fija"><span class="peq">Actividad</span><b>${esc(actual)}</b>
          ${editar ? '' : '<a href="#inicio" class="peq" id="m-otra">¿Era otra actividad? Vuelva al inicio y toque «Registrar» en la que corresponde.</a>'}</div>
        <div class="fila2">
          <div class="campo" id="c-fecha"><label for="fecha">Fecha en que se realizó</label><input id="fecha" type="date" min="2026-01-01" max="${hoy()}" value="${editar ? esc(previa.fecha_actividad) : ''}" aria-describedby="fecha-ay"><div class="ayuda" id="fecha-ay" data-orig=""></div></div>
          <div class="campo" id="c-part"><label for="part">Número de participantes</label><input id="part" type="text" inputmode="numeric" autocomplete="off" value="${editar ? previa.participantes : ''}" aria-describedby="part-ay"><div class="ayuda" id="part-ay" data-orig="Personas que participaron, sin nombres.">Personas que participaron, sin nombres.</div></div>
        </div>
        <div class="campo" id="c-arch"><span class="lbl" id="arch-l">Fotografías o PDF</span>
          <div class="zona" id="zona"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="m4 17 5-4.5 3.5 3 2.5-2 5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            <b>Arrastre aquí las fotos o el PDF</b><span>o</span><button type="button" class="btn" id="b-arch" aria-describedby="arch-ay">Elija los archivos</button>
            <input type="file" id="i-arch" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple hidden></div>
          <ul class="arch-t" id="l-arch" aria-labelledby="arch-l"></ul>
          <div class="ayuda" id="arch-ay" data-orig="Hasta ${MAX_ARCHIVOS} archivos. Las fotos se reducen solas antes de enviarse.">Hasta ${MAX_ARCHIVOS} archivos. Las fotos se reducen solas antes de enviarse.</div></div>
        <div class="campo" id="c-desc"><label for="desc">¿Qué se hizo?</label><textarea id="desc" maxlength="800" aria-describedby="desc-ay">${editar ? esc(previa.descripcion) : ''}</textarea>
          <div class="ayuda" id="desc-ay" data-orig="Dos o tres frases. No escriba nombres ni relatos de casos reales.">Dos o tres frases. No escriba nombres ni relatos de casos reales.</div><div class="contar" id="desc-n" aria-hidden="true">0 / 800</div></div>
        <div class="campo" id="c-enlace"><label for="enlace">Enlace al video o la publicación <span style="font-weight:400">(opcional)</span></label><input id="enlace" type="url" inputmode="url" placeholder="https://" value="${editar ? esc(previa.enlace) : ''}" aria-describedby="enlace-ay"><div class="ayuda" id="enlace-ay" data-orig=""></div></div>
        <div class="campo"><div class="confirma" id="c-conf"><input type="checkbox" id="conf" aria-describedby="conf-ay"><label for="conf">Confirmo que en las fotografías y videos <b>no aparecen niñas, niños ni adolescentes identificables</b>, o que se cuenta con la autorización informada de sus familias para su uso.</label></div>
          <div class="ayuda" id="conf-ay" data-orig=""></div></div>
        <div id="envio-error" class="ayuda" role="alert"></div>
        <button class="btn pri grande" type="submit" id="b-enviar">${editar ? 'Guardar la corrección' : 'Guardar el registro'}</button>
      </form>
      <aside class="panel c4 lado guia"><h2>Qué registrar en esta actividad</h2><div id="ayuda-act">${bloqueAyuda(infoAct)}</div></aside></div>`);
    MENSAJE = '';
    if (editar) $('conf').checked = true;
    const desc = $('desc'), cont = $('desc-n'), zona = $('zona');
    const actualizarN = () => { cont.textContent = desc.value.length + ' / 800'; };
    desc.addEventListener('input', actualizarN); actualizarN();
    // Lo escrito no se pierde por un clic: avisa antes de salir del formulario sin guardar.
    $('f-reg').addEventListener('input', () => { F.sucio = true; });
    ['m-inicio', 'm-otra'].forEach(k => { const a = $(k); if (a) a.addEventListener('click', ev => { if (!F.sucio && !F.nuevos.length) return; ev.preventDefault(); dialogoSalir(); }); });
    $('b-arch').addEventListener('click', () => $('i-arch').click());
    $('i-arch').addEventListener('change', async ev => { await agregarArchivos([...ev.target.files]); ev.target.value = ''; });
    ['dragenter', 'dragover'].forEach(t => zona.addEventListener(t, ev => { ev.preventDefault(); zona.classList.add('encima'); }));
    ['dragleave', 'drop'].forEach(t => zona.addEventListener(t, () => zona.classList.remove('encima')));
    zona.addEventListener('drop', async ev => { ev.preventDefault(); await agregarArchivos([...ev.dataTransfer.files]); });
    $('l-arch').addEventListener('click', ev => quitarDeLista(ev));
    $('f-reg').addEventListener('submit', enviarFormulario);
    pintarLista();
    if (F.existentes.some(esImg)) cargarMinis(F.existentes.filter(esImg).map(a => a.id)).then(pintarLista).catch(() => {});
  }
  function pintarLista() {
    const ul = $('l-arch'); if (!ul) return;
    const caja = (src, et) => (src ? `<img src="${src}" alt="">` : `<span class="pdf">${et}</span>`);
    const ex = F.existentes.map(a => `<li>${caja(esImg(a) ? MINI[a.id] : '', 'PDF')}<span class="t-nom">${esc(a.nombre)}<small>Ya guardado, ${tam(a.tamano)}</small></span>
      <button type="button" class="quitar" data-ex="${esc(a.id)}" aria-label="Quitar ${esc(a.nombre)}">×</button></li>`);
    const nu = F.nuevos.map(a => `<li>${caja(a.url, 'PDF')}<span class="t-nom">${esc(a.nombre)}<small>${tam(a.tam)}</small></span>
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
    const ay = $('arch-ay'); ay.classList.remove('mal'); ay.textContent = ay.dataset.orig;
    for (const f of lista) {
      if (F.existentes.length + F.nuevos.length >= MAX_ARCHIVOS) { ay.textContent = `Solo se pueden adjuntar ${MAX_ARCHIVOS} archivos por actividad.`; ay.classList.add('mal'); break; }
      try { F.nuevos.push(await prepararArchivo(f)); } catch (e) { ay.textContent = `${f.name}: ${e.message}`; ay.classList.add('mal'); }
    }
    pintarLista();
  }
  function aBase64(blob) {
    return new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => mal(new Error('No se pudo leer el archivo.')); r.readAsDataURL(blob); });
  }
  // Foto reducida a ≤ 1600 px y, aparte, una miniatura de ≤ 360 px (una por cada foto).
  async function prepararArchivo(f) {
    if (f.type === 'application/pdf') {
      if (f.size > MAX_PDF) throw new Error('el PDF pesa más de 4 MB.');
      return { cid: uuid(), nombre: f.name, mime: 'application/pdf', tam: f.size, b64: await aBase64(f), url: '', mini: '' };
    }
    if (!/^image\//.test(f.type)) throw new Error('solo se aceptan fotografías y PDF.');
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { throw new Error('no se pudo abrir esta imagen. Use una foto JPEG o PNG.'); }
    const lienzo = lado => { const k = Math.min(1, lado / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c; };
    const c = lienzo(MAX_LADO), mini = lienzo(360).toDataURL('image/jpeg', 0.7);
    bmp.close && bmp.close();
    let blob = null;
    for (const q of [0.82, 0.68, 0.5]) { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= MAX_IMG) break; }
    if (!blob || blob.size > MAX_IMG) throw new Error('la foto sigue pesando más de 3 MB.');
    return { cid: uuid(), nombre: f.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', tam: blob.size, b64: await aBase64(blob), url: URL.createObjectURL(blob), mini: mini.length <= 45000 ? mini : '' };
  }
  const subir = (id, a) => api('subirArchivo', { id, cid: a.cid, nombre: a.nombre, mime: a.mime, contenido_base64: a.b64, miniatura: a.mini || undefined });
  function leerFormulario() {
    return { actividad: $('act').value, fecha_actividad: $('fecha').value, participantes: $('part').value.trim(), descripcion: $('desc').value.trim(), enlace: $('enlace').value.trim(), autoriza_imagen: $('conf').checked };
  }
  function validarFormulario(d) {
    const e = {};
    if (!d.actividad) e.act = 'Elija la actividad.';
    if (!d.fecha_actividad) e.fecha = 'Escriba la fecha en que se realizó.';
    else if (d.fecha_actividad > hoy()) e.fecha = 'La fecha no puede ser posterior a hoy.';
    if (!/^\d{1,4}$/.test(d.participantes) && d.participantes !== '5000') e.part = 'Escriba un número entero, por ejemplo 35.';
    if (!d.enlace && F.existentes.length + F.nuevos.length === 0) e.arch = 'Agregue al menos una fotografía o PDF, o el enlace al video.';
    if (d.descripcion.length < 10) e.desc = 'Cuente brevemente qué se hizo (al menos 10 caracteres).';
    if (d.enlace && !/^https?:\/\/\S+$/i.test(d.enlace)) e.enlace = 'El enlace debe empezar por http:// o https://.';
    if (!d.autoriza_imagen) e.conf = 'Marque la casilla para poder guardar.';
    return e;
  }
  async function enviarFormulario(ev) {
    ev.preventDefault();
    const form = ev.target, btn = $('b-enviar'), err = $('envio-error');
    limpiarErrores(form); err.textContent = ''; err.classList.remove('mal');
    const d = leerFormulario(), errs = validarFormulario(d), claves = Object.keys(errs);
    if (claves.length) {
      claves.forEach(k => { const c = $(k === 'conf' ? 'c-conf' : 'c-' + k), ay = $(k + '-ay'); c.classList.add('mal'); ay.textContent = errs[k]; ay.classList.add('mal'); });
      const primero = $(claves[0] === 'arch' ? 'b-arch' : claves[0]); if (primero) primero.focus(); return;
    }
    const original = btn.textContent; btn.disabled = true; btn.textContent = 'Guardando…'; F.guardando = true;
    const r = F.id ? await api('editarEvidencia', Object.assign({ id: F.id }, d)) : await api('crearEvidencia', Object.assign({ cid: F.cid }, d));
    if (!r.ok) { F.guardando = false; btn.disabled = false; btn.textContent = original; err.textContent = r.error; err.classList.add('mal'); return; }
    const id = r.evidencia.id, fallos = [];
    for (let i = 0; i < F.nuevos.length; i++) {
      btn.textContent = `Subiendo archivo ${i + 1} de ${F.nuevos.length}…`;
      const s = await subir(id, F.nuevos[i]);
      if (!s.ok) fallos.push(`${F.nuevos[i].nombre}: ${s.error}`);
      else if (F.nuevos[i].mini) MINI['A-' + F.nuevos[i].cid] = F.nuevos[i].mini;
    }
    F.nuevos.forEach(a => a.url && URL.revokeObjectURL(a.url));
    MENSAJE = fallos.length
      ? `El registro quedó guardado, pero ${fallos.length === 1 ? 'un archivo no se pudo subir' : fallos.length + ' archivos no se pudieron subir'} (${fallos.join('; ')}). Agréguelos con «Agregar archivos».`
      : (F.id ? 'Corrección guardada.' : 'Registro guardado.');
    F.guardando = false; F.sucio = false; F.nuevos = [];
    location.hash = '#evidencia/' + id;
  }

  /* ── Detalle de un registro: la foto grande, la tira de fotos y los datos al lado ── */
  function datosEvidencia(e, conInstitucion) {
    return `<dl class="datos">
      ${conInstitucion ? `<dt>Institución</dt><dd><a href="#institucion/${esc(e.dane_ie)}">${esc(e.institucion)}</a><br><small class="peq" style="color:var(--t3)">${esc(nomMun(codMun(e), e.municipio))}, <span translate="no">${dane(e.dane_ie)}</span></small></dd>` : ''}
      <dt>Fecha de la actividad</dt><dd>${esc(fecha(e.fecha_actividad))}</dd>
      <dt>Participantes</dt><dd class="n">${num(e.participantes)}</dd>
      <dt>Qué se hizo</dt><dd>${esc(e.descripcion)}</dd>
      ${e.enlace ? `<dt>Enlace</dt><dd><a href="${esc(e.enlace)}" target="_blank" rel="noopener noreferrer">${esc(e.enlace)}</a></dd>` : ''}
      <dt>Registrada</dt><dd>${esc(fechaHora(e.registrado))}</dd>
      ${e.version > 1 ? `<dt>Corregida</dt><dd>${esc(fechaHora(e.actualizado))}, versión ${e.version}</dd>` : ''}</dl>`;
  }
  async function vistaEvidencia(id) {
    cargando();
    const revisor = S.rol === 'REVISOR';
    let e, cierre = null;
    if (revisor) { await traerTodo(); e = TODO.evidencias.find(x => x.id === id); }
    else { const r = await api('misEvidencias'); e = r.ok && r.evidencias.find(x => x.id === id); cierre = r.ok && r.cierre; }
    if (!e) { location.hash = revisor ? '#evidencias' : '#inicio'; return; }
    const volver = revisor ? '#evidencias' : '#inicio', fotos = e.archivos.filter(esImg), pdfs = e.archivos.filter(a => !esImg(a));
    const items = fotos.map(a => ({ e, a })), abierto = !revisor && !cierre;
    pintar(e.actividad, `
      <p class="migas"><a href="${volver}">${revisor ? 'Evidencias' : 'Inicio'}</a> / ${esc(e.actividad)}</p>
      <div class="cab densa"><div><h1>${esc(e.actividad)}</h1><p>${revisor ? esc(e.institucion) : 'Registro de su institución'}</p></div>
        <div class="der">${abierto ? `<a class="btn" href="#registrar?e=${esc(e.id)}">Corregir el registro</a>` : ''}</div></div>
      ${MENSAJE ? `<p class="cita" role="status">${esc(MENSAJE)}</p>` : ''}
      <div class="rejilla det">
        <section class="panel c8 galeria-det" aria-label="Fotografías">
          ${fotos.length ? `<button type="button" class="gd-grande" id="gd-grande" aria-label="Ampliar la foto"><span class="img" data-mini="${esc(fotos[0].id)}"></span><span class="gd-cuenta">${fotos.length} ${plural(fotos.length, 'foto', 'fotos')}</span></button>
            ${fotos.length > 1 ? `<div class="gd-tira">${fotos.map((a, k) => `<button type="button" data-k="${k}" aria-label="Ver la foto ${k + 1}"${k ? '' : ' aria-current="true"'}><span class="img" data-mini="${esc(a.id)}"></span></button>`).join('')}</div>` : ''}`
            : `<div class="gd-vacia">${e.enlace ? `La evidencia de esta actividad es el enlace al video. <a href="${esc(e.enlace)}" target="_blank" rel="noopener noreferrer">Abrir el enlace</a>` : 'Sin fotografías.'}</div>`}
          ${pdfs.length ? `<ul class="pdfs">${pdfs.map(a => `<li><span class="pdf">PDF</span><span class="t-nom">${esc(a.nombre)}<small>${tam(a.tamano)}</small></span><button type="button" class="btn" data-pdf="${esc(a.id)}">Abrir</button></li>`).join('')}</ul>` : ''}
          ${abierto ? `<div class="gd-mas"><button type="button" class="btn" id="b-mas">Agregar archivos</button><input type="file" id="i-mas" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple hidden><div class="ayuda mal" id="mas-ay" role="alert"></div></div>` : ''}
        </section>
        <section class="panel c4">${datosEvidencia(e, revisor)}</section></div>`);
    MENSAJE = '';
    let k0 = 0;
    const grande = $('gd-grande');
    const verGrande = async k => {
      k0 = k; const a = fotos[k], caja = grande.querySelector('.img');
      caja.dataset.mini = a.id; caja.innerHTML = MINI[a.id] ? `<img src="${MINI[a.id]}" alt="" class="baja">` : '';
      main.querySelectorAll('.gd-tira [aria-current]').forEach(b => b.removeAttribute('aria-current'));
      const b = main.querySelector(`.gd-tira [data-k="${k}"]`); if (b) b.setAttribute('aria-current', 'true');
      try { const u = await fotoGrande(e, a); if (k0 === k && document.contains(caja)) caja.innerHTML = `<img src="${u}" alt="Fotografía ${k + 1} de ${esc(e.actividad)}">`; } catch (x) { /* queda la miniatura */ }
    };
    if (grande) {
      grande.addEventListener('click', () => abrirVisor(items, k0));
      main.querySelector('.gd-tira') && main.querySelector('.gd-tira').addEventListener('click', ev => { const b = ev.target.closest('[data-k]'); if (b) verGrande(+b.dataset.k); });
      cargarMinis(fotos.map(a => a.id)).then(() => { ponerMinis(main); verGrande(0); }).catch(() => {});
    }
    main.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Abriendo…';
      const r = await api('verArchivo', { id: e.id, archivo_id: b.dataset.pdf });
      b.disabled = false; b.textContent = 'Abrir';
      if (r.ok) window.open(b64aUrl(r.contenido_base64, r.mime), '_blank', 'noopener'); else aviso(r.error);
    }));
    if (abierto) {
      const entrada = $('i-mas'), ay = $('mas-ay'), b = $('b-mas');
      b.addEventListener('click', () => entrada.click());
      entrada.addEventListener('change', async () => {
        const archivos = [...entrada.files]; entrada.value = ''; ay.textContent = '';
        if (e.archivos.length + archivos.length > MAX_ARCHIVOS) { ay.textContent = `Solo se pueden adjuntar ${MAX_ARCHIVOS} archivos por actividad.`; return; }
        b.disabled = true; const fallos = [];
        for (let i = 0; i < archivos.length; i++) {
          b.textContent = `Subiendo archivo ${i + 1} de ${archivos.length}…`;
          try { const a = await prepararArchivo(archivos[i]); const s = await subir(e.id, a); if (!s.ok) fallos.push(`${a.nombre}: ${s.error}`); else if (a.mini) MINI['A-' + a.cid] = a.mini; }
          catch (x) { if (x.message === 'sesion') return; fallos.push(`${archivos[i].name}: ${x.message}`); }
        }
        MENSAJE = fallos.length ? 'No se pudieron subir: ' + fallos.join('; ') : 'Archivos agregados.';
        vistaEvidencia(e.id);
      });
    }
  }

  /* ── Secretaría: datos compartidos ── */
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
    const con = new Set(Object.keys(primera)), cierres = {};
    (t.cierres || []).forEach(c => { cierres[c.dane_ie] = c; });
    const estado = d => (cierres[d] ? 'fin' : con.has(d) ? 'rep' : 'sin');
    const cuenta = { fin: 0, rep: 0, sin: 0 }, M = {};
    t.instituciones.forEach(i => {
      const k = estado(i.dane_ie), c = codMun(i); cuenta[k]++;
      const m = M[c] = M[c] || { cod: c, nombre: nomMun(c, i.municipio), n: 0, fin: 0, rep: 0, sin: 0, ies: [] };
      m.n++; m[k]++; m.ies.push(i);
    });
    const reportaron = cuenta.fin + cuenta.rep, rep = t.instituciones.filter(i => estado(i.dane_ie) !== 'sin');
    const hace7 = sumarDias(hoy(), -7);
    return { N, ev, con, cierres, estado, cuenta, reportaron, munis: Object.values(M),
      nuevas7: t.instituciones.filter(i => primera[i.dane_ie] && primera[i.dane_ie].slice(0, 10) > hace7).length,
      mat: t.instituciones.reduce((s, i) => s + (i.matricula || 0), 0), matCon: rep.reduce((s, i) => s + (i.matricula || 0), 0),
      participantes: ev.reduce((s, e) => s + e.participantes, 0) };
  }
  const universo = t => `${num(t.instituciones.length)} instituciones educativas oficiales de Caldas con sedes en la base maestra (sin Manizales, que es secretaría certificada), contadas por código DANE de institución`;
  const cabSecretaria = (titulo, bajada, extra, densa) => `<div class="cab${densa ? ' densa' : ''}"><div><h1>${titulo}</h1><p>${bajada}</p></div>
    <div class="der">${extra || ''}<button type="button" class="btn" id="b-actualizar">Actualizar</button></div></div>`;
  function enlazarActualizar(fn) { const b = $('b-actualizar'); if (b) b.addEventListener('click', async () => { b.disabled = true; await traerTodo(true); fn(); aviso('Datos actualizados.'); }); }

  /* Registros por día, desde dos semanas atrás hasta el cierre de los 16 días de activismo */
  function graficoDias(ev) {
    const hoyIso = hoy(), primero = ev.reduce((m, e) => (e.registrado.slice(0, 10) < m ? e.registrado.slice(0, 10) : m), sumarDias(hoyIso, -13));
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
    const titulo = !ev.length ? 'Aún no hay registros' : `${num(ev.length)} ${plural(ev.length, 'actividad registrada', 'actividades registradas')} en ${dias_con} ${plural(dias_con, 'día', 'días')}; el día con más fue el ${diaMes(mejor[0])} (${mejor[1]})`;
    const filas = Object.entries(cuenta).sort().map(([d, v]) => `<tr><td>${esc(fecha(d))}</td><td class="d">${v}</td></tr>`).join('');
    return { titulo, svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Registros por día. ${esc(titulo)}">${s}</svg>`,
      tabla: `<details class="datos-graf"><summary>Ver los datos por día</summary><div class="tabla-scroll"><table class="tabla densa"><thead><tr><th>Día</th><th class="d">Registros</th></tr></thead><tbody>${filas}</tbody></table></div></details>` };
  }
  function cifraPlazo() {
    const h = hoy();
    if (h < CFG.DIA) { const n = difDias(h, CFG.DIA); return { b: `${n} ${plural(n, 'día', 'días')}`, corto: 'para el 25 de noviembre' }; }
    if (h <= CFG.FIN) { const n = difDias(CFG.DIA, h) + 1; return { b: `Día ${n} de 16`, corto: `de activismo, hasta el ${diaMes(CFG.FIN)}` }; }
    return { b: 'Campaña terminada', corto: `el ${diaMes(CFG.FIN)}` };
  }

  /* ── Pantalla 1: Resumen. Arriba, sin desplazarse: las fotos en movimiento y las cifras; abajo, actividades, días y municipios ── */
  async function vistaResumen() {
    cargando();
    const t = await traerTodo(), c = calcular(t), ev = c.ev, plazo = cifraPlazo(), g = graficoDias(ev), fotos = imagenes(ev);
    const porAct = CFG.ACTIVIDADES.map((a, i) => { const l = ev.filter(e => e.actividad === a.nombre); return { i, nombre: a.nombre, n: l.length, ies: new Set(l.map(e => e.dane_ie)).size, part: l.reduce((s, e) => s + e.participantes, 0), fotos: imagenes(l).slice(0, 3) }; });
    const ordenAct = porAct.slice(0, -1).sort((a, b) => b.ies - a.ies || b.n - a.n).concat(porAct.slice(-1));
    const top = ordenAct[0];
    const munis = [...c.munis].map(m => Object.assign(m, { faltan: m.sin + m.rep })).sort((a, b) => b.faltan / b.n - a.faltan / a.n || b.faltan - a.faltan || a.nombre.localeCompare(b.nombre, 'es'));
    const peores = munis.filter(m => m.faltan).slice(0, 8);
    const nIEfotos = new Set(fotos.map(x => x.e.dane_ie)).size;
    pintar('Resumen', `
      ${cabSecretaria('Resumen de la campaña', `Datos consultados a las ${horaDe(new Date(t.en))}`, `<span class="plazo-chip"><b>${plazo.b}</b> ${plazo.corto}</span>`, true)}
      ${demoNota()}
      <div class="escena-fila">
        <section class="panel escenario" aria-labelledby="esc-h"><h2 id="esc-h" class="oculto">Fotografías de las instituciones</h2>
          <div id="carrusel">${fotos.length ? '' : vacio('Aún no hay fotografías', 'Aparecerán aquí, en movimiento, cuando las instituciones registren sus actividades.')}</div></section>
        <section class="panel cifras col" aria-label="Cifras principales">
          <div><span class="et">Instituciones que ya reportaron</span><b class="n">${num(c.reportaron)} <small>de ${num(c.N)}</small></b>
            ${barra3(c.cuenta, c.N, true)}
            <ul class="leyenda3"><li><i style="background:var(--ok-pt)"></i><b>${num(c.cuenta.fin)}</b> finalizaron</li><li><i style="background:var(--bor-pt)"></i><b>${num(c.cuenta.rep)}</b> sin finalizar</li><li><i style="background:var(--gris-pt)"></i><b>${num(c.cuenta.sin)}</b> sin reportar</li></ul>
            <span class="de">${(p => (/^menos/.test(p) ? 'Menos' + p.slice(5) : 'El ' + p))(pctDe(c.reportaron, c.N))} de las oficiales, con ${num(c.matCon)} de los ${num(c.mat)} estudiantes matriculados (${pctDe(c.matCon, c.mat)}).</span>
            <span class="tend${c.nuevas7 ? '' : ' cero'}">${c.nuevas7 ? `${num(c.nuevas7)} ${plural(c.nuevas7, 'empezó', 'empezaron')} en los últimos 7 días` : 'Ninguna empezó en los últimos 7 días'}</span>
            <a href="#pendientes">Ver las ${num(c.cuenta.sin + c.cuenta.rep)} que faltan</a></div>
          <div><span class="et">Participantes en las actividades</span><b class="n">${num(c.participantes)}</b>
            <span class="de">En ${num(ev.length)} ${plural(ev.length, 'actividad registrada', 'actividades registradas')}, con ${num(fotos.length)} ${plural(fotos.length, 'fotografía', 'fotografías')}. Es la suma de lo que reporta cada institución.</span>
            <a href="#evidencias">Ver las evidencias</a></div>
        </section>
      </div>
      <section class="panel" id="acts"><div class="cab-panel"><h2>${top && top.n ? `«${esc(top.nombre)}» es la actividad que más instituciones hicieron: ${num(top.ies)}` : 'Aún no hay actividades registradas'}</h2><a href="#evidencias">Ver todas las evidencias</a></div>
        <p class="sub">Cuántas instituciones hicieron cada actividad, de las ${num(c.con.size)} que ya tienen registros. Cada una lleva a sus evidencias.</p>
        <div class="acts">${ordenAct.map(a => `<a class="act" href="#evidencias?act=${encodeURIComponent(a.nombre)}">
            <span class="act-mos m${Math.max(1, a.fotos.length)}">${a.fotos.length ? a.fotos.map(x => `<span class="img" data-mini="${esc(x.a.id)}"></span>`).join('') : '<span class="img vacia">Sin fotos todavía</span>'}</span>
            <span class="act-cuerpo"><span class="act-n"><b class="n">${num(a.ies)}</b> ${plural(a.ies, 'institución', 'instituciones')}</span><h3>${esc(a.nombre)}</h3>
              <span class="m-barra" aria-hidden="true"><i style="width:${c.con.size ? Math.round(100 * a.ies / c.con.size) : 0}%"></i></span>
              <small>${num(a.n)} ${plural(a.n, 'registro', 'registros')}, ${num(a.part)} participantes</small></span></a>`).join('')}</div></section>
      <div class="rejilla">
        <section class="panel c7 grafico"><h2>${esc(g.titulo)}</h2><p class="sub">Registros guardados por día. La línea naranja marca el 25 de noviembre.</p>${g.svg}${g.tabla}</section>
        <section class="panel c5" id="munis"><div class="cab-panel"><h2>${peores.length ? `Faltan más en ${esc(lista(peores.slice(0, 3).map(m => m.nombre)))}` : 'Todos los municipios finalizaron'}</h2></div>
          <p class="sub">Municipios con más instituciones pendientes, en proporción. Cada uno lleva a sus instituciones.</p>
          <ul class="munis-c">${peores.map(m => `<li><a href="#pendientes?mun=${m.cod}"><span class="nom">${esc(m.nombre)}</span>${barra3(m, m.n)}<span class="cuenta">faltan ${m.faltan} de ${m.n}</span></a></li>`).join('')}</ul>
          <a class="enlace-sutil" href="#pendientes">Ver los ${c.munis.length} municipios</a></section>
      </div>
      <p class="nota-universo">Universo: ${esc(universo(t))}. «Finalizó» es la institución que confirmó que terminó de reportar; «sin finalizar», la que tiene registros pero no ha confirmado.</p>`);
    if (MENSAJE) { aviso(MENSAJE); MENSAJE = ''; }
    enlazarActualizar(vistaResumen);
    if (fotos.length) CARR = carrusel($('carrusel'), fotos, `${num(fotos.length)} ${plural(fotos.length, 'fotografía', 'fotografías')} de ${num(nIEfotos)} ${plural(nIEfotos, 'institución', 'instituciones')}`);
    const acts = $('acts'); cargarMinis([...acts.querySelectorAll('[data-mini]')].map(x => x.dataset.mini)).then(() => ponerMinis(acts)).catch(() => {});
  }

  /* ── Pantalla 2: Evidencias. Mosaico de fotos que se abre en el visor, o tabla ── */
  function teselas(filas, grande) {
    return filas.map((e, k) => {
      const f = e.archivos.filter(esImg), lugar = `${esc(nomMun(codMun(e), e.municipio))}, ${esc(diaMes(e.fecha_actividad))}`;
      if (!f.length) return `<a class="tesela sin-foto" href="#evidencia/${esc(e.id)}"><span class="ts-ico">${e.enlace ? 'Video o enlace' : 'Documento PDF'}</span>
        <span class="ts-pie"><span class="chip e-neutro">${esc(e.actividad)}</span><b>${esc(e.institucion)}</b><small>${lugar}</small></span></a>`;
      return `<button type="button" class="tesela${grande && k === 0 ? ' grande' : ''}" data-e="${esc(e.id)}" aria-label="Ver ${f.length} ${plural(f.length, 'foto', 'fotos')}: ${esc(e.actividad)}, ${esc(e.institucion)}">
        <span class="img" data-mini="${esc(f[0].id)}"></span>${f.length > 1 ? `<span class="ts-n">${f.length} fotos</span>` : ''}
        <span class="ts-pie"><span class="chip e-neutro">${esc(e.actividad)}</span><b>${esc(e.institucion)}</b><small>${lugar}, ${num(e.participantes)} participantes</small></span></button>`;
    }).join('');
  }
  function enlazarTeselas(raiz, filas) {
    const items = imagenes(filas);
    raiz.addEventListener('click', ev => { const b = ev.target.closest('button[data-e]'); if (!b) return; const k = items.findIndex(x => x.e.id === b.dataset.e); if (k >= 0) abrirVisor(items, k); });
    minisPerezosas(raiz);
  }
  async function vistaEvidencias(q) {
    cargando();
    const t = await traerTodo(), ev = t.evidencias, c = calcular(t);
    const ver = q.ver === 'tabla' ? 'tabla' : 'galeria', fMun = q.mun || '', fAct = q.act || '', fTxt = q.q || '';
    const municipios = [...new Set(t.instituciones.map(i => codMun(i)))].sort((a, b) => nomMun(a).localeCompare(nomMun(b), 'es'));
    const base = ev.filter(e => (!fMun || codMun(e) === fMun) && (!fTxt || norm(e.institucion).includes(norm(fTxt))));
    const filas = recientes(base.filter(e => !fAct || e.actividad === fAct));
    const href = o => { const p = Object.assign({ ver, mun: fMun, act: fAct, q: fTxt }, o); return '#evidencias?' + Object.keys(p).filter(k => p[k] && !(k === 'ver' && p[k] === 'galeria')).map(k => k + '=' + encodeURIComponent(p[k])).join('&'); };
    const visibles = filas.slice(0, limiteGaleria), nFotos = imagenes(filas).length;
    const chips = [['', 'Todas', base.length]].concat(CFG.ACTIVIDADES.map(a => [a.nombre, a.nombre, base.filter(e => e.actividad === a.nombre).length]));
    const cuerpo = !filas.length ? `<section class="panel">${vacio(ev.length ? 'No hay registros con esos filtros' : 'Aún no hay registros', ev.length ? 'Pruebe con otros filtros.' : 'Cuando una institución guarde una actividad, aparecerá aquí.')}</section>`
      : ver === 'galeria'
        ? `<div class="muro" id="muro">${teselas(visibles, true)}</div>${filas.length > visibles.length ? `<p style="margin-top:16px;text-align:center"><button type="button" class="btn" id="b-mas">Mostrar ${Math.min(POR_PAGINA, filas.length - visibles.length)} más</button></p>` : ''}`
        : `<section class="panel"><div class="tabla-scroll alto"><table class="tabla densa"><thead><tr><th>Registrada</th><th>Institución</th><th>Estado</th><th>Actividad</th><th class="d">Participantes</th><th class="d">Fotos</th><th><span class="oculto">Acción</span></th></tr></thead><tbody>${filas.map(e => `<tr>
          <td>${esc(fechaHora(e.registrado))}</td><td><a href="#institucion/${esc(e.dane_ie)}">${esc(e.institucion)}</a><span class="sec">${esc(nomMun(codMun(e), e.municipio))}</span></td><td>${chipEstado(c.estado(e.dane_ie))}</td><td>${esc(e.actividad)}</td>
          <td class="d">${num(e.participantes)}</td><td class="d">${e.archivos.filter(esImg).length}</td><td><a class="btn sutil" href="#evidencia/${esc(e.id)}">Ver<span class="oculto"> ${esc(e.institucion)}, ${esc(e.actividad)}</span></a></td></tr>`).join('')}</tbody></table></div></section>`;
    pintar('Evidencias', `
      ${cabSecretaria('Evidencias registradas', `${num(ev.length)} ${plural(ev.length, 'registro', 'registros')} con ${num(imagenes(ev).length)} fotografías, de ${num(c.con.size)} de las ${num(t.instituciones.length)} instituciones del universo. Datos consultados a las ${horaDe(new Date(t.en))}`,
        `<button type="button" class="btn" id="b-csv">Descargar para Excel</button>`, true)}
      ${demoNota()}
      <section class="panel filtros-p"><form class="filtros" id="f-filtros" role="search">
        <div class="campo"><label for="f-q">Institución</label><input id="f-q" type="search" value="${esc(fTxt)}" placeholder="Buscar por nombre"></div>
        <div class="campo"><label for="f-mun">Municipio</label><select id="f-mun"><option value="">Todos los municipios</option>${municipios.map(m => `<option value="${m}"${m === fMun ? ' selected' : ''}>${esc(nomMun(m))}</option>`).join('')}</select></div>
        <div class="der"><div class="seg" role="group" aria-label="Cómo ver"><button type="button" data-ver="galeria" aria-pressed="${ver === 'galeria'}">Fotos</button><button type="button" data-ver="tabla" aria-pressed="${ver === 'tabla'}">Tabla</button></div></div>
      </form>
      <nav class="chips-act" aria-label="Actividad">${chips.map(([v, et, n]) => `<a href="${href({ act: v })}"${v === fAct ? ' aria-current="true"' : ''}>${esc(et)} <span class="n">${n}</span></a>`).join('')}</nav>
      <p class="sub" role="status" style="margin:8px 0 0">${num(filas.length)} ${plural(filas.length, 'registro', 'registros')} con ${num(nFotos)} ${plural(nFotos, 'fotografía', 'fotografías')}${fMun || fAct || fTxt ? ' con los filtros elegidos' : ''}. ${ver === 'galeria' && nFotos ? 'Toque una foto para verla en grande y pasar a la siguiente.' : ''}</p></section>
      ${cuerpo}`);
    enlazarActualizar(() => vistaEvidencias(q));
    $('b-csv').addEventListener('click', () => descargarCSV('registros', filas, c));
    main.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => { location.hash = href({ ver: b.dataset.ver }); }));
    $('f-mun').addEventListener('change', ev2 => { limiteGaleria = POR_PAGINA; location.hash = href({ mun: ev2.target.value }); });
    $('f-filtros').addEventListener('submit', ev2 => { ev2.preventDefault(); limiteGaleria = POR_PAGINA; location.hash = href({ q: $('f-q').value.trim() }); });
    const fq = $('f-q'); fq.addEventListener('search', () => { location.hash = href({ q: fq.value.trim() }); });
    const mas = $('b-mas'); if (mas) mas.addEventListener('click', () => { limiteGaleria += POR_PAGINA; const y = window.scrollY; vistaEvidencias(q).then(() => window.scrollTo(0, y)); });
    const muro = $('muro'); if (muro) enlazarTeselas(muro, visibles);
  }

  /* ── Pantalla 3: Las que faltan. Por municipio (tarjetas con anillo) o en lista; con recordatorio para copiar ── */
  async function vistaPendientes(q) {
    cargando();
    const t = await traerTodo(), c = calcular(t), fMun = q.mun || '', fEst = q.est === 'sin' || q.est === 'rep' ? q.est : '', ver = q.ver === 'lista' ? 'lista' : 'municipios';
    const pend = i => { const k = c.estado(i.dane_ie); return k !== 'fin' && (!fEst || k === fEst); };
    const href = o => { const p = Object.assign({ ver, mun: fMun, est: fEst }, o); return '#pendientes?' + Object.keys(p).filter(k => p[k] && !(k === 'ver' && p[k] === 'municipios')).map(k => k + '=' + encodeURIComponent(p[k])).join('&'); };
    const munis = c.munis.filter(m => !fMun || m.cod === fMun).map(m => Object.assign({}, m, { pend: m.ies.filter(pend).sort((a, b) => a.institucion.localeCompare(b.institucion, 'es')) }))
      .sort((a, b) => b.pend.length - a.pend.length || a.nombre.localeCompare(b.nombre, 'es'));
    const conPend = munis.filter(m => m.pend.length), completos = munis.filter(m => !m.pend.length);
    const faltan = conPend.flatMap(m => m.pend), regs = d => c.ev.filter(e => e.dane_ie === d).length;
    const municipios = [...c.munis].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const tarjeta = m => `<article class="mun-t" aria-labelledby="mt-${m.cod}">
        <div class="mt-cab"><div class="anillo mini" data-anillo="${m.cod}"></div><div><h3 id="mt-${m.cod}">${esc(m.nombre)}</h3><p>${m.pend.length ? `${m.pend.length} de ${m.n} ${plural(m.n, 'institución', 'instituciones')} ${fEst === 'sin' ? 'sin reportar' : fEst === 'rep' ? 'sin finalizar' : 'pendientes'}` : `Las ${m.n} finalizaron`}</p></div></div>
        ${m.pend.length ? `<ul class="mt-lista">${m.pend.map(i => `<li>${chipEstado(c.estado(i.dane_ie))}<span><b>${esc(i.institucion)}</b><small translate="no">${dane(i.dane_ie)}${c.estado(i.dane_ie) === 'rep' ? `, ${regs(i.dane_ie)} ${plural(regs(i.dane_ie), 'registro', 'registros')}` : ''}</small></span></li>`).join('')}</ul>
          <button type="button" class="btn mt-copiar" data-copiar="${m.cod}">Copiar recordatorio</button>` : ''}</article>`;
    pintar('Las que faltan', `
      ${cabSecretaria('Instituciones que faltan', `${num(c.cuenta.sin)} no han reportado y ${num(c.cuenta.rep)} tienen registros pero no han finalizado, de las ${num(c.N)} del universo. Datos consultados a las ${horaDe(new Date(t.en))}`,
        `<button type="button" class="btn" id="b-csv">Descargar para Excel</button>`, true)}
      ${demoNota()}
      <section class="panel filtros-p"><div class="filtros" style="margin-bottom:0">
        <div class="seg" role="group" aria-label="Cómo ver"><button type="button" data-ver="municipios" aria-pressed="${ver === 'municipios'}">Por municipio</button><button type="button" data-ver="lista" aria-pressed="${ver === 'lista'}">Lista</button></div>
        <nav class="chips-act" aria-label="Estado">${[['', 'Todas las que faltan', c.cuenta.sin + c.cuenta.rep], ['sin', 'Sin reportar', c.cuenta.sin], ['rep', 'Sin finalizar', c.cuenta.rep]].map(([v, et, n]) => `<a href="${href({ est: v })}"${v === fEst ? ' aria-current="true"' : ''}>${v ? `<i class="pt" style="background:var(--${ESTADO[v].k}-pt)"></i>` : ''}${et} <span class="n">${n}</span></a>`).join('')}</nav>
        <div class="campo" style="max-width:280px"><label for="f-mun">Municipio</label><select id="f-mun"><option value="">Todos los municipios</option>${municipios.map(m => `<option value="${m.cod}"${m.cod === fMun ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></div></div></section>
      ${!faltan.length ? `<section class="panel">${vacio(fMun ? 'En este municipio no falta ninguna' : 'No falta ninguna institución', 'Todas finalizaron su reporte.')}</section>`
        : ver === 'municipios' ? `<div class="munis-tar">${conPend.map(tarjeta).join('')}</div>
          ${completos.length ? `<p class="sub" style="margin-top:16px">${completos.length === 1 ? 'Un municipio' : `${completos.length} municipios`} sin pendientes${fEst ? ' en este estado' : ''}: ${esc(lista(completos.map(m => m.nombre)))}.</p>` : ''}`
        : `<section class="panel"><div class="tabla-scroll"><table class="tabla densa"><thead><tr><th>Institución</th><th>Código DANE</th><th>Estado</th><th class="d">Registros</th><th class="d">Sedes</th><th class="d">Matrícula</th></tr></thead><tbody>
          ${[...conPend].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(m => `<tr class="grupo"><th colspan="6" scope="colgroup">${esc(m.nombre)}<small>${m.pend.length} de ${m.n} pendientes</small></th></tr>` +
            m.pend.map(i => `<tr><td>${c.estado(i.dane_ie) === 'rep' ? `<a href="#institucion/${i.dane_ie}">${esc(i.institucion)}</a>` : esc(i.institucion)}</td><td class="n" translate="no">${dane(i.dane_ie)}</td><td>${chipEstado(c.estado(i.dane_ie))}</td><td class="d">${regs(i.dane_ie)}</td><td class="d">${i.num_sedes}</td><td class="d">${num(i.matricula || 0)}</td></tr>`).join('')).join('')}
          </tbody></table></div></section>`}`);
    enlazarActualizar(() => vistaPendientes(q));
    main.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => { location.hash = href({ ver: b.dataset.ver }); }));
    $('f-mun').addEventListener('change', ev => { location.hash = href({ mun: ev.target.value }); });
    $('b-csv').addEventListener('click', () => descargarCSV('faltan', faltan, c));
    main.querySelectorAll('[data-anillo]').forEach(el => { const m = c.munis.find(x => x.cod === el.dataset.anillo); anillo(el, m.ies.map(i => ESTADO[c.estado(i.dane_ie)].k), `${m.fin}/${m.n}`, 'finalizaron'); });
    main.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
      const m = conPend.find(x => x.cod === b.dataset.copiar), url = location.origin + location.pathname;
      const txt = `Evidencias del 25 de noviembre, ${m.nombre}.\nEstas instituciones aún no terminan su reporte:\n` +
        m.pend.map(i => `- ${nombrePropio(i.institucion)} (código ${i.dane_ie}): ${c.estado(i.dane_ie) === 'rep' ? 'tiene registros, falta finalizar el reporte' : 'no ha registrado actividades'}`).join('\n') +
        `\nSe entra con el código DANE de la institución en ${url}`;
      try { await navigator.clipboard.writeText(txt); aviso('Recordatorio copiado. Péguelo en el correo o el chat.'); } catch (e) { aviso('No se pudo copiar. Use la descarga para Excel.'); }
    }));
  }

  /* ── Todo lo de una institución (Secretaría): estado, cierre, sus registros y fotos; reabrir, a decidir ── */
  async function vistaInstitucion(d) {
    cargando();
    const t = await traerTodo(), c = calcular(t), ie = t.instituciones.find(i => i.dane_ie === d);
    if (!ie) { location.hash = '#evidencias'; return; }
    const ev = recientes(t.evidencias.filter(e => e.dane_ie === d)), k = c.estado(d), cierre = c.cierres[d];
    const A = CFG.ACTIVIDADES, porAct = A.map(a => ev.filter(e => e.actividad === a.nombre).length);
    pintar(ie.institucion, `
      <p class="migas"><a href="#evidencias">Evidencias</a> / ${esc(ie.institucion)}</p>
      <section class="panel heroe-ie sec">
        <div class="anillo chico" id="anillo"></div>
        <div class="hi-id"><h1>${esc(ie.institucion)}</h1><p>${esc(nomMun(codMun(ie), ie.municipio))}, código <span translate="no">${dane(ie.dane_ie)}</span>, ${ie.num_sedes} ${plural(ie.num_sedes, 'sede', 'sedes')}, ${num(ie.matricula || 0)} estudiantes</p>${chipEstado(k)}</div>
        <dl class="mini-cifras"><div><dt>Registros</dt><dd class="n">${num(ev.length)}</dd></div><div><dt>Participantes</dt><dd class="n">${num(ev.reduce((s, e) => s + e.participantes, 0))}</dd></div><div><dt>Fotografías</dt><dd class="n">${num(imagenes(ev).length)}</dd></div></dl>
      </section>
      ${cierre ? `<section class="panel fin-banner sec"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--ok-pt)"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div><h2>${cierre.sin_actividades ? 'Finalizó sin actividades' : 'Finalizó su reporte'}</h2><p>El ${esc(fechaHora(cierre.fecha))}, por ${esc(nombrePropio(cierre.nombre))} (${esc(cierre.cargo.toLowerCase())}, <span translate="no">${esc(cierre.correo)}</span>). Código de verificación <b translate="no">${esc(cierre.codigo)}</b>.</p>
          ${cierre.sin_actividades ? `<p>Motivo: ${esc(cierre.motivo)}</p>` : ''}</div>
        <button type="button" class="btn" id="b-reabrir">Reabrir el reporte</button></section>` : ''}
      ${ev.length ? `<h2 class="seccion">Lo que registró</h2><div class="muro" id="muro">${teselas(ev, false)}</div>` : `<section class="panel">${vacio('Esta institución no tiene registros', k === 'fin' ? 'Finalizó sin actividades.' : 'Aún no ha registrado ninguna actividad.')}</section>`}`);
    anillo($('anillo'), porAct.map(n => (n ? 'ok' : 'gris')), `${porAct.filter(Boolean).length}/${A.length}`, 'actividades');
    const muro = $('muro'); if (muro) enlazarTeselas(muro, ev);
    const b = $('b-reabrir'); if (b) b.addEventListener('click', () => {
      const dl = document.createElement('dialog'); dl.className = 'dialogo';
      dl.innerHTML = `<h2>¿Reabrir el reporte?</h2><p>La institución podrá volver a registrar y corregir, y tendrá que finalizar de nuevo. Queda en el historial que usted lo reabrió.</p>
        <div class="acciones"><button type="button" class="btn" id="ra-no">Cancelar</button><button type="button" class="btn pri" id="ra-si">Reabrir el reporte</button></div>`;
      document.body.appendChild(dl); dl.showModal(); dl.addEventListener('close', () => dl.remove());
      $('ra-no').addEventListener('click', () => dl.close());
      $('ra-si').addEventListener('click', async () => { const r = await api('reabrirReporte', { dane_ie: d }); dl.close(); if (!r.ok) return aviso(r.error); await traerTodo(true); MENSAJE = ''; aviso('Reporte reabierto.'); vistaInstitucion(d); });
    });
  }

  function descargarCSV(tipo, filas, c) {
    const cel = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    const texto = d => '="' + d + '"';   // Excel no convierte el código DANE a notación científica
    const sin = tipo === 'faltan';
    const enc = sin ? ['Municipio', 'Institución', 'Código DANE I.E.', 'Estado', 'Registros', 'Sedes', 'Matrícula']
      : ['Registrada', 'Municipio', 'Institución', 'Código DANE I.E.', 'Estado de la institución', 'Actividad', 'Fecha de la actividad', 'Participantes', 'Fotos', 'Enlace', 'Versión', 'Descripción'];
    const cuerpo = filas.map(f => (sin
      ? [cel(nomMun(codMun(f))), cel(f.institucion), texto(f.dane_ie), cel(ESTADO[c.estado(f.dane_ie)].et), c.ev.filter(e => e.dane_ie === f.dane_ie).length, f.num_sedes, f.matricula || 0]
      : [cel(f.registrado.replace('T', ' ')), cel(nomMun(codMun(f), f.municipio)), cel(f.institucion), texto(f.dane_ie), cel(ESTADO[c.estado(f.dane_ie)].et), cel(f.actividad), cel(f.fecha_actividad), f.participantes, f.archivos.filter(esImg).length, cel(f.enlace), f.version, cel(f.descripcion)]).join(';'));
    const blob = new Blob(['﻿' + enc.map(cel).join(';') + '\r\n' + cuerpo.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `evidencias25N_${tipo}_${hoy()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  router();
})();
