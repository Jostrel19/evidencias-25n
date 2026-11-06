/* app/js/ilustracion.js — Ilustración de la portada: cinco mujeres de distintas edades tomadas de la mano; la niña del centro
   levanta las manos con las dos adultas que la acompañan. Dibujo propio en SVG, solo con los colores de base.css
   (verde y oro institucionales y el naranja del 25N, --c-des-*). Decorativa: aria-hidden, el texto de la página dice lo mismo. */
window.ILUSTRACION = (function () {
  const BASE = 296;
  const st = v => `style="fill:var(${v})"`;
  const PERSONAS = [
    { x: 92, h: 204, vestido: '--v7', piel: '--c-des-tx', pelo: 'largo' },
    { x: 188, h: 172, vestido: '--c-des-pt', piel: '--oro0', pelo: 'mono' },
    { x: 280, h: 128, vestido: '--oro', piel: '--oro0', pelo: 'cola' },
    { x: 372, h: 178, vestido: '--v8', piel: '--oro', pelo: 'rizos' },
    { x: 468, h: 198, vestido: '--c-des-tx', piel: '--oro0', pelo: 'corto' }
  ];
  const medidas = p => {
    const r = p.h * 0.075, cy = BASE - p.h + r, hombro = cy + r + p.h * 0.05;
    return { r, cy, hombro, ancho: p.h * 0.11, cintura: hombro + p.h * 0.2, ruedo: BASE - p.h * 0.2, mano: hombro + p.h * 0.36 };
  };
  function pelo(p, m, atras) {
    const { x } = p, { r, cy } = m, osc = st('--t1');
    if (atras) {
      if (p.pelo === 'largo') return `<path d="M${x - r * 1.15} ${cy}Q${x - r * 1.3} ${cy + r * 2.6} ${x - r * 0.9} ${cy + r * 3.3}H${x + r * 0.9}Q${x + r * 1.3} ${cy + r * 2.6} ${x + r * 1.15} ${cy}Z" ${osc}/>`;
      if (p.pelo === 'rizos') return `<circle cx="${x}" cy="${cy - r * 0.15}" r="${r * 1.5}" ${osc}/>`;
      if (p.pelo === 'cola') return `<path d="M${x + r * 0.7} ${cy - r * 0.5}Q${x + r * 2.4} ${cy + r * 0.2} ${x + r * 1.5} ${cy + r * 2.2}Q${x + r * 1.4} ${cy + r * 0.9} ${x + r * 0.6} ${cy + r * 0.2}Z" ${osc}/>`;
      if (p.pelo === 'corto') return `<path d="M${x - r * 1.12} ${cy - r * 0.1}V${cy + r * 1.05}H${x + r * 1.12}V${cy - r * 0.1}Z" ${osc}/>`;
      return '';
    }
    const gorro = `<path d="M${x - r * 1.06} ${cy - r * 0.05}A${r * 1.06} ${r * 1.06} 0 0 1 ${x + r * 1.06} ${cy - r * 0.05}Q${x + r * 0.35} ${cy - r * 0.75} ${x - r * 0.2} ${cy - r * 0.62}Q${x - r * 0.75} ${cy - r * 0.5} ${x - r * 1.06} ${cy - r * 0.05}Z" ${osc}/>`;
    const mono = p.pelo === 'mono' ? `<circle cx="${x}" cy="${cy - r * 1.15}" r="${r * 0.55}" ${osc}/>` : '';
    return p.pelo === 'rizos' ? '' : mono + gorro;
  }
  function persona(p) {
    const m = medidas(p), { x } = p, w = m.ancho, cw = p.h * 0.075, rw = p.h * 0.17, pierna = p.h * 0.05;
    const vestido = `<path d="M${x - w} ${m.hombro + 6}Q${x - w} ${m.hombro} ${x - w + 6} ${m.hombro}H${x + w - 6}Q${x + w} ${m.hombro} ${x + w} ${m.hombro + 6}L${x + cw} ${m.cintura}L${x + rw} ${m.ruedo}Q${x} ${m.ruedo + 8} ${x - rw} ${m.ruedo}L${x - cw} ${m.cintura}Z" ${st(p.vestido)}/>`;
    const piernas = [-1, 1].map(s => `<line x1="${x + s * p.h * 0.05}" y1="${m.ruedo - 4}" x2="${x + s * p.h * 0.05}" y2="${BASE}" style="stroke:var(--t1)" stroke-width="${pierna}" stroke-linecap="round"/>`).join('');
    const cuello = `<rect x="${x - m.r * 0.35}" y="${m.cy + m.r * 0.7}" width="${m.r * 0.7}" height="${m.hombro - m.cy - m.r * 0.5}" ${st(p.piel)}/>`;
    return pelo(p, m, true) + piernas + cuello + vestido + `<circle cx="${x}" cy="${m.cy}" r="${m.r}" ${st(p.piel)}/>` + pelo(p, m, false);
  }
  // Brazos: cada pareja de vecinas se da la mano en el punto medio; con la niña del centro, las manos van arriba.
  function brazos() {
    let s = '';
    for (let i = 0; i < PERSONAS.length - 1; i++) {
      const a = PERSONAS[i], b = PERSONAS[i + 1], ma = medidas(a), mb = medidas(b);
      const arriba = i === 1 || i === 2, mx = (a.x + b.x) / 2;
      const my = arriba ? Math.min(ma.cy, mb.cy) - 34 : (ma.mano + mb.mano) / 2;
      [[a, ma, 1], [b, mb, -1]].forEach(([p, m, lado]) => {
        s += `<line x1="${p.x + lado * (m.ancho - 3)}" y1="${m.hombro + 5}" x2="${mx}" y2="${my}" style="stroke:var(${p.vestido})" stroke-width="${p.h * 0.05}" stroke-linecap="round"/>`;
      });
      s += `<circle cx="${mx}" cy="${my}" r="${Math.min(a.h, b.h) * 0.035}" ${st(a.piel)}/>`;
    }
    // Brazos exteriores de los extremos, sueltos hacia abajo
    [[PERSONAS[0], -1], [PERSONAS[PERSONAS.length - 1], 1]].forEach(([p, lado]) => {
      const m = medidas(p), hx = p.x + lado * (m.ancho + p.h * 0.06), hy = m.mano + p.h * 0.03;
      s += `<line x1="${p.x + lado * (m.ancho - 3)}" y1="${m.hombro + 5}" x2="${hx}" y2="${hy}" style="stroke:var(${p.vestido})" stroke-width="${p.h * 0.05}" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="${p.h * 0.033}" ${st(p.piel)}/>`;
    });
    return s;
  }
  const fondo = `<circle cx="280" cy="172" r="140" style="fill:var(--c-des-pt);opacity:.13"/>
    <circle cx="470" cy="62" r="30" style="fill:var(--oro);opacity:.45"/><circle cx="84" cy="70" r="16" style="fill:var(--v7);opacity:.22"/>
    <ellipse cx="280" cy="${BASE + 4}" rx="250" ry="9" style="fill:var(--c-des-tx);opacity:.12"/>`;
  return `<svg class="ilus" viewBox="0 0 560 320" aria-hidden="true" focusable="false">${fondo}${brazos()}${PERSONAS.map(persona).join('')}</svg>`;
})();
