/* app/js/demo.js — Backend de demostración: la misma API que backend/Codigo.gs, guardada en localStorage.
   Solo se usa si CONFIG.BACKEND_URL está vacío. Instituciones, usuario y registros son de ejemplo (códigos ficticios, uno a
   cuatro por municipio real); en producción la lista real vive en las hojas del backend y nunca viaja en este sitio. */
window.DEMO = (function () {
  const LLAVE = 'ev25n_demo';
  const USUARIOS = [{ correo: 'coordinacion@ejemplo.gov.co', nombre: 'ANA MARÍA PÉREZ', cargo: 'Profesional de convivencia escolar (ejemplo)' }];
  const nombres = () => window.CONFIG.ACTIVIDADES.map(a => a.nombre);
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  let ultimoCodigo = '', _otp = {};

  let _inst = null;
  function instituciones() {
    if (_inst) return _inst;
    _inst = [];
    ((window.MAPA && window.MAPA.munis) || []).filter(m => m.code !== '17001').forEach(m => {
      const k = 2 + (Number(m.code) % 3);
      for (let i = 1; i <= k; i++) {
        const sedes = 1 + ((Number(m.code) + i * 7) % 9);
        _inst.push({ dane_ie: '2' + m.code + '900' + String(i).padStart(3, '0'),
          institucion: `INSTITUCIÓN EDUCATIVA DE EJEMPLO ${sinTilde(m.name).toUpperCase()} ${i}`,
          municipio: sinTilde(m.name).toUpperCase(), num_sedes: sedes, matricula: 90 * sedes + ((Number(m.code) * i) % 260) });
      }
    });
    return _inst;
  }

  function leer() { try { return JSON.parse(localStorage.getItem(LLAVE)) || { ev: [], n: 0 }; } catch (e) { return { ev: [], n: 0 }; } }
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
      const mias = leer().ev.filter(e => e.dane_ie === s.dane_ie).map(pub).sort((a, c) => (a.registrado < c.registrado ? 1 : -1));
      return { ok: true, institucion: ie, evidencias: mias, actividades: nombres() };
    },
    crearEvidencia(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const err = validar(b); if (err) return NO(err);
      const base = leer();
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
      const err = validar(b); if (err) return NO(err);
      const base = leer(); const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      Object.assign(e, campos(b), { version: e.version + 1, actualizado: ahora() }); guardar(base);
      return { ok: true, evidencia: pub(e) };
    },
    subirArchivo(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = leer(); const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      if (e.archivos.some(a => a.cid === b.cid)) return { ok: true, evidencia: pub(e), repetido: true };
      if (e.archivos.length >= 10) return NO('Se pueden adjuntar hasta 10 archivos por actividad.');
      const id = 'A-' + b.cid;
      e.archivos.push({ id, cid: b.cid, nombre: b.nombre, mime: b.mime || 'image/jpeg', tamano: Math.round(String(b.contenido_base64).length * 0.75) });
      e.actualizado = ahora();
      guardarItem('_f_' + id, b.contenido_base64);
      if (b.miniatura && !e.con_miniatura) { guardarItem('_m_' + e.id, b.miniatura); e.con_miniatura = true; }
      guardar(base);
      return { ok: true, evidencia: pub(e) };
    },
    quitarArchivo(b) {
      const s = ieDe(b); if (!s) return SIN_SESION;
      const base = leer(); const e = base.ev.find(x => x.id === b.id && x.dane_ie === s.dane_ie);
      if (!e) return NO('No se encontró esa evidencia en su institución.');
      e.archivos = e.archivos.filter(a => a.id !== b.archivo_id); e.actualizado = ahora(); guardar(base);
      try { localStorage.removeItem(LLAVE + '_f_' + b.archivo_id); } catch (x) { /* nada */ }
      return { ok: true, evidencia: pub(e) };
    },
    verArchivo(b) {
      const s = sesion(b.token); if (!s) return SIN_SESION;
      const e = leer().ev.find(x => x.id === b.id);
      if (!e || (s.rol === 'IE' && e.dane_ie !== s.dane_ie)) return NO('No se encontró esa evidencia.');
      const a = e.archivos.find(x => x.id === b.archivo_id); if (!a) return NO('No se encontró ese archivo.');
      const c = localStorage.getItem(LLAVE + '_f_' + a.id);
      if (!c) return NO('En la demostración este archivo no quedó guardado (sin espacio en el navegador).');
      return { ok: true, nombre: a.nombre, mime: a.mime, contenido_base64: c };
    },
    verMiniaturas(b) {
      const s = sesion(b.token); if (!s) return SIN_SESION;
      const ev = leer().ev, salida = {};
      (b.ids || []).slice(0, 24).forEach(id => {
        const e = ev.find(x => x.id === id); if (!e || (s.rol === 'IE' && e.dane_ie !== s.dane_ie)) return;
        const m = localStorage.getItem(LLAVE + '_m_' + id); if (m) salida[id] = m;
      });
      return { ok: true, miniaturas: salida };
    },
    listarTodo(b) {
      const s = revDe(b); if (!s) return SIN_SESION;
      return { ok: true, usuario: USUARIOS.find(u => u.correo === s.correo), instituciones: instituciones(), evidencias: leer().ev.map(pub), actividades: nombres() };
    }
  };

  async function llamar(accion, datos) {
    await new Promise(r => setTimeout(r, 120));
    const f = acciones[accion];
    const r = f ? f(datos) : NO('Acción desconocida: ' + accion);
    r.accion = accion; return r;
  }

  /* Foto de ejemplo dibujada en el navegador: una pared con tarjetas de colores, como un mural o un muro de compromisos. */
  function fotoEjemplo(semilla, ancho, alto) {
    let s = semilla; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const c = document.createElement('canvas'); c.width = ancho; c.height = alto; const g = c.getContext('2d');
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#999';
    const paredes = ['--c-des-bg', '--v0', '--oro0', '--sup2'], tarjetas = ['--c-des-pt', '--oro', '--v7', '--env-pt', '--c-res-pt', '--sin-pt'];
    g.fillStyle = css(paredes[semilla % paredes.length]); g.fillRect(0, 0, ancho, alto);
    g.fillStyle = css('--contorno'); g.fillRect(0, alto * 0.78, ancho, alto * 0.22);
    g.fillStyle = css('--sup'); g.fillRect(ancho * 0.1, alto * 0.12, ancho * 0.8, alto * 0.58);
    for (let i = 0; i < 14; i++) {
      g.save(); g.translate(ancho * (0.16 + az() * 0.66), alto * (0.18 + az() * 0.44)); g.rotate((az() - 0.5) * 0.5);
      g.fillStyle = css(tarjetas[Math.floor(az() * tarjetas.length)]); g.fillRect(-ancho * 0.05, -alto * 0.05, ancho * 0.1, alto * 0.1); g.restore();
    }
    return c.toDataURL('image/jpeg', 0.72);
  }

  /* Reparte registros de ejemplo en las instituciones, con fechas de los últimos días; determinista. */
  function sembrar() {
    let s = 7; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const base = { ev: [], n: 0 }, acts = window.CONFIG.ACTIVIDADES, ins = instituciones();
    const desc = ['Mural con frases del grado noveno y décimo.', 'Escenas breves con los estudiantes de bachillerato.', 'Video corto con mensajes de los estudiantes.',
      'Árbol de compromisos en el patio central.', 'Punto informativo con la ruta municipal y volantes.', 'Jornada con docentes y familias.'];
    ins.forEach(ie => {
      if (az() > 0.12 + (ie.municipio.length % 5) * 0.13) return;
      const k = 1 + Math.floor(az() * 3);
      for (let j = 0; j < k; j++) {
        const d = new Date(); d.setDate(d.getDate() - Math.floor(az() * 14)); d.setHours(7 + Math.floor(az() * 10), Math.floor(az() * 60), 0, 0);
        const ts = local(d), a = Math.floor(az() * acts.length);
        base.n++;
        base.ev.push({ id: 'EV-DEMO-' + String(base.n).padStart(4, '0'), cid: 'sem-' + base.n, registrado: ts, actualizado: ts, dane_ie: ie.dane_ie,
          institucion: ie.institucion, municipio: ie.municipio, actividad: acts[a].nombre, fecha_actividad: ts.slice(0, 10),
          participantes: 15 + Math.floor(az() * 180), descripcion: desc[a], enlace: '', autoriza_imagen: true, archivos: [], version: 1, con_miniatura: false });
      }
    });
    // Foto y miniatura solo en los 24 más recientes, para no llenar el navegador
    [...base.ev].sort((a, b) => (a.registrado < b.registrado ? 1 : -1)).slice(0, 24).forEach((e, i) => {
      const id = 'A-sem-' + e.id;
      guardarItem('_f_' + id, fotoEjemplo(i + 3, 800, 600).split(',')[1]);
      guardarItem('_m_' + e.id, fotoEjemplo(i + 3, 320, 240));
      e.archivos.push({ id, cid: id, nombre: 'evidencia.jpg', mime: 'image/jpeg', tamano: 48000 }); e.con_miniatura = true;
    });
    guardar(base); return base.ev.length;
  }

  return { llamar, instituciones, sembrar, USUARIOS, codigo: () => ultimoCodigo,
    reiniciar() { _inst = null; _otp = {}; Object.keys(localStorage).filter(k => k.indexOf(LLAVE) === 0).forEach(k => localStorage.removeItem(k)); } };
})();
