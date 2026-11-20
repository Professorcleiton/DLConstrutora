import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ===========================
// CONFIGURAÇÃO DO SUPABASE
// ===========================
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PASTA_STORAGE = '/storage/v1/object/public/midias/';
const ETAPAS_PADRAO = ['Documentação Inicial', 'Fundação', 'Estrutura', 'Alvenaria', 'Cobertura', 'Acabamento', 'Entrega'];
const NOVA_OBRA = '__nova__';
const TELAS = ['tela-carregando', 'tela-login', 'tela-esqueci', 'tela-nova-senha', 'tela-sem-acesso', 'tela-app'];
const CATEGORIAS_DOC = {
  contrato: ['📄', 'Contratos'],
  comprovante: ['🧾', 'Comprovantes'],
  projeto: ['📐', 'Projetos e plantas'],
  nota_fiscal: ['🧾', 'Notas fiscais'],
  outros: ['📁', 'Outros'],
};

const $ = (id) => document.getElementById(id);
const estado = { usuario: null, papel: null, obraCliente: null, obras: [], abaAtual: 'aba-resumo' };
const ehEquipe = () => estado.papel === 'equipe';
const obraAtual = () => (ehEquipe() ? $('obraAtual').value : estado.obraCliente);

// ===========================
// UTILITÁRIOS
// ===========================
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = (v) => moeda.format(Number(v) || 0);

// "2.500,00" | "2500.5" | "2500" → 2500.5
function lerValor(texto) {
  let t = String(texto || '').trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const valorParaCampo = (v) => (v == null ? '' : Number(v).toFixed(2).replace('.', ','));

// Datas sem fuso: 'AAAA-MM-DD' → Date local à meia-noite
function lerData(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}
function hoje() { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); }
function isoData(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
const dataBR = (iso) => (iso ? lerData(iso).toLocaleDateString('pt-BR') : '');
function somarMeses(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), ultimo));
  return r;
}
function tamanhoArquivo(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}
function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
}
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e[k] = v;
  });
  filhos.flat().forEach((f) => f != null && e.append(f));
  return e;
}

function mostrarTela(id) {
  TELAS.forEach((t) => $(t).classList.toggle('hidden', t !== id));
  window.scrollTo(0, 0);
}
function mostrarStatus(e, texto, tipo = 'info') {
  e.textContent = texto;
  e.className = 'status ' + tipo;
}
function traduzirErro(erro) {
  const msg = erro?.message || String(erro);
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Peça para a equipe confirmar o seu cadastro.';
  if (msg.includes('rate limit') || msg.includes('only request this after')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (msg.includes('row-level security') || msg.includes('permission denied')) return 'Você não tem permissão para isso.';
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (msg.includes('Failed to fetch')) return 'Sem conexão com a internet.';
  return msg;
}
function botaoCarregando(btn, carregando, textoCarregando = 'Aguarde...') {
  if (carregando) {
    btn.dataset.texto = btn.textContent;
    btn.textContent = textoCarregando;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.texto || btn.textContent;
    btn.disabled = false;
  }
}

// Mostrar / esconder senha
document.querySelectorAll('.ver-senha').forEach((btn) => {
  btn.addEventListener('click', () => {
    const campo = $(btn.dataset.alvo);
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    btn.textContent = mostrar ? '🙈' : '👁️';
    btn.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
  });
});
document.querySelectorAll('[data-ir]').forEach((btn) => btn.addEventListener('click', () => mostrarTela(btn.dataset.ir)));

// ===========================
// INÍCIO / SESSÃO
// ===========================
const vindoDoLinkDeSenha = location.hash.includes('type=recovery');

supabase.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') mostrarTela('tela-nova-senha');
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (vindoDoLinkDeSenha) return mostrarTela('tela-nova-senha');
  if (session) entrarNoApp(session.user);
  else mostrarTela('tela-login');
});

// ===========================
// LOGIN / SENHA
// ===========================
$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const status = $('statusLogin');
  status.textContent = '';
  botaoCarregando(btn, true, 'Entrando...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('senha').value,
  });
  botaoCarregando(btn, false);
  if (error) return mostrarStatus(status, traduzirErro(error), 'erro');
  $('senha').value = '';
  entrarNoApp(data.user);
});

$('btnEsqueci').addEventListener('click', () => {
  $('emailEsqueci').value = $('email').value.trim();
  $('statusEsqueci').textContent = '';
  mostrarTela('tela-esqueci');
});

$('formEsqueci').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  botaoCarregando(btn, true, 'Enviando...');
  const { error } = await supabase.auth.resetPasswordForEmail($('emailEsqueci').value.trim(), {
    redirectTo: location.origin + location.pathname,
  });
  botaoCarregando(btn, false);
  if (error) return mostrarStatus($('statusEsqueci'), traduzirErro(error), 'erro');
  mostrarStatus($('statusEsqueci'), '✅ Se esse e-mail estiver cadastrado, você vai receber um link em instantes. Confira também o spam.', 'ok');
});

$('formNovaSenha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('statusNovaSenha');
  if ($('novaSenha').value !== $('novaSenha2').value) return mostrarStatus(status, 'As senhas não são iguais.', 'erro');
  const btn = e.target.querySelector('button[type=submit]');
  botaoCarregando(btn, true, 'Salvando...');
  const { data, error } = await supabase.auth.updateUser({ password: $('novaSenha').value });
  botaoCarregando(btn, false);
  if (error) return mostrarStatus(status, traduzirErro(error), 'erro');
  history.replaceState(null, '', location.pathname);
  entrarNoApp(data.user);
});

document.querySelectorAll('.btn-sair-geral').forEach((btn) => btn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.replace(location.pathname);
}));

async function entrarNoApp(usuario) {
  mostrarTela('tela-carregando');
  estado.usuario = usuario;

  const { data: perfil, error } = await supabase.rpc('meu_perfil');
  if (error) {
    mostrarTela('tela-login');
    return mostrarStatus($('statusLogin'), 'Erro ao carregar seu perfil: ' + traduzirErro(error), 'erro');
  }
  if (!perfil) return mostrarTela('tela-sem-acesso');

  estado.papel = perfil.papel;
  estado.obraCliente = perfil.obra_codigo;

  $('usuarioLogado').textContent = usuario.email;
  $('seloPapel').textContent = ehEquipe() ? 'Equipe' : 'Cliente';
  document.querySelectorAll('.so-equipe').forEach((x) => x.classList.toggle('hidden', !ehEquipe()));
  document.querySelectorAll('.so-cliente').forEach((x) => x.classList.toggle('hidden', ehEquipe()));

  mostrarTela('tela-app');
  await carregarObras();
  abrirAba(abaSalva());
}

// ===========================
// ABAS
// ===========================
const ABAS_COM_OBRA = ['aba-resumo', 'aba-envio', 'aba-midias', 'aba-financeiro', 'aba-documentos'];

function abaSalva() {
  try {
    const aba = localStorage.getItem('dl-aba');
    const btn = aba && document.querySelector(`.abas button[data-aba="${aba}"]`);
    return btn && !btn.classList.contains('hidden') ? aba : 'aba-resumo';
  } catch { return 'aba-resumo'; }
}

