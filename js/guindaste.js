// =====================================================================
// DL Construtora – Contador de dias com GUINDASTE animado
// Um guindaste de torre pega cada algarismo (como um bloco), leva pelo
// braço e assenta os blocos lado a lado até formar o número de dias.
//
//   import { montarGuindaste } from './guindaste.js';
//   montarGuindaste(elementoContainer, 143);
// =====================================================================

const VERDE = '#32D235';
const GRAFITE = '#161F2A';
const NS = 'http://www.w3.org/2000/svg';

const CSS = `
.guindaste { position: relative; width: 210px; max-width: 100%; flex: 0 0 auto; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
.guindaste svg { display: block; width: 100%; height: auto; overflow: visible; }
.guindaste .gd-dica { position: absolute; right: 2px; top: 0; font-size: 11px; opacity: .55; }
.gd-lacuna { display: inline-block; min-width: .64em; text-align: center; margin: 0 1px; border-bottom: 3px solid ${VERDE};
  color: transparent; line-height: 1.05; font-variant-numeric: tabular-nums; animation: gd-piscar 1s ease-in-out infinite alternate; }
.gd-lacuna.cheia { color: inherit; border-bottom-color: transparent; animation: none; }
.gd-revelar { transition: opacity .5s ease, transform .5s ease; }
.gd-revelar.escondido { opacity: 0; transform: translateY(4px); }
@keyframes gd-piscar { from { border-bottom-color: ${VERDE}; } to { border-bottom-color: rgba(50,210,53,.25); } }
@media (prefers-reduced-motion: reduce) { .guindaste { cursor: default; } .guindaste .gd-dica { display: none; } }
`;

