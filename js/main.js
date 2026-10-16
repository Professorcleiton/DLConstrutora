// ===========================
// MENU MOBILE
// ===========================
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    nav.classList.toggle('ativo');
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('ativo');
    });
  });
}

// ===========================
// SCROLL SUAVE
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const alvo = document.querySelector(href);
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===========================
// VALIDAÇÃO DO FORMULÁRIO
// ===========================
const form = document.getElementById('formContato');
const msgSucesso = document.getElementById('msgSucesso');

if (form) {
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

    if (msgSucesso) {
      msgSucesso.textContent = 'Dados enviados! Entraremos em contato em breve.';
    }
  });
}

// ===========================
// ANIMAÇÕES COORDENADAS
// ===========================

// 1. BARRA DE PROGRESSO NO TOPO
function criarBarraProgresso() {
  const barra = document.createElement('div');
  barra.className = 'progress-bar';
  document.body.appendChild(barra);
  return barra;
}

// 2. HEADER QUE ENCOLHE (sem parallax do hero, porque agora é vídeo)
function configurarScroll() {
  const header = document.querySelector('.header');
  const barra = criarBarraProgresso();

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
    const progresso = alturaTotal > 0 ? (scrollY / alturaTotal) * 100 : 0;

    barra.style.width = progresso + '%';

    if (header) {
      if (scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  }, { passive: true });
}

// 3. REVEAL DAS SEÇÕES
function configurarReveal() {
  const elementos = document.querySelectorAll('.reveal, .reveal-stagger');

  if (!('IntersectionObserver' in window)) {
    elementos.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -80px 0px'
  });

  elementos.forEach(el => observer.observe(el));
}

// 4. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  configurarScroll();
  configurarReveal();
});
