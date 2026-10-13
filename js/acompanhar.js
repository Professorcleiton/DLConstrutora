// Base de dados simulada (depois você pode trocar por um arquivo JSON externo)
const obras = {
  "CDO-2025-001": {
    nome: "Casa Residencial – Família Silva",
    endereco: "Bairro Jardim Alvorada, Cruzeiro do Oeste/PR",
    percentual: 65,
    etapas: [
      { nome: "Fundação", concluida: true },
      { nome: "Estrutura", concluida: true },
      { nome: "Alvenaria", concluida: true },
      { nome: "Cobertura", concluida: false },
      { nome: "Acabamento", concluida: false },
      { nome: "Entrega", concluida: false }
    ],
    fotos: [
      "img/obra1.jpg",
      "img/obra2.jpg",
      "img/obra3.jpg"
    ]
  },
  "CDO-2025-002": {
    nome: "Casa Popular – Família Souza",
    endereco: "Conjunto Primavera, Cruzeiro do Oeste/PR",
    percentual: 30,
    etapas: [
      { nome: "Fundação", concluida: true },
      { nome: "Estrutura", concluida: false },
      { nome: "Alvenaria", concluida: false },
      { nome: "Cobertura", concluida: false },
      { nome: "Acabamento", concluida: false },
      { nome: "Entrega", concluida: false }
    ],
    fotos: [
      "img/obra1.jpg"
    ]
  }
};

const form = document.getElementById('formAcompanhar');
const msgErro = document.getElementById('msgErro');
const resultado = document.getElementById('resultadoObra');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const codigo = document.getElementById('codigoObra').value.trim().toUpperCase();

  if (!obras[codigo]) {
    msgErro.textContent = 'Código não encontrado. Verifique com a construtora.';
    resultado.style.display = 'none';
    return;
  }

  msgErro.textContent = '';
  const obra = obras[codigo];

  document.getElementById('nomeObra').textContent = obra.nome;
  document.getElementById('enderecoObra').textContent = obra.endereco;
  document.getElementById('progressoPreenchido').style.width = obra.percentual + '%';
  document.getElementById('percentualObra').textContent = obra.percentual + '% concluído';

  // Etapas
  const lista = document.getElementById('listaEtapas');
  lista.innerHTML = '';
  obra.etapas.forEach(etapa => {
    const li = document.createElement('li');
    li.textContent = etapa.nome;
    li.className = etapa.concluida ? 'etapa concluida' : 'etapa pendente';
    lista.appendChild(li);
  });

  // Fotos
  const galeria = document.getElementById('galeriaObra');
  galeria.innerHTML = '';
  obra.fotos.forEach(foto => {
    const img = document.createElement('img');
    img.src = foto;
    img.alt = 'Foto da obra';
    galeria.appendChild(img);
  });

  resultado.style.display = 'block';
});