function abrirAba(id) {
  estado.abaAtual = id;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === id));
  document.querySelectorAll('.aba').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  $('barraObra').classList.toggle('hidden', !ehEquipe() || !ABAS_COM_OBRA.includes(id));
  try { localStorage.setItem('dl-aba', id); } catch { /* sem armazenamento */ }
  recarregarAba();
}

function recarregarAba() {
  const id = estado.abaAtual;
  if (id === 'aba-resumo') carregarResumo();
  if (id === 'aba-midias') carregarMidias();
  if (id === 'aba-financeiro') carregarFinanceiro();
  if (id === 'aba-documentos') carregarDocumentos();
  if (id === 'aba-acessos') carregarAcessos();
}

document.querySelectorAll('.abas button').forEach((btn) => btn.addEventListener('click', () => abrirAba(btn.dataset.aba)));
$('obraAtual').addEventListener('change', () => {
  try { localStorage.setItem('dl-obra', $('obraAtual').value); } catch { /* ok */ }
  recarregarAba();
});

// ===========================
// LISTA DE OBRAS
// ===========================
async function carregarObras(selecionarEditar) {
  const { data, error } = await supabase.from('obras').select('codigo, nome').order('codigo');
  if (error) return mostrarStatus($('statusResumo'), '❌ Erro ao carregar obras: ' + traduzirErro(error), 'erro');
  estado.obras = data;

  const nomeObra = (o) => `${o.codigo} – ${o.nome}`;
  const opcoes = () => data.map((o) => new Option(nomeObra(o), o.codigo));

  document.querySelectorAll('select.seletor-obra').forEach((sel) => {
    const anterior = sel.value;
    sel.replaceChildren(...opcoes());
    if (!data.length) sel.replaceChildren(new Option('Nenhuma obra cadastrada', ''));
    if (data.some((o) => o.codigo === anterior)) sel.value = anterior;
  });

  if (!ehEquipe()) return;

  try {
    const salva = localStorage.getItem('dl-obra');
    if (!selecionarEditar && salva && data.some((o) => o.codigo === salva)) $('obraAtual').value = salva;
  } catch { /* ok */ }

  const editar = $('obraEditar');
  editar.replaceChildren(...opcoes(), new Option('+ Cadastrar nova obra', NOVA_OBRA));
  editar.value = selecionarEditar || (data[0]?.codigo ?? NOVA_OBRA);
  await abrirObra(editar.value);
}

// ===========================
// RESUMO (prazo, banner, etapas, fotos)
// ===========================
function infoPrazo(obra) {
  const prazo = lerData(obra.data_entrega_prevista);
  const entregue = lerData(obra.entregue_em);
  if (entregue) {
    const antes = prazo ? diasEntre(entregue, prazo) : null;
    return { entregue: true, noPrazo: antes == null || antes >= 0, diasAntes: antes, entregue_em: obra.entregue_em };
  }
  if (!prazo) return null;
  return { entregue: false, dias: diasEntre(hoje(), prazo), prazo: obra.data_entrega_prevista };
}

function montarBanner(obra) {
  const banner = $('bannerEntrega');
  const p = infoPrazo(obra);
  if (!p?.entregue) { banner.classList.add('hidden'); return; }
  banner.className = 'banner-entrega' + (p.noPrazo ? '' : ' atrasada');
  const detalhe = p.diasAntes > 0
    ? `Entregue em ${dataBR(p.entregue_em)} — ${p.diasAntes} ${p.diasAntes === 1 ? 'dia' : 'dias'} antes do prazo do contrato.`
    : p.diasAntes === 0 ? `Entregue em ${dataBR(p.entregue_em)}, exatamente no prazo.`
      : `Entregue em ${dataBR(p.entregue_em)}.`;
  banner.replaceChildren(
    el('span', { class: 'emoji', textContent: p.noPrazo ? '🎉' : '🏡' }),
    el('h2', { textContent: p.noPrazo && p.diasAntes > 0 ? 'Mais uma obra entregue antes do prazo!' : 'Obra entregue!' }),
    el('p', { textContent: detalhe }),
  );
}

function montarPrazo(obra) {
  const card = $('cardPrazo');
  const p = infoPrazo(obra);
  if (!p || p.entregue) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const numero = Math.max(0, p.dias);
  const texto = [];
  if (p.dias > 0) {
    const meses = Math.floor(p.dias / 30.44);
    texto.push(el('p', { class: 'grande', textContent: `${p.dias === 1 ? 'Falta 1 dia' : `Faltam ${p.dias} dias`} para a entrega` }));
    if (meses >= 1) texto.push(el('p', { class: 'dica', textContent: `Cerca de ${meses} ${meses === 1 ? 'mês' : 'meses'}` }));
  } else if (p.dias === 0) {
    texto.push(el('p', { class: 'grande', textContent: 'O prazo de entrega é hoje!' }));
  } else {
    texto.push(el('p', { class: 'grande', textContent: 'Obra na reta final' }));
    if (ehEquipe()) texto.push(el('p', { class: 'alerta', textContent: `⚠️ ${-p.dias} ${p.dias === -1 ? 'dia' : 'dias'} após o prazo do contrato` }));
  }
  texto.push(el('p', { class: 'dica', textContent: `Prazo do contrato: ${dataBR(p.prazo)}` }));
  card.replaceChildren(
    el('div', { class: 'prazo-numero' }, el('strong', { textContent: String(numero) }), el('span', { textContent: numero === 1 ? 'dia' : 'dias' })),
    el('div', { class: 'prazo-texto' }, texto),
  );
}

async function carregarResumo() {
  const codigo = obraAtual();
  const status = $('statusResumo');
  status.textContent = '';
  if (!codigo) return;

  const [{ data: obra, error }, { data: parcelas }] = await Promise.all([
    supabase.rpc('buscar_obra', { p_codigo: codigo }),
    supabase.from('parcelas').select('vencimento, valor, pago_em').eq('obra_codigo', codigo).order('vencimento'),
  ]);
  if (error || !obra) return mostrarStatus(status, '❌ ' + (error ? traduzirErro(error) : 'Obra não encontrada.'), 'erro');
  if (codigo !== obraAtual()) return; // trocou de obra no meio do carregamento

  $('resumoNome').textContent = obra.nome;
  $('resumoEndereco').textContent = obra.endereco || '';
  const pct = Number(obra.percentual) || 0;
  $('resumoBarra').style.width = '0%';
  requestAnimationFrame(() => setTimeout(() => ($('resumoBarra').style.width = pct + '%'), 50));
  $('resumoPercentual').textContent = pct + '% concluído';

  montarBanner(obra);
  montarPrazo(obra);

  // Mini resumo financeiro
  const cardFin = $('cardResumoFinanceiro');
  if (parcelas?.length) {
    const total = parcelas.reduce((s, p) => s + Number(p.valor), 0);
    const pago = parcelas.filter((p) => p.pago_em).reduce((s, p) => s + Number(p.valor), 0);
    const proxima = parcelas.find((p) => !p.pago_em);
    cardFin.classList.remove('hidden');
    cardFin.replaceChildren(
      el('div', { class: 'titulo-linha' }, el('h3', { textContent: '💰 Entrada' }),
        el('button', { class: 'btn-mini', textContent: 'Ver financeiro →', onclick: () => abrirAba('aba-financeiro') })),
      el('div', { class: 'barra' }, el('div', { class: 'barra-cheia', style: `width:${total ? Math.round(pago / total * 100) : 0}%` })),
      el('p', { class: 'dica', textContent: `${dinheiro(pago)} pagos de ${dinheiro(total)}` +
        (proxima ? ` · próxima parcela: ${dinheiro(proxima.valor)} em ${dataBR(proxima.vencimento)}` : ' · entrada quitada ✅') }),
    );
  } else {
    cardFin.classList.add('hidden');
  }

  const lista = $('resumoEtapas');
  lista.replaceChildren(...(obra.etapas || []).map((e) =>
    el('li', { class: ['concluida', 'andamento'].includes(e.status) ? e.status : 'pendente', textContent: e.nome })));
  if (!obra.etapas?.length) lista.replaceChildren(el('li', { textContent: 'Etapas ainda não cadastradas.' }));

  const fotos = $('resumoFotos');
  const midias = obra.midias || [];
  fotos.replaceChildren(...midias.map((m) => {
    const url = urlAbsoluta(m.url);
    if (m.tipo === 'video') return el('video', { src: url, controls: true, preload: 'metadata', playsInline: true });
    return el('a', { href: url, target: '_blank', rel: 'noopener' }, el('img', { src: url, alt: m.legenda || 'Foto da obra', loading: 'lazy' }));
  }));
  if (!midias.length) fotos.replaceChildren(el('p', { class: 'vazio', textContent: 'Nenhuma foto publicada ainda.' }));
}

