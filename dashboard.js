
const supabaseClient = window.supabaseClient;

const formProjeto = document.getElementById('formProjeto');
const listaProjetos = document.getElementById('listaProjetos');
const mensagemPainel = document.getElementById('mensagemPainel');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const botaoSair = document.getElementById('botaoSair');

let usuarioAtual = null;

function mostrarMensagem(texto, tipo = '') {
  mensagemPainel.textContent = texto;
  mensagemPainel.style.color = tipo === 'erro' ? '#c62828' : '#287a43';
}

function escaparHTML(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[caractere]);
}

function linkSeguro(link) {
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

async function verificarAcesso() {
  if (!supabaseClient) {
    alert('A conexão com o Supabase não foi inicializada.');
    window.location.href = 'login.html';
    return false;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'login.html';
    return false;
  }

  usuarioAtual = data.session.user;

  const { data: perfil, error: erroPerfil } = await supabaseClient
    .from('usuarios')
    .select('id, nome, email, eh_admin')
    .eq('id', usuarioAtual.id)
    .maybeSingle();

  if (erroPerfil || !perfil || perfil.eh_admin !== true) {
    await supabaseClient.auth.signOut();
    alert('Acesso permitido somente à administradora.');
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

async function carregarProjetos() {
  listaProjetos.textContent = 'Carregando projetos...';

  const { data, error } = await supabaseClient
    .from('projetos')
    .select('id, nome, descricao, link, foto, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    listaProjetos.textContent = 'Não foi possível carregar os projetos.';
    return;
  }

  if (!data || data.length === 0) {
    listaProjetos.textContent = 'Nenhum projeto cadastrado ainda.';
    return;
  }

  listaProjetos.innerHTML = data.map(projeto => {
    let imagem = '';

    if (projeto.foto) {
      const fotoUrl = projeto.foto.startsWith('http')
        ? linkSeguro(projeto.foto)
        : supabaseClient.storage
            .from('portfolio-imagens')
            .getPublicUrl(projeto.foto).data.publicUrl;

      if (fotoUrl) {
        imagem = `<img src="${escaparHTML(fotoUrl)}"
          alt="Imagem do projeto ${escaparHTML(projeto.nome)}"
          style="width:100%;max-width:220px;border-radius:10px;">`;
      }
    }

    const link = projeto.link ? linkSeguro(projeto.link) : '';

    return `
      <article class="projeto-admin">
        ${imagem}
        <h3>${escaparHTML(projeto.nome)}</h3>
        <p>${escaparHTML(projeto.descricao)}</p>
        ${link
          ? `<p><a href="${escaparHTML(link)}" target="_blank" rel="noopener noreferrer">Abrir projeto</a></p>`
          : ''}
        <small>ID: ${escaparHTML(projeto.id)}</small>
      </article>
    `;
  }).join('');
}

formProjeto.addEventListener('submit', async function(event) {
  event.preventDefault();

  if (!usuarioAtual) {
    mostrarMensagem('Faça login novamente.', 'erro');
    return;
  }

  const nome = document.getElementById('nomeProjeto').value.trim();
  const descricao = document.getElementById('descricaoProjeto').value.trim();
  const linkDigitado = document.getElementById('linkProjeto').value.trim();
  const arquivo = document.getElementById('fotoProjeto').files[0];

  if (!nome || !descricao) {
    mostrarMensagem('Preencha o nome e a descrição.', 'erro');
    return;
  }

  const link = linkDigitado ? linkSeguro(linkDigitado) : null;

  if (linkDigitado && !link) {
    mostrarMensagem('Digite um link válido começando com https://.', 'erro');
    return;
  }

  if (arquivo) {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];

    if (!tiposPermitidos.includes(arquivo.type)) {
      mostrarMensagem('Escolha uma imagem JPG, PNG ou WebP.', 'erro');
      return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      mostrarMensagem('A imagem deve ter no máximo 5 MB.', 'erro');
      return;
    }
  }

  botaoCadastrar.disabled = true;
  botaoCadastrar.textContent = 'Salvando...';
  mostrarMensagem('');

  let caminhoFoto = null;

  try {
    if (arquivo) {
      const nomeArquivo = `${Date.now()}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      caminhoFoto = `${usuarioAtual.id}/${nomeArquivo}`;

      const { error: erroUpload } = await supabaseClient.storage
        .from('portfolio-imagens')
        .upload(caminhoFoto, arquivo, {
          cacheControl: '3600',
          upsert: false
        });

      if (erroUpload) throw erroUpload;
    }

    const { error } = await supabaseClient
      .from('projetos')
      .insert({
        nome,
        descricao,
        link,
        foto: caminhoFoto,
        usuario_id: usuarioAtual.id
      });

    if (error) throw error;

    mostrarMensagem('Projeto cadastrado com sucesso!');
    formProjeto.reset();
    await carregarProjetos();

  } catch (erro) {
    console.error('Erro ao cadastrar projeto:', erro);
    mostrarMensagem(
      'Não foi possível cadastrar. Confira as permissões do banco e do Storage.',
      'erro'
    );

  } finally {
    botaoCadastrar.disabled = false;
    botaoCadastrar.textContent = 'Cadastrar projeto';
  }
});

botaoSair.addEventListener('click', async function() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    mostrarMensagem('Não foi possível sair da conta.', 'erro');
    return;
  }

  window.location.href = 'login.html';
});

async function iniciarPainel() {
  const acessoPermitido = await verificarAcesso();

  if (acessoPermitido) {
    await carregarProjetos();
  }
}

iniciarPainel();
