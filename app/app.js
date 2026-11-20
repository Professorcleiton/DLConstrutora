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

const $ = (id) => document.getElementById(id);
const estado = { usuario: null, papel: null, obraCliente: null, obras: [] };
const ehEquipe = () => estado.papel === 'equipe';

function mostrarTela(id) {
  TELAS.forEach((t) => $(t).classList.toggle('hidden', t !== id));
  window.scrollTo(0, 0);
}

function mostrarStatus(el, texto, tipo = 'info') {
  el.textContent = texto;
  el.className = 'status ' + tipo;
}

function traduzirErro(erro) {
  const msg = erro?.message || String(erro);
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Peça para a equipe confirmar o seu cadastro.';
  if (msg.includes('rate limit') || msg.includes('only request this after')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (msg.includes('row-level security')) return 'Você não tem permissão para isso.';
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
// LOGIN
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
  document.querySelectorAll('.so-equipe').forEach((el) => el.classList.toggle('hidden', !ehEquipe()));
  document.querySelectorAll('.so-cliente').forEach((el) => el.classList.toggle('hidden', ehEquipe()));

  mostrarTela('tela-app');
  await carregarObras();
  abrirAba(abaSalva());
}

// ===========================
// ABAS
// ===========================
function abaSalva() {
  try {
    const aba = localStorage.getItem('dl-aba');
    const btn = aba && document.querySelector(`.abas button[data-aba="${aba}"]`);
    return btn && !btn.classList.contains('hidden') ? aba : 'aba-envio';
  } catch { return 'aba-envio'; }
}

function abrirAba(id) {
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === id));
  document.querySelectorAll('.aba').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  try { localStorage.setItem('dl-aba', id); } catch { /* sem armazenamento */ }
  if (id === 'aba-midias') carregarMidias();
  if (id === 'aba-acessos') carregarAcessos();
}

document.querySelectorAll('.abas button').forEach((btn) => btn.addEventListener('click', () => abrirAba(btn.dataset.aba)));

// ===========================
// OBRAS (lista usada em todas as abas)
// ===========================
async function carregarObras(selecionar) {
  const { data, error } = await supabase.from('obras').select('codigo, nome').order('codigo');
  if (error) return mostrarStatus($('statusEnvio'), '❌ Erro ao carregar obras: ' + traduzirErro(error), 'erro');
  estado.obras = data;

  const nomeObra = (o) => `${o.codigo} – ${o.nome}`;
  const opcoes = () => data.map((o) => new Option(nomeObra(o), o.codigo));

  document.querySelectorAll('select.seletor-obra').forEach((sel) => {
    const anterior = sel.value;
    sel.replaceChildren(...opcoes());
    if (!data.length) sel.replaceChildren(new Option('Nenhuma obra cadastrada', ''));
    if (data.some((o) => o.codigo === anterior)) sel.value = anterior;
  });

  if (!ehEquipe()) {
    const minha = data.find((o) => o.codigo === estado.obraCliente);
    $('obraEnvioFixa').textContent = minha ? nomeObra(minha) : estado.obraCliente;
    return;
  }

  const editar = $('obraEditar');
  editar.replaceChildren(...opcoes(), new Option('+ Cadastrar nova obra', NOVA_OBRA));
  editar.value = selecionar || (data[0]?.codigo ?? NOVA_OBRA);
  await abrirObra(editar.value);
}

const obraSelecionada = (idSelect) => (ehEquipe() ? $(idSelect).value : estado.obraCliente);

// ===========================
// ENVIAR MÍDIA
// ===========================
$('arquivo').addEventListener('change', () => {
  const arquivo = $('arquivo').files[0];
  const preview = $('preview');
  preview.innerHTML = '';
  if (!arquivo) return;
  const el = document.createElement(arquivo.type.startsWith('video') ? 'video' : 'img');
  el.src = URL.createObjectURL(arquivo);
  if (el.tagName === 'VIDEO') el.controls = true;
  preview.appendChild(el);
});

function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
}

document.querySelectorAll('.destino-botoes button').forEach((btn) => {
  btn.addEventListener('click', () => enviar(btn.dataset.destino));
});

async function enviar(destino) {
  const status = $('statusEnvio');
  const botoes = document.querySelectorAll('.destino-botoes button');
  const codigo = obraSelecionada('obraEnvio');
  const arquivo = $('arquivo').files[0];

  if (!codigo || !arquivo) return mostrarStatus(status, 'Escolha a obra e selecione um arquivo.', 'erro');

  mostrarStatus(status, 'Enviando... aguarde.');
  botoes.forEach((b) => (b.disabled = true));

  try {
    const caminho = `${Date.now()}-${nomeSeguro(arquivo.name)}`;
    const { error: erroUpload } = await supabase.storage
      .from('midias')
      .upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: '31536000' });
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

    mostrarStatus(status, destino === 'obra'
      ? `✅ Publicado em Acompanhar Obra (${codigo})!`
      : '✅ Enviado para Redes Sociais!', 'ok');
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
// MÍDIAS (ver, baixar, mover, apagar)
// ===========================
$('obraMidias').addEventListener('change', () => carregarMidias());
$('filtroDestino').addEventListener('change', () => carregarMidias());