// ===========================
// ENVIAR MÍDIA (equipe)
// ===========================
$('arquivo').addEventListener('change', () => {
  const arquivo = $('arquivo').files[0];
  const preview = $('preview');
  preview.innerHTML = '';
  if (!arquivo) return;
  const v = el(arquivo.type.startsWith('video') ? 'video' : 'img', { src: URL.createObjectURL(arquivo) });
  if (v.tagName === 'VIDEO') v.controls = true;
  preview.appendChild(v);
});

document.querySelectorAll('.destino-botoes button').forEach((btn) => {
  btn.addEventListener('click', () => enviarMidia(btn.dataset.destino));
});

async function enviarMidia(destino) {
  const status = $('statusEnvio');
  const botoes = document.querySelectorAll('.destino-botoes button');
  const codigo = obraAtual();
  const arquivo = $('arquivo').files[0];
  if (!codigo || !arquivo) return mostrarStatus(status, 'Escolha a obra e selecione um arquivo.', 'erro');

  mostrarStatus(status, 'Enviando... aguarde.');
  botoes.forEach((b) => (b.disabled = true));
  try {
    const caminho = `${Date.now()}-${nomeSeguro(arquivo.name)}`;
    const { error: erroUpload } = await supabase.storage
      .from('midias').upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: '31536000' });
    if (erroUpload) throw new Error('Erro no upload: ' + traduzirErro(erroUpload));
    const { data: urlData } = supabase.storage.from('midias').getPublicUrl(caminho);
    const { error: erroInsert } = await supabase.from('midias').insert({
      obra_codigo: codigo,
      url: urlData.publicUrl,
      tipo: arquivo.type.startsWith('video') ? 'video' : 'foto',
      legenda: $('legenda').value.trim() || null,
      categoria: $('categoria').value || null,
      destino,
    });
    if (erroInsert) {
      await supabase.storage.from('midias').remove([caminho]);
      throw new Error('Erro ao salvar: ' + traduzirErro(erroInsert));
    }
    mostrarStatus(status, destino === 'obra' ? `✅ Publicado em Acompanhar Obra (${codigo})!` : '✅ Enviado para Redes Sociais!', 'ok');
    $('arquivo').value = '';
    $('legenda').value = '';
    $('categoria').value = '';
    $('preview').innerHTML = '';
  } catch (erro) {
    mostrarStatus(status, '❌ ' + erro.message, 'erro');
  } finally {
    botoes.forEach((b) => (b.disabled = false));
  }
}

// ===========================
// MÍDIAS (equipe: ver, baixar, mover, apagar)
// ===========================
$('filtroDestino').addEventListener('change', () => carregarMidias());

function urlAbsoluta(url) {
  return /^https?:/.test(url) ? url : new URL('../' + url, location.href).href;
}
function caminhoNoStorage(url) {
  const i = url.indexOf(PASTA_STORAGE);
  return i === -1 ? null : decodeURIComponent(url.slice(i + PASTA_STORAGE.length).split('?')[0]);
}

async function carregarMidias(manterStatus = false) {
  const grade = $('gradeMidias');
  const status = $('statusMidias');
  const codigo = obraAtual();
  if (!manterStatus) status.textContent = '';
  if (!codigo) { grade.innerHTML = ''; return; }

  grade.innerHTML = '<p class="vazio">Carregando…</p>';
  let consulta = supabase.from('midias')
    .select('id, url, tipo, legenda, categoria, destino, enviado_por, data_envio')
    .eq('obra_codigo', codigo)
    .order('data_envio', { ascending: false, nullsFirst: false });
  if ($('filtroDestino').value) consulta = consulta.eq('destino', $('filtroDestino').value);

  const { data, error } = await consulta;
  if (error) { grade.innerHTML = ''; return mostrarStatus(status, '❌ ' + traduzirErro(error), 'erro'); }
  if (!data.length) { grade.innerHTML = '<p class="vazio">Nenhuma mídia por aqui ainda.</p>'; return; }
  grade.replaceChildren(...data.map(cartaoMidia));
}

function cartaoMidia(m) {
  const url = urlAbsoluta(m.url);
  const visual = m.tipo === 'video'
    ? el('video', { src: url, controls: true, preload: 'metadata', playsInline: true })
    : el('img', { src: url, loading: 'lazy', alt: m.legenda || 'Foto da obra' });

  const info = el('div', { class: 'midia-info' },
    m.legenda ? el('p', { textContent: m.legenda }) : null,
    el('span', { class: 'tag ' + (m.destino === 'redes' ? 'tag-redes' : 'tag-obra'), textContent: m.destino === 'redes' ? '📱 Redes' : '🏗️ Obra' }),
    ' ', m.data_envio ? new Date(m.data_envio).toLocaleDateString('pt-BR') : '');

  const novoDestino = m.destino === 'redes' ? 'obra' : 'redes';
  const acoes = el('div', { class: 'midia-acoes' },
    el('a', { textContent: 'Baixar', href: caminhoNoStorage(m.url) ? url + '?download=' : url, download: '', target: '_blank', rel: 'noopener' }),
    el('button', { class: 'apagar', textContent: 'Apagar', onclick: (e) => apagarMidia(m, e.currentTarget) }),
    el('button', { class: 'mover', textContent: novoDestino === 'obra' ? '🏗️ Mover para Obra' : '📱 Mover para Redes', onclick: (e) => moverMidia(m, novoDestino, e.currentTarget) }),
  );
  return el('article', { class: 'midia' }, visual, info, acoes);
}

async function moverMidia(m, destino, btn) {
  btn.disabled = true;
  const { error } = await supabase.from('midias').update({ destino }).eq('id', m.id);
  if (error) { btn.disabled = false; return mostrarStatus($('statusMidias'), '❌ ' + traduzirErro(error), 'erro'); }
  mostrarStatus($('statusMidias'), destino === 'obra' ? '✅ Agora aparece no Acompanhar Obra.' : '✅ Movida para Redes Sociais (saiu do site).', 'ok');
  carregarMidias(true);
}

