import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { montarBetoneira } from './betoneira.js?v=1';

// ===========================
// CONFIGURAÇÃO DO SUPABASE
// ===========================
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// ACOMPANHAR OBRA
// ===========================
const formAcompanhar = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

// Busca obra + etapas + mídias de uma vez (função buscar_obra no Supabase)
async function buscarObra(codigo) {
  const { data, error } = await supabase.rpc('buscar_obra', { p_codigo: codigo });
  if (error) throw error;
  return data; // null quando o código não existe
}

function limparResultado() {
  msgErro.textContent = '';
  resultado.style.display = 'none';
}

function mostrarErro(mensagem) {
  msgErro.textContent = mensagem;
  resultado.style.display = 'none';
}

function renderizarObra(obra) {
  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco || '';

  const percentual = Number(obra.percentual) || 0;
  const barra = document.getElementById('progressoPreenchido');
  barra.style.width = '0%';
  setTimeout(() => { barra.style.width = percentual + '%'; }, 100);
  document.getElementById('percentualObra').textContent = percentual + '% concluído';

  renderizarEntrega(obra);
  renderizarEtapas(obra.etapas || []);
  renderizarGaleria(obra.midias || []);

  resultado.style.display = 'block';
}

// ===========================
// PRAZO E ENTREGA
// ===========================
function lerData(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}
const dataBR = (iso) => lerData(iso).toLocaleDateString('pt-BR');
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
function hoje() { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); }

function renderizarEntrega(obra) {
  const banner = document.getElementById('bannerEntrega');
  const caixaPrazo = document.getElementById('prazoObra');
  const prazo = lerData(obra.data_entrega_prevista);
  const entregue = lerData(obra.entregue_em);
  banner.hidden = true;
  caixaPrazo.hidden = true;

  if (entregue) {
    const diasAntes = prazo ? diasEntre(entregue, prazo) : null;
    const antesDoPrazo = diasAntes != null && diasAntes > 0;
    banner.className = 'banner-entrega' + (diasAntes != null && diasAntes < 0 ? ' banner-neutro' : '');
    banner.innerHTML = '';
    const emoji = document.createElement('span');
    emoji.className = 'banner-emoji';
    emoji.textContent = antesDoPrazo || diasAntes === 0 ? '🎉' : '🏡';
    const titulo = document.createElement('strong');
    titulo.textContent = antesDoPrazo ? 'Mais uma obra entregue antes do prazo!' : 'Obra entregue!';
    const texto = document.createElement('span');
    texto.textContent = `Entregue em ${dataBR(obra.entregue_em)}` +
      (antesDoPrazo ? ` — ${diasAntes} ${diasAntes === 1 ? 'dia' : 'dias'} antes do prazo do contrato.` : diasAntes === 0 ? ', exatamente no prazo.' : '.');
    banner.append(emoji, titulo, texto);
    banner.hidden = false;
    return;
  }

  if (!prazo) return;
  const dias = diasEntre(hoje(), prazo);
  caixaPrazo.innerHTML = '';
  const numero = document.createElement('div');
  const info = document.createElement('div');
  const linha1 = document.createElement('strong');
  linha1.textContent = dias > 0 ? (dias === 1 ? 'Falta 1 dia para a entrega' : `Faltam ${dias} dias para a entrega`)
    : dias === 0 ? 'O prazo de entrega é hoje!' : 'Obra na reta final';
  const linha2 = document.createElement('span');
  linha2.textContent = `Prazo do contrato: ${dataBR(obra.data_entrega_prevista)}`;
  info.append(linha1, linha2);
  caixaPrazo.append(numero, info);
  caixaPrazo.hidden = false;
  montarBetoneira(numero, dias);
}

function renderizarEtapas(etapas) {
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';

  etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    const status = ['concluida', 'andamento'].includes(etapa.status) ? etapa.status : 'pendente';
    li.className = 'etapa ' + status;
    lista.appendChild(li);
  });
}

function renderizarGaleria(midias) {
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';

  if (midias.length === 0) {
    galeria.innerHTML = '<p style="color: #888; font-size: 0.9rem;">Nenhuma foto adicionada ainda.</p>';
    return;
  }

  midias.forEach(midia => {
    const figura = document.createElement('figure');
    figura.style.margin = '0 0 16px';

    let el;
    if (midia.tipo === 'video') {
      el = document.createElement('video');
      el.controls = true;
      el.preload = 'metadata';
      el.playsInline = true;
    } else {
      el = document.createElement('img');
      el.alt = midia.legenda || 'Foto da obra';
      el.loading = 'lazy';
    }
    el.src = midia.url;
    el.style.width = '100%';
    el.style.borderRadius = '8px';
    el.style.display = 'block';
    figura.appendChild(el);

    if (midia.legenda) {
      const legenda = document.createElement('figcaption');
      legenda.textContent = midia.legenda;
      legenda.style.cssText = 'font-size: 0.9rem; color: #666; margin-top: 6px;';
      figura.appendChild(legenda);
    }

    galeria.appendChild(figura);
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  limparResultado();

  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();
  if (!codigo) {
    mostrarErro('Digite um código de obra.');
    return;
  }

  const botao = formAcompanhar.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Buscando...';

  try {
    const obra = await buscarObra(codigo);
    if (!obra) {
      mostrarErro('Código não encontrado. Verifique com a construtora.');
      return;
    }
    renderizarObra(obra);
  } catch (erro) {
    console.error('Erro ao buscar obra no Supabase:', erro);
    mostrarErro('Erro ao carregar os dados. Tente novamente.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar obra';
  }
}

if (formAcompanhar) {
  formAcompanhar.addEventListener('submit', handleSubmit);

  // Permite abrir direto: acompanhar.html?codigo=CDO-2026-001
  const codigoUrl = new URLSearchParams(location.search).get('codigo');
  if (codigoUrl) {
    document.getElementById('codigoObra').value = codigoUrl;
    formAcompanhar.requestSubmit();
  }
}
