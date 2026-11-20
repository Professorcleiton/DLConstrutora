// =====================================================================
// DL Construtora – Contador de dias com betoneira animada
// Os algarismos caem dentro da betoneira, ela gira e eles saem de novo
// até o placar de dias. Usado no App da Obra e no Acompanhar Obra.
//
//   import { montarBetoneira } from './betoneira.js';
//   montarBetoneira(elementoContainer, 143);
// =====================================================================

const VERDE = '#32D235';
const GRAFITE = '#161F2A';

const CSS = `
.betoneira { position: relative; width: 128px; flex: 0 0 128px; padding-top: 22px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
.betoneira svg { display: block; width: 128px; height: 104px; overflow: visible; }
.betoneira .bt-placar { background: ${GRAFITE}; color: ${VERDE}; border-radius: 12px; text-align: center; padding: 6px 6px 7px; margin-top: 4px; line-height: 1; }
.betoneira .bt-numero { display: block; font-size: 30px; font-weight: 800; letter-spacing: 1px; min-height: 30px; font-variant-numeric: tabular-nums; }
.betoneira .bt-numero span { display: inline-block; }
.betoneira .bt-rotulo { display: block; font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 3px; }
.betoneira .bt-voando { position: absolute; left: 0; top: 0; font-size: 30px; font-weight: 800; color: ${VERDE}; -webkit-text-stroke: 1.5px ${GRAFITE}; paint-order: stroke fill; line-height: 1; pointer-events: none; will-change: transform, opacity; }
.betoneira .bt-corpo { transform-box: fill-box; transform-origin: 50% 90%; }
.betoneira .bt-dica { position: absolute; right: 2px; top: 0; font-size: 11px; opacity: .55; }
@media (prefers-reduced-motion: reduce) { .betoneira { cursor: default; } .betoneira .bt-dica { display: none; } }
`;

