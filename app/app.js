import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://sbynpvhsbnzqicgutsaw.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_xVkg_aTYnEvHZOzqNhg38A_0aTD6Kgs'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// LÓGICA DO APP DE ENVIO
// ===========================

// Verifica se o usuário já está logado ao abrir a página
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) mostrarEnvio();
});

// Função de Login
window.fazerLogin = async function() {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const btn = document.querySelector('#tela-login button');
  const erroMsg = document.getElementById('erro-login');
  
  if(!email || !senha) {
    erroMsg.textContent = 'Preencha e-mail e senha.';
    return;
  }

  btn.textContent = 'Entrando...';
  erroMsg.textContent = '';

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  
  if (error) {
    erroMsg.textContent = 'Erro: ' + (error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    btn.textContent = 'Entrar';
  } else {
    mostrarEnvio();
  }
}

// Alterna as telas
function mostrarEnvio() {
  document.getElementById('tela-login').classList.add('hidden');
  document.getElementById('tela-envio').classList.remove('hidden');
}

// Função de Envio da Mídia
window.enviar = async function(destino) {
  const status = document.getElementById('status');
  const btnObra = document.querySelector('.btn-obra');
  const btnRedes = document.querySelector('.btn-redes');
  
  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();
  const arquivo = document.getElementById('arquivo').files[0];
  const legenda = document.getElementById('legenda').value;

  if (!codigo || !arquivo) {
    status.textContent = "Preencha o código da obra e selecione um arquivo.";
    status.style.color = "red";
    return;
  }

  status.textContent = "Enviando... aguarde.";
  status.style.color = "black";
  
  // Desabilita botões para evitar envio duplo
  btnObra.disabled = true;
  btnRedes.disabled = true;
  btnObra.style.opacity = '0.5';
  btnRedes.style.opacity = '0.5';

  try {
    // 1. Upload do arquivo para o Storage do Supabase
    const nomeArquivo = `${Date.now()}-${arquivo.name.replace(/\s/g, '_')}`;
    const { error: erroUpload } = await supabase.storage.from('midias').upload(nomeArquivo, arquivo);

    if (erroUpload) throw new Error("Erro no upload: " + erroUpload.message);

    // 2. Pega a URL pública da imagem/vídeo
    const { data: urlData } = supabase.storage.from('midias').getPublicUrl(nomeArquivo);

    // 3. Detecta o tipo
    const tipo = arquivo.type.startsWith('video') ? 'video' : 'foto';

    // 4. Insere no banco de dados
    const { error: erroInsert } = await supabase.from('midias').insert({
      obra_codigo: codigo,
      url: urlData.publicUrl,
      tipo: tipo,
      legenda: legenda || null,
      destino: destino
    });

    if (erroInsert) throw new Error("Erro ao salvar no banco: " + erroInsert.message);

    // Sucesso
    status.textContent = destino === 'obra' 
      ? "✅ Publicado na página Acompanhar Obra!" 
      : "✅ Enviado para Redes Sociais!";
    status.style.color = "green";
    
    // Limpa os campos
    document.getElementById('arquivo').value = '';
    document.getElementById('legenda').value = '';

  } catch (erro) {
    status.textContent = "❌ " + erro.message;
    status.style.color = "red";
  } finally {
    // Reabilita botões
    btnObra.disabled = false;
    btnRedes.disabled = false;
    btnObra.style.opacity = '1';
    btnRedes.style.opacity = '1';
  }
}

// Função de Sair
window.sair = async function() {
  await supabase.auth.signOut();
  location.reload();
}