async function carregarMidias(manterStatus = false) {
  const grade = $('gradeMidias');
  const status = $('statusMidias');
  const codigo = obraSelecionada('obraMidias');
  if (!manterStatus) status.textContent = '';
  if (!codigo) { grade.innerHTML = ''; return; }

  grade.innerHTML = '<p class="vazio">Carregando…</p>';
  let consulta = supabase.from('midias')
    .select('id, url, tipo, legenda, categoria, destino, enviado_por, data_envio')
    .eq('obra_codigo', codigo)
    .order('data_envio', { ascending: false, nullsFirst: false });
  const filtro = ehEquipe() ? $('filtroDestino').value : '';
  if (filtro) consulta = consulta.eq('destino', filtro);

  const { data, error } = await consulta;
  if (error) {
    grade.innerHTML = '';
    return mostrarStatus(status, '❌ ' + traduzirErro(error), 'erro');
  }
  if (!data.length) {
    grade.innerHTML = '<p class="vazio">Nenhuma mídia por aqui ainda.</p>';
    return;
  }
  grade.replaceChildren(...data.map(cartaoMidia));
}

function urlAbsoluta(url) {
  return /^https?:/.test(url) ? url : new URL('../' + url, location.href).href;
}

function caminhoNoStorage(url) {
  const i = url.indexOf(PASTA_STORAGE);
  return i === -1 ? null : decodeURIComponent(url.slice(i + PASTA_STORAGE.length).split('?')[0]);
}

function cartaoMidia(m) {
  const cartao = document.createElement('article');
  cartao.className = 'midia';
  const url = urlAbsoluta(m.url);

  const visual = document.createElement(m.tipo === 'video' ? 'video' : 'img');
  visual.src = url;
  if (m.tipo === 'video') { visual.controls = true; visual.preload = 'metadata'; visual.playsInline = true; }
  else { visual.loading = 'lazy'; visual.alt = m.legenda || 'Foto da obra'; }
  cartao.appendChild(visual);

  const info = document.createElement('div');
  info.className = 'midia-info';
  if (m.legenda) {
    const p = document.createElement('p');
    p.textContent = m.legenda;
    info.appendChild(p);
  }
  const tag = document.createElement('span');
  tag.className = 'tag ' + (m.destino === 'redes' ? 'tag-redes' : 'tag-obra');
  tag.textContent = m.destino === 'redes' ? '📱 Redes' : '🏗️ Obra';
  info.append(tag, ' ', m.data_envio ? new Date(m.data_envio).toLocaleDateString('pt-BR') : '');
  cartao.appendChild(info);

  const acoes = document.createElement('div');
  acoes.className = 'midia-acoes';

  const baixar = document.createElement('a');
  baixar.textContent = 'Baixar';
  baixar.href = caminhoNoStorage(m.url) ? url + '?download=' : url;
  baixar.download = '';
  baixar.target = '_blank';
  baixar.rel = 'noopener';
  acoes.appendChild(baixar);

  if (ehEquipe()) {
    const mover = document.createElement('button');
    mover.className = 'mover';
    const novoDestino = m.destino === 'redes' ? 'obra' : 'redes';
    mover.textContent = novoDestino === 'obra' ? '🏗️ Mover para Obra' : '📱 Mover para Redes';
    mover.title = novoDestino === 'obra' ? 'Mostrar no Acompanhar Obra' : 'Tirar do site e mandar para Redes';
    mover.addEventListener('click', () => moverMidia(m, novoDestino, mover));
    acoes.appendChild(mover);
  }

  if (ehEquipe() || m.enviado_por === estado.usuario.id) {
    const apagar = document.createElement('button');
    apagar.className = 'apagar';
    apagar.textContent = 'Apagar';
    apagar.addEventListener('click', () => apagarMidia(m, apagar));
    acoes.appendChild(apagar);
  }

  cartao.appendChild(acoes);
  return cartao;
}