function injetarCss() {
  if (document.getElementById('betoneira-css')) return;
  const style = document.createElement('style');
  style.id = 'betoneira-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Desenho original da betoneira: tambor verde afunilado com aletas grafite.
// O tambor é desenhado deitado (eixo em x) e depois inclinado 30°.
const LISTRAS = Array.from({ length: 14 }, (_, i) => -42 + i * 14)
  .map((x) => `<line x1="${x}" y1="-32" x2="${x + 16}" y2="32"/>`).join('');
const TAMBOR = 'M8,-22 C-3,-14 -3,14 8,22 L44,27 C48,27 51,25 53,23 L74,12 L74,-12 L53,-23 C51,-25 48,-27 44,-27 Z';

const SVG = `
<svg viewBox="0 0 130 106" aria-hidden="true">
  <defs><clipPath id="bt-clip"><path d="${TAMBOR}"/></clipPath></defs>
  <ellipse cx="66" cy="102" rx="54" ry="4" fill="${GRAFITE}" opacity=".12"/>
  <g class="bt-corpo">
    <!-- motor -->
    <rect x="6" y="70" width="24" height="17" rx="3" fill="${GRAFITE}"/>
    <rect x="10" y="74" width="16" height="3" rx="1.5" fill="${VERDE}"/>
    <!-- cavalete -->
    <path d="M46 76 L34 100 M80 72 L96 100 M28 84 L84 74" stroke="${GRAFITE}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="96" cy="97" r="7" fill="${GRAFITE}"/><circle cx="96" cy="97" r="2.5" fill="${VERDE}"/>
    <!-- tambor inclinado -->
    <g transform="translate(34 64) rotate(-30)">
      <path d="${TAMBOR}" fill="${VERDE}"/>
      <g clip-path="url(#bt-clip)">
        <g class="bt-listras" stroke="${GRAFITE}" stroke-width="6" stroke-linecap="round" opacity=".85">${LISTRAS}</g>
        <path d="M2,-12 C20,-20 50,-22 70,-9" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>
      </g>
      <path d="${TAMBOR}" fill="none" stroke="${GRAFITE}" stroke-width="4" stroke-linejoin="round"/>
      <!-- boca -->
      <ellipse class="bt-boca" cx="74" cy="0" rx="5" ry="12.5" fill="${GRAFITE}"/>
      <ellipse cx="74.5" cy="0" rx="2.6" ry="8.5" fill="#05080C"/>
    </g>
  </g>
</svg>`;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const semAnimacao = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate;

/**
 * Monta o contador com betoneira dentro de `container` e toca a animação.
 * @param {HTMLElement} container
 * @param {number} dias
 */
export function montarBetoneira(container, dias) {
  injetarCss();
  const numero = String(Math.max(0, dias));
  const caixa = document.createElement('div');
  caixa.className = 'betoneira';
  caixa.setAttribute('role', 'img');
  caixa.setAttribute('aria-label', `${numero} ${numero === '1' ? 'dia' : 'dias'} para a entrega`);
  caixa.title = 'Toque para ver de novo';
  caixa.innerHTML = SVG +
    `<div class="bt-placar"><span class="bt-numero"></span><span class="bt-rotulo">${numero === '1' ? 'dia' : 'dias'}</span></div>` +
    '<span class="bt-dica">↻</span>';
  container.replaceChildren(caixa);

  const alvo = caixa.querySelector('.bt-numero');
  const finais = [...numero].map((d) => {
    const s = document.createElement('span');
    s.textContent = d;
    alvo.appendChild(s);
    return s;
  });

  let tocando = false;

  async function tocar() {
    if (tocando) return;
    if (semAnimacao() || !caixa.isConnected || caixa.offsetParent === null) {
      finais.forEach((f) => (f.style.visibility = 'visible'));
      return;
    }
    tocando = true;
    finais.forEach((f) => (f.style.visibility = 'hidden'));

    const base = caixa.getBoundingClientRect();
    const boca = caixa.querySelector('.bt-boca').getBoundingClientRect();
    const bx = boca.left - base.left + boca.width / 2;
    const by = boca.top - base.top + boca.height / 2;
    const corpo = caixa.querySelector('.bt-corpo');
    const listras = caixa.querySelector('.bt-listras');

    const voadores = finais.map((f) => {
      const v = document.createElement('span');
      v.className = 'bt-voando';
      v.textContent = f.textContent;
      v.style.opacity = '0';
      caixa.appendChild(v);
      return v;
    });
    const meio = (v) => [v.offsetWidth / 2, v.offsetHeight / 2];

    // 1) Os números caem dentro da boca, um de cada vez
    await Promise.all(voadores.map((v, i) => {
      const [mx, my] = meio(v);
      const xIni = bx - mx - 6 + (i - (voadores.length - 1) / 2) * 18;
      return v.animate([
        { transform: `translate(${xIni}px, ${by - my - 52}px) scale(1) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${xIni}px, ${by - my - 40}px) scale(1) rotate(-8deg)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${bx - mx}px, ${by - my}px) scale(.35) rotate(25deg)`, opacity: 0 },
      ], { duration: 650, delay: i * 180, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished;
    }));

    // 2) A betoneira gira e treme
    const giro = listras.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-84px)' }],
      { duration: 1400, easing: 'cubic-bezier(.45,0,.55,1)' });
    corpo.animate([
      { transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(-1.5px,1px) rotate(-1.2deg)' },
      { transform: 'translate(1.5px,-1px) rotate(1.2deg)' }, { transform: 'translate(-1px,0) rotate(-.8deg)' },
      { transform: 'translate(0,0) rotate(0deg)' },
    ], { duration: 260, iterations: 5 });
    await giro.finished;
    await esperar(80);

    // 3) Os números saem da boca e pousam no placar
    await Promise.all(voadores.map(async (v, i) => {
      const [mx, my] = meio(v);
      const f = finais[i].getBoundingClientRect();
      const fx = f.left - base.left;
      const fy = f.top - base.top + (f.height - v.offsetHeight) / 2;
      const altoX = (bx + fx) / 2 + 18;
      await v.animate([
        { transform: `translate(${bx - mx}px, ${by - my}px) scale(.35) rotate(-30deg)`, opacity: 0 },
        { transform: `translate(${altoX}px, ${by - my - 34}px) scale(1.15) rotate(12deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${fx}px, ${fy}px) scale(1) rotate(0deg)`, opacity: 1 },
      ], { duration: 750, delay: i * 140, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).finished;
      finais[i].style.visibility = 'visible';
      finais[i].animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
      v.remove();
    }));

    tocando = false;
  }

  caixa.addEventListener('click', tocar);
  // espera o navegador desenhar antes de medir as posições
  requestAnimationFrame(() => requestAnimationFrame(tocar));
  return { tocar };
}
