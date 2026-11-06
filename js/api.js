/* app/js/api.js — Único punto que habla con el backend (o con la demostración si BACKEND_URL está vacío).
   Toda acción del backend es idempotente (lleva un identificador del cliente), así que reintentar siempre es seguro. */
window.API = (function () {
  const INTENTOS = 3;
  const ESPERA_MS = 60 * 1000;
  const ESPERA_ARCHIVO_MS = 3 * 60 * 1000;
  const demo = () => !window.CONFIG.BACKEND_URL;

  async function llamar(accion, datos) {
    if (demo()) return window.DEMO.llamar(accion, datos || {});
    const cuerpo = JSON.stringify(Object.assign({ accion }, datos));
    const espera = accion === 'subirArchivo' || accion === 'verArchivo' ? ESPERA_ARCHIVO_MS : ESPERA_MS;
    for (let intento = 1; ; intento++) {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), espera);
      let r = null;
      try {
        // Sin cabeceras a propósito: así es una petición «simple» y no dispara preflight, que Apps Script no responde.
        const resp = await fetch(window.CONFIG.BACKEND_URL, { method: 'POST', body: cuerpo, signal: control.signal });
        r = JSON.parse(await resp.text());
      } catch (e) { r = null; } finally { clearTimeout(reloj); }
      // Apps Script, con pedidos simultáneos, a veces responde con lo de doGet: la acción no se ejecutó.
      const noEjecutada = !r || ('mensaje' in r && 'hora' in r) || ('accion' in r && r.accion !== accion);
      if (!noEjecutada) return r;
      if (intento >= INTENTOS) {
        return { ok: false, error: 'No hubo respuesta del servidor. Revise su conexión e intente de nuevo; lo que ya envió no se pierde.' };
      }
      await new Promise(res => setTimeout(res, 800 * intento));
    }
  }
  return { llamar, demo };
})();