async function moverMidia(m, destino, btn) {
  btn.disabled = true;
  const { error } = await supabase.from('midias').update({ destino }).eq('id', m.id);
  if (error) {
    btn.disabled = false;
    return mostrarStatus($('statusMidias'), '❌ ' + traduzirErro(error), 'erro');
  }
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
    const { error: erroArquivo } = await supabase.storage.from('midias').remove([caminho]);
    if (erroArquivo) console.warn('Registro apagado, mas o arquivo ficou no Storage:', erroArquivo);
  }
  mostrarStatus(status, '✅ Mídia apagada.', 'ok');
  carregarMidias(true);
}

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
  const linha = document.createElement('div');
  linha.className = 'etapa-linha';
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

  if (nova) {
    $('obraCodigo').value = '';
    $('obraNome').value = '';
    $('obraEndereco').value = '';
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
  definirPercentual(obra.percentual);
  $('listaEtapas').replaceChildren(...etapas.map((e) => linhaEtapa(e.nome, e.status)));
}

$('formObra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('statusObra');
  const btn = e.target.querySelector('button[type=submit]');
  const nova = $('obraEditar').value === NOVA_OBRA;
  const codigo = nova ? $('obraCodigo').value.trim().toUpperCase() : $('obraEditar').value;

  if (nova && estado.obras.some((o) => o.codigo === codigo)) {
    return mostrarStatus(status, '❌ Já existe uma obra com esse código.', 'erro');
  }

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
    const { error: erroObra } = await supabase.from('obras').upsert({
      codigo,
      nome: $('obraNome').value.trim(),
      endereco: $('obraEndereco').value.trim() || null,
      percentual,
    });
    if (erroObra) throw erroObra;

    const { error: erroDel } = await supabase.from('etapas').delete().eq('obra_codigo', codigo);
    if (erroDel) throw erroDel;
    if (etapas.length) {
      const { error: erroIns } = await supabase.from('etapas').insert(etapas);
      if (erroIns) throw erroIns;
    }

    await carregarObras(codigo);
    mostrarStatus(status, `✅ Obra ${codigo} salva!`, 'ok');
  } catch (erro) {
    mostrarStatus(status, '❌ Erro ao salvar: ' + traduzirErro(erro), 'erro');
  } finally {
    botaoCarregando(btn, false);
  }
});

// ===========================
// ACESSOS (equipe)
// ===========================
$('acessoPapel').addEventListener('change', (e) => {
  $('campoAcessoObra').classList.toggle('hidden', e.target.value !== 'cliente');
});

async function carregarAcessos() {
  const lista = $('listaAcessos');
  const { data, error } = await supabase.rpc('listar_acessos');
  if (error) {
    lista.innerHTML = '';
    return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro');
  }

  lista.replaceChildren(...data.map((a) => {
    const li = document.createElement('li');
    const texto = document.createElement('div');
    texto.className = 'email';
    texto.textContent = a.email;
    const detalhe = document.createElement('small');
    detalhe.textContent = !a.papel ? '⚠️ Sem acesso liberado'
      : a.papel === 'equipe' ? '👷 Equipe' : `🏠 Cliente – ${a.obra_codigo}`;
    texto.appendChild(detalhe);
    li.appendChild(texto);

    const editar = document.createElement('button');
    editar.textContent = a.papel ? 'Alterar' : 'Liberar';
    editar.addEventListener('click', () => {
      $('acessoEmail').value = a.email;
      $('acessoPapel').value = a.papel || 'cliente';
      $('acessoPapel').dispatchEvent(new Event('change'));
      if (a.obra_codigo) $('acessoObra').value = a.obra_codigo;
      $('acessoEmail').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    li.appendChild(editar);

    if (a.papel && a.user_id !== estado.usuario.id) {
      const remover = document.createElement('button');
      remover.textContent = 'Remover';
      remover.addEventListener('click', () => removerAcesso(a));
      li.appendChild(remover);
    }
    return li;
  }));
}

$('formAcesso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const papel = $('acessoPapel').value;
  botaoCarregando(btn, true, 'Liberando...');
  const { error } = await supabase.rpc('definir_acesso', {
    p_email: $('acessoEmail').value.trim(),
    p_papel: papel,
    p_obra: papel === 'cliente' ? $('acessoObra').value : null,
  });
  botaoCarregando(btn, false);
  if (error) return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusAcesso'), '✅ Acesso liberado!', 'ok');
  $('acessoEmail').value = '';
  carregarAcessos();
});

async function removerAcesso(a) {
  if (!confirm(`Remover o acesso de ${a.email}? O login continua existindo, mas não verá mais nada.`)) return;
  const { error } = await supabase.rpc('remover_acesso', { p_user_id: a.user_id });
  if (error) return mostrarStatus($('statusAcesso'), '❌ ' + traduzirErro(error), 'erro');
  mostrarStatus($('statusAcesso'), '✅ Acesso removido.', 'ok');
  carregarAcessos();
}
