// 1. MENU MOBILE
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');

menuToggle.addEventListener('click', () => {
  nav.classList.toggle('ativo');
});

// Fecha o menu ao clicar em um link
nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('ativo');
  });
});

// 2. SCROLL SUAVE
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const alvo = document.querySelector(link.getAttribute('href'));
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// 3. VALIDAÇÃO DO FORMULÁRIO
const form = document.getElementById('formContato');
const msgSucesso = document.getElementById('msgSucesso');

form.addEventListener('submit', (e) => {
  const nome = form.nome.value.trim();
  const telefone = form.telefone.value.trim();
  const tipo = form.tipo_obra.value;

  if (!nome || !telefone || !tipo) {
    e.preventDefault();
    alert('Por favor, preencha nome, telefone e tipo de obra.');
    return;
  }

  // Se estiver usando Formspree, o envio é automático.
  // Abaixo, apenas mostramos mensagem após envio (para demo).
  msgSucesso.textContent = 'Orçamento enviado! Entraremos em contato em breve.';
});
