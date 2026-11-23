const supabaseClient = window.supabaseClient;

const formProjeto = document.getElementById('formProjeto');
const listaProjetos = document.getElementById('listaProjetos');
const mensagemPainel = document.getElementById('mensagemPainel');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const botaoSair = document.getElementById('botaoSair');

let usuarioAtual = null;
let projetoEditando = null;

// Mensagens do painel
function mostrarMensagem(texto, tipo = '') {
  mensagemPainel.textContent = texto;
  mensagemPainel.style.color =
    tipo === 'erro' ? '#c62828' : '#287a43';
}

// Evita que textos cadastrados sejam interpretados como HTML
function escaparHTML(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[caractere]);
}

// Validar links
function linkSeguro(link) {
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// Obter imagem pública
function obterImagem(foto) {
  if (!foto) return '';

  if (/^https?:\/\//i.test(foto)) {
    try {
      const url = new URL(foto);

      if (url.pathname.includes('/storage/v1/object/sign/')) {
        url.pathname = url.pathname.replace(
          '/object/sign/',
          '/object/public/'
        );
        url.search = '';
      }

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  return supabaseClient.storage
    .from('portfolio-imagens')
    .getPublicUrl(foto).data.publicUrl;
}

// Verificar se o usuário está logado e é administradora
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

// Botão para cancelar edição
function criarBotaoCancelar() {
  if (document.getElementById('botaoCancelarEdicao')) return;

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.id = 'botaoCancelarEdicao';
  botao.textContent = 'Cancelar edição';
  botao.style.background = '#999';
  botao.style.marginLeft = '10px';

  botao.addEventListener('click', cancelarEdicao);

  botaoCadastrar.parentElement.appendChild(botao);
}

// Cancelar edição
function cancelarEdicao() {
  projetoEditando = null;
  formProjeto.reset();

  botaoCadastrar.textContent = 'Cadastrar projeto';

  const botaoCancelar = document.getElementById('botaoCancelarEdicao');
  if (botaoCancelar) botaoCancelar.remove();

  mostrarMensagem('');
}

// Carregar projetos
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
    const imagemUrl = obterImagem(projeto.foto);
    const link = projeto.link ? linkSeguro(projeto.link) : '';

    return `
      <article class="projeto-admin">
        ${
          imagemUrl
            ? `<img src="${escaparHTML(imagemUrl)}"
                alt="Imagem do projeto ${escaparHTML(projeto.nome)}"
                style="width:100%;max-width:220px;border-radius:10px;"
                onerror="this.style.display='none'">`
            : ''
        }

        <h3>${escaparHTML(projeto.nome)}</h3>

        <p>${escaparHTML(projeto.descricao)}</p>

        ${
          link
            ? `<p><a href="${escaparHTML(link)}"
                target="_blank" rel="noopener noreferrer">
                Abrir projeto
              </a></p>`
            : ''
        }

        <small>ID: ${escaparHTML(projeto.id)}</small>

        <div style="display:flex;gap:10px;margin-top:15px;flex-wrap:wrap;">
          <button type="button"
            data-acao="editar"
            data-id="${escaparHTML(projeto.id)}"
            style="background:#7041a6;color:white;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;">
            Editar
          </button>

          <button type="button"
            data-acao="excluir"
            data-id="${escaparHTML(projeto.id)}"
            style="background:#c62828;color:white;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;">
            Excluir
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// Cadastrar ou atualizar projeto
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
  botaoCadastrar.textContent = projetoEditando
    ? 'Atualizando...'
    : 'Salvando...';

  mostrarMensagem('');

  try {
    let caminhoFoto = projetoEditando
      ? projetoEditando.foto
      : null;

    // Upload da nova foto, se foi escolhida
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

    const dadosProjeto = {
      nome,
      descricao,
      link,
      foto: caminhoFoto
    };

    // Se estiver editando
    if (projetoEditando) {
      const { error } = await supabaseClient
        .from('projetos')
        .update(dadosProjeto)
        .eq('id', projetoEditando.id);

      if (error) throw error;

      mostrarMensagem('Projeto atualizado com sucesso!');
    } else {
      // Se for novo cadastro
      const { error } = await supabaseClient
        .from('projetos')
        .insert({
          ...dadosProjeto,
          usuario_id: usuarioAtual.id
        });

      if (error) throw error;

      mostrarMensagem('Projeto cadastrado com sucesso!');
    }

    cancelarEdicao();
    await carregarProjetos();

  } catch (erro) {
    console.error('Erro ao salvar projeto:', erro);

    mostrarMensagem(
      'Não foi possível salvar o projeto. Confira as permissões do banco e do Storage.',
      'erro'
    );

  } finally {
    botaoCadastrar.disabled = false;
    botaoCadastrar.textContent = projetoEditando
      ? 'Atualizar projeto'
      : 'Cadastrar projeto';
  }
});

// Clique nos botões Editar e Excluir da lista
listaProjetos.addEventListener('click', async function(event) {
  const botao = event.target.closest('button[data-acao]');
  if (!botao) return;

  const acao = botao.dataset.acao;
  const id = botao.dataset.id;

  // EDITAR
  if (acao === 'editar') {
    const { data, error } = await supabaseClient
      .from('projetos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      mostrarMensagem('Não foi possível abrir o projeto para edição.', 'erro');
      return;
    }

    projetoEditando = data;

    document.getElementById('nomeProjeto').value = data.nome || '';
    document.getElementById('descricaoProjeto').value = data.descricao || '';
    document.getElementById('linkProjeto').value = data.link || '';
    document.getElementById('fotoProjeto').value = '';

    botaoCadastrar.textContent = 'Atualizar projeto';

    criarBotaoCancelar();

    mostrarMensagem('Editando projeto: ' + data.nome);

    formProjeto.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  // EXCLUIR
  if (acao === 'excluir') {
    const confirmar = confirm(
      'Tem certeza que deseja excluir este projeto? Essa ação não pode ser desfeita.'
    );

    if (!confirmar) return;

    const { error } = await supabaseClient
      .from('projetos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);
      mostrarMensagem('Não foi possível excluir o projeto.', 'erro');
      return;
    }

    if (projetoEditando && String(projetoEditando.id) === String(id)) {
      cancelarEdicao();
    }

    mostrarMensagem('Projeto excluído com sucesso!');
    await carregarProjetos();
  }
});

// Sair do painel
botaoSair.addEventListener('click', async function() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    mostrarMensagem('Não foi possível sair da conta.', 'erro');
    return;
  }

  window.location.href = 'login.html';
});

// Iniciar painel
async function iniciarPainel() {
  const acessoPermitido = await verificarAcesso();

  if (acessoPermitido) {
    await carregarProjetos();
  }
}

iniciarPainel();