async function apagarMidia(m, btn) {
  if (!confirm('Apagar esta mídia? Ela some do site e não dá para desfazer.')) return;
  btn.disabled = true;
  const status = $('statusMidias');
  const { data, error } = await supabase.from('midias').delete().eq('id', m.id).select('id');
  if (error || !data?.length) {
    btn.disabled = false;
    return mostrarStatus(status, '❌ ' + (error ? traduzirErro(error) : 'Você não tem permissão para apagar esta mídia.'), 'erro');
  }
  const caminho = caminhoNoStorage(m.url);
  if (caminho) {
    const { error: e2 } = await supabase.storage.from('midias').remove([caminho]);
    if (e2) console.warn('Registro apagado, mas o arquivo ficou no Storage:', e2);
  }
  mostrarStatus(status, '✅ Mídia apagada.', 'ok');
  carregarMidias(true);
}

// ===========================
// FINANCEIRO
// ===========================
const fin = { obra: null, parcelas: [], repasses: [], comprovantes: {} };

async function carregarFinanceiro() {
  const codigo = obraAtual();
  if (!codigo) return;
  const [o, p, r, d] = await Promise.all([
    supabase.from('obras').select('codigo, data_entrega_prevista, valor_contrato, valor_entrada, valor_financiamento').eq('codigo', codigo).single(),
    supabase.from('parcelas').select('*').eq('obra_codigo', codigo).order('vencimento').order('numero'),
    supabase.from('repasses').select('*').eq('obra_codigo', codigo).order('data_prevista', { nullsFirst: false }).order('id'),
    supabase.from('documentos').select('id, nome, caminho, parcela_id, enviado_por, criado_em').eq('obra_codigo', codigo).eq('categoria', 'comprovante').not('parcela_id', 'is', null),
  ]);
  const erro = o.error || p.error || r.error || d.error;
  if (erro) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(erro), 'erro');
  if (codigo !== obraAtual()) return;

  fin.obra = o.data;
  fin.parcelas = p.data;
  fin.repasses = r.data;
  fin.comprovantes = {};
  d.data.forEach((doc) => (fin.comprovantes[doc.parcela_id] ||= []).push(doc));

  desenharValores();
  desenharParcelas();
  desenharRepasses();
  sugerirGeracao();
}

function desenharValores() {
  const o = fin.obra;
  const bloco = (titulo, v) => el('div', { class: 'bloco' }, el('small', { textContent: titulo }), el('strong', { textContent: v == null ? '—' : dinheiro(v) }));
  $('valoresContrato').replaceChildren(
    bloco('Valor total', o.valor_contrato),
    bloco('Entrada', o.valor_entrada),
    bloco('Financiamento Caixa', o.valor_financiamento),
  );
  $('valContrato').value = valorParaCampo(o.valor_contrato);
  $('valEntrada').value = valorParaCampo(o.valor_entrada);
  $('valFinanciamento').value = valorParaCampo(o.valor_financiamento);
}

$('btnEditarValores').addEventListener('click', () => $('formValores').classList.toggle('hidden'));
$('formValores').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  botaoCarregando(btn, true, 'Salvando...');
  const { error } = await supabase.from('obras').update({
    valor_contrato: lerValor($('valContrato').value),
    valor_entrada: lerValor($('valEntrada').value),
    valor_financiamento: lerValor($('valFinanciamento').value),
  }).eq('codigo', obraAtual());
  botaoCarregando(btn, false);
  if (error) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(error), 'erro');
  $('formValores').classList.add('hidden');
  carregarFinanceiro();
});

function situacaoParcela(p) {
  if (p.pago_em) return ['chip-ok', `✅ Paga em ${dataBR(p.pago_em)}`];
  if (fin.comprovantes[p.id]?.length) return ['chip-analise', '🔎 Comprovante em análise'];
  const dias = diasEntre(hoje(), lerData(p.vencimento));
  if (dias < 0) return ['chip-atraso', `Atrasada ${-dias} ${dias === -1 ? 'dia' : 'dias'}`];
  if (dias === 0) return ['chip-breve', 'Vence hoje'];
  if (dias <= 7) return ['chip-breve', `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`];
  return ['chip-futuro', 'A vencer'];
}

function resumoLinhas(linhas) {
  return el('div', { class: 'resumo-fin' }, linhas.map(([a, b]) => el('div', { class: 'linha' }, el('span', { textContent: a }), el('strong', { textContent: b }))));
}

function desenharParcelas() {
  const lista = $('listaParcelas');
  const ps = fin.parcelas;
  const total = ps.reduce((s, p) => s + Number(p.valor), 0);
  const pago = ps.filter((p) => p.pago_em).reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);
  const pagas = ps.filter((p) => p.pago_em).length;

  if (!ps.length) {
    $('resumoParcelas').replaceChildren(el('p', { class: 'vazio', textContent: ehEquipe() ? 'Nenhuma parcela cadastrada. Use as opções abaixo.' : 'Nenhuma parcela cadastrada ainda.' }));
    lista.replaceChildren();
    return;
  }
  $('resumoParcelas').replaceChildren(
    el('div', { class: 'barra' }, el('div', { class: 'barra-cheia', style: `width:${total ? Math.round(pago / total * 100) : 0}%` })),
    resumoLinhas([
      ['Pago', `${dinheiro(pago)} (${pagas} de ${ps.length})`],
      ['A pagar', dinheiro(Math.max(0, total - pago))],
      ['Total', dinheiro(total)],
    ]),
  );

  lista.replaceChildren(...ps.map((p) => {
    const [classe, texto] = situacaoParcela(p);
    const acoes = el('div', { class: 'acoes' });
    (fin.comprovantes[p.id] || []).forEach((doc) => acoes.append(
      el('button', { textContent: '📎 Ver comprovante', onclick: () => abrirDocumento(doc) })));

    if (ehEquipe()) {
      acoes.append(p.pago_em
        ? el('button', { textContent: '↩️ Desfazer pagamento', onclick: () => marcarPaga(p, false) })
        : el('button', { class: 'principal', textContent: '✅ Marcar como paga', onclick: (ev) => pedirDataPagamento(p, ev.currentTarget.closest('li')) }));
      acoes.append(el('button', { textContent: '✏️ Editar', onclick: () => editarParcela(p) }));
      acoes.append(el('button', { class: 'perigo', textContent: 'Excluir', onclick: () => excluirParcela(p) }));
    } else if (!p.pago_em && !fin.comprovantes[p.id]?.length) {
      acoes.append(el('button', { class: 'principal', textContent: '📎 Enviar comprovante', onclick: () => escolherComprovante(p) }));
    }

    return el('li', {},
      el('div', { class: 'topo-item' }, el('strong', { textContent: `Parcela ${p.numero}` }), el('strong', { textContent: dinheiro(p.valor) })),
      el('div', { class: 'sub-item' }, el('span', { textContent: `Vencimento: ${dataBR(p.vencimento)}` }), el('span', { class: 'chip ' + classe, textContent: texto })),
      p.observacao ? el('div', { class: 'sub-item', textContent: p.observacao }) : null,
      acoes.childElementCount ? acoes : null,
    );
  }));
}

