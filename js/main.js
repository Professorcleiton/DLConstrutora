// 1. MENU MOBILE
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');

menuToggle.addEventListener('click', () => {
  nav.classList.toggle('ativo');
});

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
  const renda = form.renda.value.trim();
  const terreno = form.terreno.value;

  if (!nome || !telefone || !renda || !terreno) {
    e.preventDefault();
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  msgSucesso.textContent = 'Dados enviados! Entraremos em contato em breve.';
});
