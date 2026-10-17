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
// FORMULÁRIO → WHATSAPP
// ===========================
const form = document.getElementById('formContato');
const msgSucesso = document.getElementById('msgSucesso');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = form.nome.value.trim();
    const telefone = form.telefone.value.trim();
    const renda = form.renda.value.trim();
    const terreno = form.terreno.value;
    const mensagem = form.mensagem.value.trim();

    if (!nome || !telefone || !renda || !terreno) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Monta a mensagem formatada para o WhatsApp
    const texto = `Olá! Quero saber se me enquadro no financiamento.%0A%0A` +
                  `*Nome:* ${nome}%0A` +
                  `*Telefone:* ${telefone}%0A` +
                  `*Renda:* R$ ${renda}%0A` +
                  `*Terreno:* ${terreno}%0A` +
                  `*Mensagem:* ${mensagem || 'Sem mensagem'}`;

    // Abre o WhatsApp com a mensagem preenchida
    window.open(`https://wa.me/5544991110706?text=${texto}`, '_blank');

    // Mostra mensagem de sucesso
    if (msgSucesso) {
      msgSucesso.textContent = 'Você será redirecionado para o WhatsApp...';
    }

    // Limpa o formulário depois de um tempo
    setTimeout(() => {
      form.reset();
      if (msgSucesso) msgSucesso.textContent = '';
    }, 3000);
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

// 2. HEADER QUE ENCOLHE
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

// 4. TROCA DE VÍDEOS NO HERO
function configurarVideosHero() {
  const videos = document.querySelectorAll('.hero-video');
  if (videos.length < 2) return;

  let indiceAtual = 0;

  function tocarProximo() {
    const atual = videos[indiceAtual];
    const proximo = videos[(indiceAtual + 1) % videos.length];

    atual.classList.remove('active');
    atual.pause();

    proximo.currentTime = 0;
    proximo.classList.add('active');
    proximo.play();

    indiceAtual = (indiceAtual + 1) % videos.length;
  }

  // Troca quando o vídeo atual terminar
  videos.forEach(video => {
    video.addEventListener('ended', tocarProximo);
  });

  // Garante que o primeiro está tocando
  videos[0].play();
}

// ===========================
// INICIALIZAÇÃO
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  configurarScroll();
  configurarReveal();
  configurarVideosHero();
});