// Abre, dentro da parcela, a escolha da data em que foi paga
function pedirDataPagamento(p, li) {
  if (li.querySelector('.confirmar-pagamento')) return;
  const campo = el('input', { type: 'date', value: isoData(hoje()), max: isoData(hoje()), id: `pago-${p.id}` });
  const caixa = el('div', { class: 'confirmar-pagamento' },
    el('label', { htmlFor: campo.id, textContent: 'Data do pagamento' }),
    campo,
    el('div', { class: 'acoes' },
      el('button', { class: 'principal', textContent: 'Confirmar pagamento', onclick: () => {
        if (!campo.value) return campo.focus();
        marcarPaga(p, true, campo.value);
      } }),
      el('button', { textContent: 'Cancelar', onclick: () => caixa.remove() }),
    ),
  );
  li.append(caixa);
  campo.focus();
}

async function marcarPaga(p, paga, data) {
  const { error } = await supabase.from('parcelas').update(paga
    ? { pago_em: data || isoData(hoje()), valor_pago: p.valor }
    : { pago_em: null, valor_pago: null }).eq('id', p.id);
  if (error) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusParcelas'), paga ? `✅ Parcela ${p.numero} paga em ${dataBR(data || isoData(hoje()))}.` : `Pagamento da parcela ${p.numero} desfeito.`, 'ok');
  carregarFinanceiro();
}

function editarParcela(p) {
  $('detParcela').open = true;
  $('parcelaId').value = p.id;
  $('parcelaVenc').value = p.vencimento;
  $('parcelaValor').value = valorParaCampo(p.valor);
  $('parcelaPagoEm').value = p.pago_em || '';
  $('parcelaObs').value = p.observacao || '';
  $('btnSalvarParcela').textContent = `Salvar parcela ${p.numero}`;
  $('btnCancelarParcela').classList.remove('hidden');
  $('parcelaVenc').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function excluirParcela(p) {
  if (!confirm(`Excluir a parcela ${p.numero} (${dinheiro(p.valor)})?`)) return;
  const { error } = await supabase.from('parcelas').delete().eq('id', p.id);
  if (error) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusParcelas'), `Parcela ${p.numero} excluída.`, 'ok');
  carregarFinanceiro();
}

$('formParcela').addEventListener('submit', async (e) => {
  e.preventDefault();
  const valor = lerValor($('parcelaValor').value);
  if (valor == null) return mostrarStatus($('statusParcelas'), 'Valor inválido.', 'erro');
  const id = Number($('parcelaId').value) || null;
  const pagoEm = $('parcelaPagoEm').value || null;
  const dados = {
    vencimento: $('parcelaVenc').value,
    valor,
    pago_em: pagoEm,
    valor_pago: pagoEm ? valor : null,
    observacao: $('parcelaObs').value.trim() || null,
  };
  const { error } = id
    ? await supabase.from('parcelas').update(dados).eq('id', id)
    : await supabase.from('parcelas').insert({
      ...dados,
      obra_codigo: obraAtual(),
      numero: Math.max(0, ...fin.parcelas.map((p) => p.numero)) + 1,
    });
  if (error) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(error), 'erro');
  limparFormParcela();
  mostrarStatus($('statusParcelas'), id ? '✅ Parcela atualizada.' : '✅ Parcela adicionada.', 'ok');
  carregarFinanceiro();
});

function limparFormParcela() {
  $('formParcela').reset();
  $('parcelaId').value = '';
  $('btnSalvarParcela').textContent = 'Adicionar parcela';
  $('btnCancelarParcela').classList.add('hidden');
}
$('btnCancelarParcela').addEventListener('click', () => { limparFormParcela(); $('detParcela').open = false; });

// Gerar parcelas mensais
function sugerirGeracao() {
  const o = fin.obra;
  const jaParcelado = fin.parcelas.reduce((s, p) => s + Number(p.valor), 0);
  if (!$('gerarTotal').value && o.valor_entrada) $('gerarTotal').value = valorParaCampo(Math.max(0, o.valor_entrada - jaParcelado));
  if (!$('gerarPrimeira').value) $('gerarPrimeira').value = isoData(somarMeses(hoje(), 1));
  if (!$('gerarQtd').value && o.data_entrega_prevista) {
    const ini = lerData($('gerarPrimeira').value);
    const fim = lerData(o.data_entrega_prevista);
    const meses = (fim.getFullYear() - ini.getFullYear()) * 12 + fim.getMonth() - ini.getMonth() + (fim.getDate() >= ini.getDate() ? 1 : 0);
    if (meses > 0) $('gerarQtd').value = Math.min(120, meses);
  }
  previaGeracao();
}

function planoParcelas() {
  const total = lerValor($('gerarTotal').value);
  const qtd = parseInt($('gerarQtd').value, 10);
  const primeira = lerData($('gerarPrimeira').value);
  if (!total || !qtd || qtd < 1 || !primeira) return null;
  const base = Math.floor((total / qtd) * 100) / 100;
  const ultima = Math.round((total - base * (qtd - 1)) * 100) / 100;
  return Array.from({ length: qtd }, (_, i) => ({ vencimento: isoData(somarMeses(primeira, i)), valor: i === qtd - 1 ? ultima : base }));
}

function previaGeracao() {
  const plano = planoParcelas();
  $('gerarPrevia').textContent = plano
    ? `${plano.length}x de ${dinheiro(plano[0].valor)}` + (plano.at(-1).valor !== plano[0].valor ? ` (última de ${dinheiro(plano.at(-1).valor)})` : '') +
      ` — de ${dataBR(plano[0].vencimento)} até ${dataBR(plano.at(-1).vencimento)}`
    : '';
}
['gerarTotal', 'gerarQtd', 'gerarPrimeira'].forEach((id) => $(id).addEventListener('input', previaGeracao));

$('formGerar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const plano = planoParcelas();
  if (!plano) return mostrarStatus($('statusParcelas'), 'Confira o valor, a quantidade e a data.', 'erro');
  const aviso = fin.parcelas.length ? `\n\nJá existem ${fin.parcelas.length} parcelas; as novas serão acrescentadas depois delas.` : '';
  if (!confirm(`Gerar ${plano.length} parcelas de ${dinheiro(plano[0].valor)}?${aviso}`)) return;
  const inicio = Math.max(0, ...fin.parcelas.map((p) => p.numero));
  const { error } = await supabase.from('parcelas').insert(plano.map((p, i) => ({ ...p, obra_codigo: obraAtual(), numero: inicio + i + 1 })));
  if (error) return mostrarStatus($('statusParcelas'), '❌ ' + traduzirErro(error), 'erro');
  e.target.reset();
  e.target.closest('details').open = false;
  mostrarStatus($('statusParcelas'), `✅ ${plano.length} parcelas geradas.`, 'ok');
  carregarFinanceiro();
});

// Cliente: enviar comprovante de uma parcela
let parcelaDoComprovante = null;
function escolherComprovante(p) {
  parcelaDoComprovante = p;
  $('arquivoComprovante').value = '';
  $('arquivoComprovante').click();
}