function injetarCss() {
  if (document.getElementById('guindaste-css')) return;
  const style = document.createElement('style');
  style.id = 'guindaste-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Treliça em zigue-zague entre duas linhas
function trelica(x1, y1, x2, y2, alt, passo) {
  const horizontal = y1 === y2;
  let d = '';
  const comp = horizontal ? x2 - x1 : y2 - y1;
  const n = Math.round(comp / passo);
  for (let i = 0; i < n; i++) {
    const a = (comp / n) * i, b = (comp / n) * (i + 1);
    d += horizontal
      ? `M${x1 + a},${y1} L${x1 + (a + b) / 2},${y1 + alt} L${x1 + b},${y1} `
      : `M${x1},${y1 + a} L${x1 + alt},${y1 + (a + b) / 2} L${x1},${y1 + b} `;
  }
  return d;
}

const CHAO = 150;           // linha do chão
const LANCA_Y = 22;         // altura do braço
const PEGA_X = 52;          // onde os blocos são pegos (perto da torre)
const BLOCO_L = 26, BLOCO_A = 30;

const SVG_BASE = `
<svg viewBox="0 0 210 178" aria-hidden="true">
  <ellipse cx="128" cy="${CHAO + 3}" rx="78" ry="3.5" fill="${GRAFITE}" opacity=".12"/>
  <!-- torre -->
  <g stroke="${GRAFITE}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 ${CHAO} L30 ${LANCA_Y + 2} M42 ${CHAO} L42 ${LANCA_Y + 2}"/>
    <path d="${trelica(30, LANCA_Y + 8, 30, CHAO, 12, 13)}" stroke-width="1.6"/>
    <!-- braço (lança) e contralança -->
    <path d="M6 ${LANCA_Y} L204 ${LANCA_Y} M6 ${LANCA_Y + 9} L196 ${LANCA_Y + 9}"/>
    <path d="${trelica(42, LANCA_Y, 196, LANCA_Y, 9, 11)}" stroke-width="1.4"/>
    <!-- topo e tirantes -->
    <path d="M36 ${LANCA_Y} L36 4 M36 4 L196 ${LANCA_Y} M36 4 L8 ${LANCA_Y}" stroke-width="1.6"/>
  </g>
  <rect x="24" y="${CHAO - 3}" width="24" height="6" rx="2" fill="${GRAFITE}"/>
  <!-- contrapeso e cabine -->
  <rect x="6" y="${LANCA_Y + 10}" width="18" height="14" rx="2" fill="${GRAFITE}"/>
  <rect x="44" y="${LANCA_Y + 10}" width="14" height="12" rx="2" fill="${VERDE}" stroke="${GRAFITE}" stroke-width="2"/>
  <rect x="47" y="${LANCA_Y + 13}" width="8" height="5" rx="1" fill="${GRAFITE}" opacity=".7"/>
  <!-- blocos assentados -->
  <g class="gd-assentados"></g>
  <!-- carrinho, cabo, gancho e bloco pendurado -->
  <g class="gd-carrinho">
    <rect x="-7" y="${LANCA_Y + 8}" width="14" height="6" rx="1.5" fill="${VERDE}" stroke="${GRAFITE}" stroke-width="1.6"/>
    <line class="gd-cabo" x1="0" y1="${LANCA_Y + 14}" x2="0" y2="60" stroke="${GRAFITE}" stroke-width="1.4"/>
    <g class="gd-gancho">
      <path d="M0 0 v4 a3 3 0 1 0 3 3" fill="none" stroke="${GRAFITE}" stroke-width="2" stroke-linecap="round"/>
      <path class="gd-correntes" d="M0 6 L-10 14 M0 6 L10 14" stroke="${GRAFITE}" stroke-width="1.2"/>
      <g class="gd-pendurado"></g>
    </g>
  </g>
  <text class="gd-rotulo" x="128" y="${CHAO + 20}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="2" fill="${GRAFITE}" opacity="0">DIAS</text>
</svg>`;

function criarBloco(d) {
  const g = document.createElementNS(NS, 'g');
  g.innerHTML = `
    <rect x="${-BLOCO_L / 2}" y="0" width="${BLOCO_L}" height="${BLOCO_A}" rx="4" fill="${GRAFITE}"/>
    <rect x="${-BLOCO_L / 2 + 2}" y="2" width="${BLOCO_L - 4}" height="3" rx="1.5" fill="#fff" opacity=".12"/>
    <text x="0" y="${BLOCO_A / 2 + 8}" text-anchor="middle" font-size="23" font-weight="800" fill="${VERDE}"
      font-family="Inter, system-ui, sans-serif">${d}</text>`;
  return g;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const semAnimacao = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Animação simples por quadros: chama fn(progresso 0→1 com easing)
function tween(ms, fn, easing = (x) => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)) {
  return new Promise((resolve) => {
    const ini = performance.now();
    function passo(agora) {
      const p = Math.min(1, (agora - ini) / ms);
      fn(easing(p), p);
      if (p < 1) requestAnimationFrame(passo); else resolve();
    }
    requestAnimationFrame(passo);
  });
}

/**
 * Monta o contador com guindaste dentro de `container` e toca a animação.
 * @param {HTMLElement} container
 * @param {number} dias
 */
export function montarGuindaste(container, dias, { aoIniciar, aoAssentar, aoTerminar } = {}) {
  injetarCss();
  const numero = String(Math.max(0, dias));
  const caixa = document.createElement('div');
  caixa.className = 'guindaste';
  caixa.setAttribute('role', 'img');
  caixa.setAttribute('aria-label', `${numero} ${numero === '1' ? 'dia' : 'dias'} para a entrega`);
  caixa.title = 'Toque para ver de novo';
  caixa.innerHTML = SVG_BASE + '<span class="gd-dica">↻</span>';
  container.replaceChildren(caixa);

  const q = (sel) => caixa.querySelector(sel);
  const carrinho = q('.gd-carrinho'), cabo = q('.gd-cabo'), gancho = q('.gd-gancho');
  const pendurado = q('.gd-pendurado'), assentados = q('.gd-assentados'), rotulo = q('.gd-rotulo');
  const correntes = q('.gd-correntes');
  q('.gd-rotulo').textContent = numero === '1' ? 'DIA' : 'DIAS';

  // posição final de cada bloco (centralizados à direita da torre)
  const total = numero.length;
  const espaco = BLOCO_L + 3;
  const centro = 128;
  const destinos = [...numero].map((_, i) => centro + (i - (total - 1) / 2) * espaco);

  function posicionar(x, comprimento, balanco = 0) {
    carrinho.setAttribute('transform', `translate(${x} 0)`);
    const yG = LANCA_Y + 14 + comprimento;
    cabo.setAttribute('y2', yG);
    gancho.setAttribute('transform', `translate(0 ${yG}) rotate(${balanco})`);
  }

  function estadoFinal() {
    assentados.replaceChildren(...[...numero].map((d, i) => {
      const b = criarBloco(d);
      b.setAttribute('transform', `translate(${destinos[i]} ${CHAO - BLOCO_A})`);
      return b;
    }));
    pendurado.replaceChildren();
    correntes.style.opacity = '0';
    rotulo.setAttribute('opacity', '1');
    posicionar(destinos.at(-1) + 30, 20);
    aoTerminar?.();
  }

  let tocando = false;

  async function tocar() {
    if (tocando) return;
    if (semAnimacao() || !caixa.isConnected) { estadoFinal(); return; }
    tocando = true;
    aoIniciar?.();
    assentados.replaceChildren();
    rotulo.getAnimations?.().forEach((a) => a.cancel());
    rotulo.setAttribute('opacity', '0');
    const CURTO = 22;                                   // cabo recolhido
    const LONGO = CHAO - BLOCO_A - (LANCA_Y + 14) - 14; // cabo até o bloco tocar o chão

    let x = PEGA_X;
    posicionar(x, CURTO);
    for (let i = 0; i < total; i++) {
      // pega o bloco perto da torre
      const bloco = criarBloco(numero[i]);
      bloco.setAttribute('transform', 'translate(0 14)');
      pendurado.replaceChildren(bloco);
      correntes.style.opacity = '1';
      const xIni = x;
      // leva pelo braço (com um balanço do gancho)
      await tween(520, (p, linear) => {
        x = xIni + (destinos[i] - xIni) * p;
        posicionar(x, CURTO, Math.sin(linear * Math.PI) * -7);
      });
      // desce o cabo
      await tween(380, (p) => posicionar(x, CURTO + (LONGO - CURTO) * p, 0), (t) => 1 - (1 - t) ** 2);
      // solta o bloco no lugar
      pendurado.replaceChildren();
      correntes.style.opacity = '0';
      bloco.setAttribute('transform', `translate(${destinos[i]} ${CHAO - BLOCO_A})`);
      assentados.appendChild(bloco);
      bloco.animate([{ transform: `translate(${destinos[i]}px, ${CHAO - BLOCO_A - 2}px) scale(1.06, .94)` },
        { transform: `translate(${destinos[i]}px, ${CHAO - BLOCO_A}px) scale(1)` }], { duration: 180 });
      aoAssentar?.(i);
      // sobe o cabo e volta para pegar o próximo
      await tween(300, (p) => posicionar(x, LONGO - (LONGO - CURTO) * p));
      if (i < total - 1) {
        const xVolta = x;
        await tween(420, (p) => { x = xVolta + (PEGA_X - xVolta) * p; posicionar(x, CURTO); });
      }
    }
    // estaciona o carrinho e mostra "DIAS"
    const xFim = x;
    await tween(380, (p) => { x = xFim + (destinos.at(-1) + 30 - xFim) * p; posicionar(x, CURTO); });
    rotulo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
    rotulo.setAttribute('opacity', '1');
    aoTerminar?.();
    await esperar(100);
    tocando = false;
  }

  posicionar(PEGA_X, 22);
  caixa.addEventListener('click', tocar);
  requestAnimationFrame(() => requestAnimationFrame(tocar));
  return { tocar };
}

/**
 * Frase "Faltam _ _ _ dias para a entrega" com lacunas que o guindaste
 * vai preenchendo, bloco a bloco. `revelar`: elementos que só aparecem no fim.
 * Devolve { elemento, ganchos } — passe `ganchos` para montarGuindaste.
 * @param {number} dias
 * @param {HTMLElement[]} revelar
 */
export function fraseComLacunas(dias, revelar = []) {
  injetarCss();
  const numero = String(Math.max(0, dias));
  const um = numero === '1';
  const elemento = document.createElement('span');
  const lacunas = [...numero].map((d) => {
    const l = document.createElement('span');
    l.className = 'gd-lacuna';
    l.dataset.digito = d;
    l.textContent = '0';
    return l;
  });
  elemento.append(um ? 'Falta ' : 'Faltam ', ...lacunas, um ? ' dia para a entrega' : ' dias para a entrega');
  elemento.setAttribute('aria-label', `${um ? 'Falta' : 'Faltam'} ${numero} ${um ? 'dia' : 'dias'} para a entrega`);
  revelar.forEach((r) => r.classList.add('gd-revelar', 'escondido'));

  const esvaziar = (l) => { l.classList.remove('cheia'); l.textContent = '0'; };
  const encher = (l, animar) => {
    if (l.classList.contains('cheia')) return;
    l.textContent = l.dataset.digito;
    l.classList.add('cheia');
    if (animar && l.animate) {
      l.animate([
        { transform: 'translateY(-10px) scale(1.5)', color: VERDE },
        { transform: 'translateY(0) scale(1)', color: GRAFITE },
      ], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }
  };

  return {
    elemento,
    ganchos: {
      aoIniciar: () => { lacunas.forEach(esvaziar); revelar.forEach((r) => r.classList.add('escondido')); },
      aoAssentar: (i) => lacunas[i] && encher(lacunas[i], true),
      aoTerminar: () => { lacunas.forEach((l) => encher(l, false)); revelar.forEach((r) => r.classList.remove('escondido')); },
    },
  };
}
