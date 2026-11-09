/* js/ilustracion.js — Ilustración de la portada: cinco mujeres de distintas edades tomadas de la mano; la niña del centro
   levanta las manos con las dos adultas que la acompañan. Dibujo propio en SVG, solo con los colores de base.css
   (verde y oro institucionales y el naranja del 25N, --c-des-*). Decorativa: aria-hidden, el texto de la página dice lo mismo.
   Con movimiento (paginas-jose v2.2, §3): una ola de manos recorre la cadena (las manos unidas suben y bajan una tras otra), las de los
   extremos saludan, las cabezas se mecen y suben pétalos. Las manos se mueven con SMIL para que los brazos sigan unidos; lo demás
   con CSS. Se pausa con el botón de la portada (WCAG 2.2.2) y arranca quieta si el equipo pide menos movimiento. */
window.ILUSTRACION = (function () {
  const BASE = 296;
  const st = v => `style="fill:var(${v})"`;
  const PERSONAS = [
    { x: 92, h: 204, vestido: '--v7', piel: '--c-des-tx', pelo: 'largo', giro: -3 },
    { x: 188, h: 172, vestido: '--c-des-pt', piel: '--oro0', pelo: 'mono', giro: 3 },
    { x: 280, h: 128, vestido: '--oro', piel: '--oro0', pelo: 'cola', giro: -4 },
    { x: 372, h: 178, vestido: '--v8', piel: '--oro', pelo: 'rizos', giro: 3 },
    { x: 468, h: 198, vestido: '--c-des-tx', piel: '--oro0', pelo: 'corto', giro: -3 }
  ];
  const medidas = p => {
    const r = p.h * 0.075, cy = BASE - p.h + r, hombro = cy + r + p.h * 0.05;
    return { r, cy, hombro, ancho: p.h * 0.11, cintura: hombro + p.h * 0.2, ruedo: BASE - p.h * 0.2, mano: hombro + p.h * 0.36 };
  };
  // La cabeza gira sobre el cuello: así nunca se separa del cuerpo.
  const giro = (p, m, i) => `class="cab" style="transform-origin:${p.x}px ${m.cy + m.r * 0.9}px;--r:${p.giro}deg;animation-delay:-${i * 0.7}s"`;
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
  function persona(p, i) {
    const m = medidas(p), { x } = p, w = m.ancho, cw = p.h * 0.075, rw = p.h * 0.17, pierna = p.h * 0.05;
    const vestido = `<path d="M${x - w} ${m.hombro + 6}Q${x - w} ${m.hombro} ${x - w + 6} ${m.hombro}H${x + w - 6}Q${x + w} ${m.hombro} ${x + w} ${m.hombro + 6}L${x + cw} ${m.cintura}L${x + rw} ${m.ruedo}Q${x} ${m.ruedo + 8} ${x - rw} ${m.ruedo}L${x - cw} ${m.cintura}Z" ${st(p.vestido)}/>`;
    const piernas = [-1, 1].map(s => `<line x1="${x + s * p.h * 0.05}" y1="${m.ruedo - 4}" x2="${x + s * p.h * 0.05}" y2="${BASE}" style="stroke:var(--t1)" stroke-width="${pierna}" stroke-linecap="round"/>`).join('');
    const cuello = `<rect x="${x - m.r * 0.35}" y="${m.cy + m.r * 0.7}" width="${m.r * 0.7}" height="${m.hombro - m.cy - m.r * 0.5}" ${st(p.piel)}/>`;
    return `<g ${giro(p, m, i)}>${pelo(p, m, true)}</g>` + piernas + cuello + vestido + `<g ${giro(p, m, i)}><circle cx="${x}" cy="${m.cy}" r="${m.r}" ${st(p.piel)}/>${pelo(p, m, false)}</g>`;
  }
  // Sube y baja un punto: la misma animación para los dos brazos y la mano, así siguen unidos.
  const ola = (atr, v, dy, demora, dur) => `<animate attributeName="${atr}" values="${v};${v - dy};${v}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur}s" begin="${demora}s" repeatCount="indefinite"/>`;
  function brazos() {
    let s = '';
    for (let i = 0; i < PERSONAS.length - 1; i++) {
      const a = PERSONAS[i], b = PERSONAS[i + 1], ma = medidas(a), mb = medidas(b);
      const arriba = i === 1 || i === 2, mx = (a.x + b.x) / 2;
      const my = arriba ? Math.min(ma.cy, mb.cy) - 34 : (ma.mano + mb.mano) / 2;
      const dy = arriba ? 12 : 9, demora = i * 0.5;
      [[a, ma, 1], [b, mb, -1]].forEach(([p, m, lado]) => {
        s += `<line x1="${p.x + lado * (m.ancho - 3)}" y1="${m.hombro + 5}" x2="${mx}" y2="${my}" style="stroke:var(${p.vestido})" stroke-width="${p.h * 0.05}" stroke-linecap="round">${ola('y2', my, dy, demora, 4)}</line>`;
      });
      s += `<circle cx="${mx}" cy="${my}" r="${Math.min(a.h, b.h) * 0.035}" ${st(a.piel)}>${ola('cy', my, dy, demora, 4)}</circle>`;
    }
    // Brazos exteriores: saludan, uno después del otro
    [[PERSONAS[0], -1, 0], [PERSONAS[PERSONAS.length - 1], 1, 3]].forEach(([p, lado, demora]) => {
      const m = medidas(p), hx = p.x + lado * (m.ancho + p.h * 0.06), hy = m.mano + p.h * 0.03;
      const sx = p.x + lado * (m.ancho + p.h * 0.16), sy = m.hombro - p.h * 0.12;   // mano en alto
      const anim = (atr, a0, a1) => `<animate attributeName="${atr}" values="${a0};${a1};${a1};${a1};${a0};${a0}" keyTimes="0;.12;.22;.32;.45;1" calcMode="spline" keySplines=".4 0 .6 1;0 0 1 1;0 0 1 1;.4 0 .6 1;0 0 1 1" dur="6s" begin="${demora}s" repeatCount="indefinite"/>`;
      s += `<line x1="${p.x + lado * (m.ancho - 3)}" y1="${m.hombro + 5}" x2="${hx}" y2="${hy}" style="stroke:var(${p.vestido})" stroke-width="${p.h * 0.05}" stroke-linecap="round">${anim('x2', hx, sx)}${anim('y2', hy, sy)}</line>`
        + `<circle cx="${hx}" cy="${hy}" r="${p.h * 0.033}" ${st(p.piel)}>${anim('cx', hx, sx)}${anim('cy', hy, sy)}</circle>`;
    });
    return s;
  }
  // Pétalos que suben desde el suelo: color, posición, tamaño, duración y demora fijos (sin azar, siempre igual).
  const PETALOS = [['--c-des-pt', 70, 5, 9, 0], ['--oro', 150, 4, 11, 2.5], ['--v7', 236, 3.5, 10, 5], ['--c-des-pt', 318, 4.5, 12, 1.2],
    ['--oro', 410, 3.5, 9.5, 3.8], ['--c-des-tx', 498, 4, 11, 6.5], ['--v7', 120, 3, 12.5, 7.4], ['--oro', 352, 3, 10.5, 8.6], ['--c-des-pt', 446, 3.5, 13, 4.4]];
  const petalos = PETALOS.map(([c, x, r, d, t], i) => `<circle class="petalo" cx="${x}" cy="${BASE - 10}" r="${r}" style="fill:var(${c});--dx:${i % 2 ? 18 : -14}px;animation-duration:${d}s;animation-delay:-${t}s"/>`).join('');
  const fondo = `<circle class="halo" cx="280" cy="172" r="140" style="fill:var(--c-des-pt);opacity:.13"/>
    <circle class="flota" cx="470" cy="62" r="30" style="fill:var(--oro);opacity:.45"/><circle class="flota f2" cx="84" cy="70" r="16" style="fill:var(--v7);opacity:.22"/>
    <ellipse cx="280" cy="${BASE + 4}" rx="250" ry="9" style="fill:var(--c-des-tx);opacity:.12"/>`;
  return `<svg class="ilus anima" id="ilus" viewBox="0 0 560 320" aria-hidden="true" focusable="false">${fondo}${petalos}${brazos()}${PERSONAS.map(persona).join('')}</svg>`;
})();