$('arquivoComprovante').addEventListener('change', async () => {
  const arquivo = $('arquivoComprovante').files[0];
  const p = parcelaDoComprovante;
  if (!arquivo || !p) return;
  const status = $('statusParcelas');
  if (arquivo.size > 15 * 1024 * 1024) return mostrarStatus(status, 'Arquivo muito grande (máximo 15 MB).', 'erro');
  mostrarStatus(status, `Enviando comprovante da parcela ${p.numero}...`);
  const caminho = `${p.obra_codigo}/comprovantes/parcela-${p.numero}-${Date.now()}-${nomeSeguro(arquivo.name)}`;
  const { error: e1 } = await supabase.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type });
  if (e1) return mostrarStatus(status, '❌ ' + traduzirErro(e1), 'erro');
  const { error: e2 } = await supabase.from('documentos').insert({
    obra_codigo: p.obra_codigo,
    nome: `Comprovante – parcela ${p.numero}`,
    categoria: 'comprovante',
    caminho,
    tamanho: arquivo.size,
    tipo_mime: arquivo.type,
    parcela_id: p.id,
  });
  if (e2) {
    await supabase.storage.from('documentos').remove([caminho]);
    return mostrarStatus(status, '❌ ' + traduzirErro(e2), 'erro');
  }
  mostrarStatus(status, `✅ Comprovante da parcela ${p.numero} enviado! A construtora vai confirmar o pagamento.`, 'ok');
  carregarFinanceiro();
});

// Repasses da Caixa
function desenharRepasses() {
  const rs = fin.repasses;
  const lista = $('listaRepasses');
  if (!rs.length) {
    $('resumoRepasses').replaceChildren(el('p', { class: 'vazio', textContent: 'Nenhum repasse cadastrado ainda.' }));
    lista.replaceChildren();
    return;
  }
  const total = rs.reduce((s, r) => s + Number(r.valor), 0);
  const recebido = rs.filter((r) => r.data_recebida).reduce((s, r) => s + Number(r.valor), 0);
  $('resumoRepasses').replaceChildren(
    el('div', { class: 'barra' }, el('div', { class: 'barra-cheia', style: `width:${total ? Math.round(recebido / total * 100) : 0}%` })),
    resumoLinhas([
      ['Recebido da Caixa', dinheiro(recebido)],
      ['A receber', dinheiro(total - recebido)],
      ...(fin.obra.valor_financiamento ? [['Financiamento total', dinheiro(fin.obra.valor_financiamento)]] : []),
    ]),
  );

  lista.replaceChildren(...rs.map((r) => {
    let chip;
    if (r.data_recebida) chip = ['chip-ok', `✅ Recebido em ${dataBR(r.data_recebida)}`];
    else if (r.data_prevista && lerData(r.data_prevista) < hoje()) chip = ['chip-breve', `Previsto para ${dataBR(r.data_prevista)}`];
    else chip = ['chip-futuro', r.data_prevista ? `Previsto para ${dataBR(r.data_prevista)}` : 'Aguardando medição'];

    const acoes = ehEquipe() ? el('div', { class: 'acoes' },
      r.data_recebida
        ? el('button', { textContent: '↩️ Desfazer', onclick: () => marcarRecebido(r, false) })
        : el('button', { class: 'principal', textContent: '✅ Marcar como recebido', onclick: () => marcarRecebido(r, true) }),
      el('button', { textContent: '✏️ Editar', onclick: () => editarRepasse(r) }),
      el('button', { class: 'perigo', textContent: 'Excluir', onclick: () => excluirRepasse(r) }),
    ) : null;

    return el('li', {},
      el('div', { class: 'topo-item' }, el('strong', { textContent: r.descricao }), el('strong', { textContent: dinheiro(r.valor) })),
      el('div', { class: 'sub-item' }, el('span', { class: 'chip ' + chip[0], textContent: chip[1] })),
      acoes,
    );
  }));
}

async function marcarRecebido(r, recebido) {
  const { error } = await supabase.from('repasses').update({ data_recebida: recebido ? isoData(hoje()) : null }).eq('id', r.id);
  if (error) return mostrarStatus($('statusRepasses'), '❌ ' + traduzirErro(error), 'erro');
  carregarFinanceiro();
}

function editarRepasse(r) {
  $('detRepasse').open = true;
  $('repasseId').value = r.id;
  $('repasseDesc').value = r.descricao;
  $('repassePrev').value = r.data_prevista || '';
  $('repasseValor').value = valorParaCampo(r.valor);
  $('btnSalvarRepasse').textContent = 'Salvar repasse';
  $('repasseDesc').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function excluirRepasse(r) {
  if (!confirm(`Excluir o repasse "${r.descricao}"?`)) return;
  const { error } = await supabase.from('repasses').delete().eq('id', r.id);
  if (error) return mostrarStatus($('statusRepasses'), '❌ ' + traduzirErro(error), 'erro');
  carregarFinanceiro();
}

$('formRepasse').addEventListener('submit', async (e) => {
  e.preventDefault();
  const valor = lerValor($('repasseValor').value);
  if (valor == null) return mostrarStatus($('statusRepasses'), 'Valor inválido.', 'erro');
  const id = Number($('repasseId').value) || null;
  const dados = { descricao: $('repasseDesc').value.trim(), data_prevista: $('repassePrev').value || null, valor };
  const { error } = id
    ? await supabase.from('repasses').update(dados).eq('id', id)
    : await supabase.from('repasses').insert({ ...dados, obra_codigo: obraAtual() });
  if (error) return mostrarStatus($('statusRepasses'), '❌ ' + traduzirErro(error), 'erro');
  e.target.reset();
  $('repasseId').value = '';
  $('btnSalvarRepasse').textContent = 'Adicionar repasse';
  mostrarStatus($('statusRepasses'), '✅ Repasse salvo.', 'ok');
  carregarFinanceiro();
});

// ===========================
// DOCUMENTOS
// ===========================
async function abrirDocumento(doc) {
  // Abre a janela antes (o celular bloqueia pop-up aberto depois de esperar a internet)
  const janela = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.caminho, 300);
  if (error) {
    janela?.close();
    return alert('Não foi possível abrir o arquivo: ' + traduzirErro(error));
  }
  if (janela) janela.location.href = data.signedUrl;
  else location.href = data.signedUrl;
}

async function carregarDocumentos(manterStatus = false) {
  const codigo = obraAtual();
  const caixa = $('listaDocumentos');
  if (!manterStatus) $('statusDocumentos').textContent = '';
  if (!codigo) return;
  caixa.innerHTML = '<p class="vazio">Carregando…</p>';

  const [{ data: docs, error }, { data: parcelas }] = await Promise.all([
    supabase.from('documentos').select('*').eq('obra_codigo', codigo).order('criado_em', { ascending: false }),
    supabase.from('parcelas').select('id, numero').eq('obra_codigo', codigo),
  ]);
  if (error) { caixa.innerHTML = ''; return mostrarStatus($('statusDocumentos'), '❌ ' + traduzirErro(error), 'erro'); }
  if (codigo !== obraAtual()) return;
  if (!docs.length) { caixa.innerHTML = '<p class="vazio">Nenhum arquivo ainda.</p>'; return; }

  const numeroParcela = Object.fromEntries((parcelas || []).map((p) => [p.id, p.numero]));
  const grupos = Object.keys(CATEGORIAS_DOC).map((cat) => [cat, docs.filter((d) => d.categoria === cat)]).filter(([, l]) => l.length);

  caixa.replaceChildren(...grupos.map(([cat, lista]) => el('div', { class: 'grupo-doc' },
    el('h4', { textContent: `${CATEGORIAS_DOC[cat][1]} (${lista.length})` }),
    lista.map((d) => {
      const detalhes = [new Date(d.criado_em).toLocaleDateString('pt-BR'), tamanhoArquivo(d.tamanho)];
      if (d.parcela_id && numeroParcela[d.parcela_id]) detalhes.push(`parcela ${numeroParcela[d.parcela_id]}`);
      const podeApagar = ehEquipe() || d.enviado_por === estado.usuario.id;
      return el('div', { class: 'doc' },
        el('span', { class: 'ic-doc', textContent: CATEGORIAS_DOC[cat][0] }),
        el('div', { class: 'info-doc' }, el('strong', { textContent: d.nome }), el('small', { textContent: detalhes.filter(Boolean).join(' · ') })),
        el('button', { textContent: 'Abrir', onclick: () => abrirDocumento(d) }),
        podeApagar ? el('button', { class: 'perigo', textContent: 'Apagar', onclick: () => apagarDocumento(d) }) : null,
      );
    }),
  )));
}

async function apagarDocumento(d) {
  if (!confirm(`Apagar "${d.nome}"? Não dá para desfazer.`)) return;
  const { data, error } = await supabase.from('documentos').delete().eq('id', d.id).select('id');
  if (error || !data?.length) return mostrarStatus($('statusDocumentos'), '❌ ' + (error ? traduzirErro(error) : 'Sem permissão para apagar.'), 'erro');
  await supabase.storage.from('documentos').remove([d.caminho]);
  mostrarStatus($('statusDocumentos'), '✅ Arquivo apagado.', 'ok');
  carregarDocumentos(true);
}

$('formDocumento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('statusDocUpload');
  const arquivo = $('docArquivo').files[0];
  const codigo = obraAtual();
  if (!arquivo || !codigo) return mostrarStatus(status, 'Escolha a obra e o arquivo.', 'erro');
  const btn = e.target.querySelector('button[type=submit]');
  botaoCarregando(btn, true, 'Enviando...');
  const categoria = $('docCategoria').value;
  const caminho = `${codigo}/${categoria}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
  const { error: e1 } = await supabase.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type || 'application/octet-stream' });
  if (e1) { botaoCarregando(btn, false); return mostrarStatus(status, '❌ ' + traduzirErro(e1), 'erro'); }
  const { error: e2 } = await supabase.from('documentos').insert({
    obra_codigo: codigo,
    nome: $('docNome').value.trim() || arquivo.name,
    categoria,
    caminho,
    tamanho: arquivo.size,
    tipo_mime: arquivo.type || null,
  });
  botaoCarregando(btn, false);
  if (e2) {
    await supabase.storage.from('documentos').remove([caminho]);
    return mostrarStatus(status, '❌ ' + traduzirErro(e2), 'erro');
  }
  e.target.reset();
  mostrarStatus(status, '✅ Documento enviado.', 'ok');
  carregarDocumentos();
});

// ===========================
// GERENCIAR OBRAS (equipe)
// ===========================
$('obraEditar').addEventListener('change', (e) => abrirObra(e.target.value));
$('obraPercentualRange').addEventListener('input', (e) => ($('obraPercentualNum').value = e.target.value));
$('obraPercentualNum').addEventListener('input', (e) => ($('obraPercentualRange').value = e.target.value));

function definirPercentual(valor) {
  $('obraPercentualRange').value = valor;
  $('obraPercentualNum').value = valor;
}

function linhaEtapa(nome = '', status = 'pendente') {
  const linha = el('div', { class: 'etapa-linha' });
  linha.innerHTML = `
    <input type="text" class="etapa-nome" placeholder="Nome da etapa" required>
    <select class="etapa-status" aria-label="Situação da etapa">
      <option value="pendente">⏳ Pendente</option>
      <option value="andamento">🔨 Em andamento</option>
      <option value="concluida">✅ Concluída</option>
    </select>
    <button type="button" title="Subir">↑</button>
    <button type="button" title="Remover">✕</button>`;
  linha.querySelector('.etapa-nome').value = nome;
  linha.querySelector('.etapa-status').value = status;
  const [btnSubir, btnRemover] = linha.querySelectorAll('button');
  btnSubir.addEventListener('click', () => {
    if (linha.previousElementSibling) linha.parentNode.insertBefore(linha, linha.previousElementSibling);
  });
  btnRemover.addEventListener('click', () => linha.remove());
  return linha;
}
$('btnAddEtapa').addEventListener('click', () => $('listaEtapas').appendChild(linhaEtapa()));

async function abrirObra(codigo) {
  const status = $('statusObra');
  status.textContent = '';
  const nova = codigo === NOVA_OBRA;
  $('campoCodigo').classList.toggle('hidden', !nova);
  $('obraCodigo').required = nova;
  $('linkSite').classList.toggle('hidden', nova);
  $('obraEntregueInfo').textContent = '';

  if (nova) {
    ['obraCodigo', 'obraNome', 'obraEndereco', 'obraPrazo'].forEach((id) => ($(id).value = ''));
    definirPercentual(0);
    $('listaEtapas').replaceChildren(...ETAPAS_PADRAO.map((n) => linhaEtapa(n)));
    return;
  }

  $('linkSite').href = `../acompanhar.html?codigo=${encodeURIComponent(codigo)}`;
  const [{ data: obra, error: e1 }, { data: etapas, error: e2 }] = await Promise.all([
    supabase.from('obras').select('*').eq('codigo', codigo).single(),
    supabase.from('etapas').select('nome, status').eq('obra_codigo', codigo).order('ordem').order('id'),
  ]);
  if (e1 || e2) return mostrarStatus(status, '❌ Erro ao abrir obra: ' + traduzirErro(e1 || e2), 'erro');

  $('obraNome').value = obra.nome;
  $('obraEndereco').value = obra.endereco || '';
  $('obraPrazo').value = obra.data_entrega_prevista || '';
  definirPercentual(obra.percentual);
  if (obra.entregue_em) $('obraEntregueInfo').textContent = `🎉 Obra entregue em ${dataBR(obra.entregue_em)} (registrado ao chegar em 100%).`;
  $('listaEtapas').replaceChildren(...etapas.map((e) => linhaEtapa(e.nome, e.status)));
}

$('formObra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('statusObra');
  const btn = e.target.querySelector('button[type=submit]');
  const nova = $('obraEditar').value === NOVA_OBRA;
  const codigo = nova ? $('obraCodigo').value.trim().toUpperCase() : $('obraEditar').value;
  if (nova && estado.obras.some((o) => o.codigo === codigo)) return mostrarStatus(status, '❌ Já existe uma obra com esse código.', 'erro');

  const percentual = Math.min(100, Math.max(0, parseInt($('obraPercentualNum').value, 10) || 0));
  const etapas = [...document.querySelectorAll('#listaEtapas .etapa-linha')]
    .map((linha, i) => ({
      obra_codigo: codigo,
      ordem: i + 1,
      nome: linha.querySelector('.etapa-nome').value.trim(),
      status: linha.querySelector('.etapa-status').value,
    }))
    .filter((et) => et.nome);

  botaoCarregando(btn, true, 'Salvando...');
  try {
    const dados = {
      codigo,
      nome: $('obraNome').value.trim(),
      endereco: $('obraEndereco').value.trim() || null,
      data_entrega_prevista: $('obraPrazo').value || null,
      percentual,
    };
    const { error: erroObra } = nova
      ? await supabase.from('obras').insert(dados)
      : await supabase.from('obras').update(dados).eq('codigo', codigo);
    if (erroObra) throw erroObra;

    const { error: erroDel } = await supabase.from('etapas').delete().eq('obra_codigo', codigo);
    if (erroDel) throw erroDel;
    if (etapas.length) {
      const { error: erroIns } = await supabase.from('etapas').insert(etapas);
      if (erroIns) throw erroIns;
    }
    await carregarObras(codigo);
    mostrarStatus(status, percentual === 100 ? `🎉 Obra ${codigo} salva como ENTREGUE!` : `✅ Obra ${codigo} salva!`, 'ok');
  } catch (erro) {
    mostrarStatus(status, '❌ Erro ao salvar: ' + traduzirErro(erro), 'erro');
  } finally {
    botaoCarregando(btn, false);
  }
});

// ===========================
// ACESSOS (equipe)
// ===========================
$('cadPapel').addEventListener('change', (e) => $('campoCadObra').classList.toggle('hidden', e.target.value !== 'cliente'));
$('acessoPapel').addEventListener('change', (e) => $('campoAcessoObra').classList.toggle('hidden', e.target.value !== 'cliente'));

function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const aleatorio = new Uint32Array(8);
  crypto.getRandomValues(aleatorio);
  const parte = Array.from(aleatorio.slice(0, 4), (n) => letras[n % letras.length]).join('');
  const numeros = Array.from(aleatorio.slice(4), (n) => n % 10).join('');
  return 'Dl' + parte + numeros;
}
$('btnGerarSenha').addEventListener('click', () => ($('cadSenha').value = gerarSenha()));

async function chamarFuncaoUsuarios(corpo) {
  const { data, error } = await supabase.functions.invoke('criar-usuario', { body: corpo });
  if (!error) return data;
  let msg = error.message;
  try {
    const resp = await error.context?.json?.();
    if (resp?.erro) msg = resp.erro;
  } catch { /* sem corpo */ }
  if (/Failed to send|FunctionsFetchError|404|not found/i.test(msg + error.name)) {
    msg = 'A função "criar-usuario" ainda não foi publicada no Supabase (Edge Functions).';
  }
  throw new Error(msg);
}

$('formCadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const status = $('statusCadastro');
  const pronto = $('cadastroPronto');
  pronto.classList.add('hidden');
  const dados = {
    acao: 'criar',
    nome: $('cadNome').value.trim(),
    email: $('cadEmail').value.trim(),
    senha: $('cadSenha').value,
    papel: $('cadPapel').value,
    obra_codigo: $('cadPapel').value === 'cliente' ? $('cadObra').value : null,
  };
  botaoCarregando(btn, true, 'Cadastrando...');
  try {
    await chamarFuncaoUsuarios(dados);
    mostrarStatus(status, `✅ ${dados.nome} cadastrado(a)!`, 'ok');
    const link = new URL('./', location.href).href;
    const texto = `Olá, ${dados.nome}! Seu acesso ao App da Obra da DL Construtora está pronto.\n\n` +
      `Acesse: ${link}\nE-mail: ${dados.email}\nSenha: ${dados.senha}\n\n` +
      'No primeiro acesso, se quiser, troque a senha em "Esqueci minha senha".';
    pronto.replaceChildren(
      el('strong', { textContent: 'Mensagem pronta para enviar:' }),
      el('pre', { textContent: texto }),
      el('div', { class: 'acoes' },
        el('a', { href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener', textContent: '📲 Enviar pelo WhatsApp' }),
        el('button', {
          type: 'button', textContent: '📋 Copiar',
          onclick: async (ev) => {
            try { await navigator.clipboard.writeText(texto); ev.currentTarget.textContent = '✅ Copiado'; } catch { /* sem permissão */ }
          },
        }),
      ),
    );
    pronto.classList.remove('hidden');
    e.target.reset();
    $('campoCadObra').classList.remove('hidden');
    carregarAcessos();
  } catch (erro) {
    mostrarStatus(status, '❌ ' + erro.message, 'erro');
  } finally {
    botaoCarregando(btn, false);
  }
});

async function carregarAcessos() {
  const lista = $('listaAcessos');
  const { data, error } = await supabase.rpc('listar_acessos');
  if (error) { lista.innerHTML = ''; return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro'); }

  lista.replaceChildren(...data.map((a) => {
    const detalhe = !a.papel ? '⚠️ Sem acesso liberado' : a.papel === 'equipe' ? '👷 Equipe' : `🏠 Cliente – ${a.obra_codigo}`;
    const acoes = el('div', { class: 'acoes-acesso' },
      el('button', {
        textContent: a.papel ? 'Alterar' : 'Liberar',
        onclick: () => {
          $('detAlterar').open = true;
          $('acessoEmail').value = a.email;
          $('acessoPapel').value = a.papel || 'cliente';
          $('acessoPapel').dispatchEvent(new Event('change'));
          if (a.obra_codigo) $('acessoObra').value = a.obra_codigo;
          $('acessoEmail').scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      }),
      el('button', { textContent: '🔑 Senha', onclick: () => redefinirSenha(a) }),
      a.papel && a.user_id !== estado.usuario.id ? el('button', { textContent: 'Remover', onclick: () => removerAcesso(a) }) : null,
    );
    return el('li', {},
      el('div', { class: 'email' }, a.nome || a.email, a.nome ? el('small', { textContent: a.email }) : null, el('small', { textContent: detalhe })),
      acoes,
    );
  }));
}

async function redefinirSenha(a) {
  const nova = prompt(`Nova senha para ${a.nome || a.email} (mínimo 6 caracteres):`, gerarSenha());
  if (!nova) return;
  try {
    await chamarFuncaoUsuarios({ acao: 'senha', user_id: a.user_id, senha: nova });
    mostrarStatus($('statusAcesso'), `✅ Senha de ${a.nome || a.email} alterada para: ${nova}`, 'ok');
  } catch (erro) {
    mostrarStatus($('statusAcesso'), '❌ ' + erro.message, 'erro');
  }
}

$('formAcesso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const papel = $('acessoPapel').value;
  botaoCarregando(btn, true, 'Salvando...');
  const { error } = await supabase.rpc('definir_acesso', {
    p_email: $('acessoEmail').value.trim(),
    p_papel: papel,
    p_obra: papel === 'cliente' ? $('acessoObra').value : null,
  });
  botaoCarregando(btn, false);
  if (error) return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusAcesso'), '✅ Acesso atualizado!', 'ok');
  e.target.reset();
  $('detAlterar').open = false;
  carregarAcessos();
});

async function removerAcesso(a) {
  if (!confirm(`Remover o acesso de ${a.nome || a.email}? O login continua existindo, mas não verá mais nada.`)) return;
  const { error } = await supabase.rpc('remover_acesso', { p_user_id: a.user_id });
  if (error) return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusAcesso'), '✅ Acesso removido.', 'ok');
  carregarAcessos();
}
