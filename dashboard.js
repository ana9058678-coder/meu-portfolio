
const supabaseClient = window.supabaseClient;

const formProjeto = document.getElementById('formProjeto');
const listaProjetos = document.getElementById('listaProjetos');
const mensagemPainel = document.getElementById('mensagemPainel');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const botaoSair = document.getElementById('botaoSair');

let usuarioAtual = null;
let projetoEditando = null;
let usuarioEditando = null;

// ======================================
// MENSAGENS
// ======================================

function mostrarMensagem(texto, tipo = '') {
  mensagemPainel.textContent = texto;
  mensagemPainel.style.color =
    tipo === 'erro' ? '#c62828' : '#287a43';
}

function mostrarMensagemUsuario(texto, erro = false) {
  mensagemUsuario.textContent = texto;
  mensagemUsuario.style.color = erro ? '#c62828' : '#287a43';
}

// ======================================
// SEGURANÇA DE TEXTOS E LINKS
// ======================================

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

    return ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : '';
  } catch {
    return '';
  }
}

// ======================================
// IMAGENS DOS PROJETOS
// ======================================

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

// ======================================
// VERIFICAR ACESSO
// ======================================

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

// ======================================
// CANCELAR EDIÇÃO DE PROJETO
// ======================================

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

function cancelarEdicao(limparMensagem = true) {
  projetoEditando = null;
  formProjeto.reset();

  botaoCadastrar.textContent = 'Cadastrar projeto';

  const botaoCancelar = document.getElementById('botaoCancelarEdicao');

  if (botaoCancelar) {
    botaoCancelar.remove();
  }

  if (limparMensagem) {
    mostrarMensagem('');
  }
}

// ======================================
// CARREGAR PROJETOS
// ======================================

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
            ? `<p>
                <a href="${escaparHTML(link)}"
                   target="_blank"
                   rel="noopener noreferrer">
                  Abrir projeto
                </a>
              </p>`
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

// ======================================
// CADASTRAR OU EDITAR PROJETO
// ======================================

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

    if (arquivo) {
      const nomeArquivo =
        `${Date.now()}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

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

    if (projetoEditando) {
      const { error } = await supabaseClient
        .from('projetos')
        .update(dadosProjeto)
        .eq('id', projetoEditando.id);

      if (error) throw error;

      cancelarEdicao(false);
      mostrarMensagem('Projeto atualizado com sucesso!');

    } else {
      const { error } = await supabaseClient
        .from('projetos')
        .insert({
          ...dadosProjeto,
          usuario_id: usuarioAtual.id
        });

      if (error) throw error;

      formProjeto.reset();
      mostrarMensagem('Projeto cadastrado com sucesso!');
    }

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

// ======================================
// EDITAR E EXCLUIR PROJETOS
// ======================================

listaProjetos.addEventListener('click', async function(event) {
  const botao = event.target.closest('button[data-acao]');

  if (!botao) return;

  const acao = botao.dataset.acao;
  const id = botao.dataset.id;

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

// ======================================
// GERENCIAMENTO DE USUÁRIOS
// ======================================

// Criar a área de usuários
const secaoUsuarios = document.createElement('section');

secaoUsuarios.className = 'lista-painel';

secaoUsuarios.innerHTML = `
  <h2>Gerenciar usuários</h2>

  <div class="form-projeto">

    <h3 id="tituloFormularioUsuario">Cadastrar usuário</h3>

    <form id="formUsuario">

      <label for="nomeUsuario">Nome</label>
      <input type="text"
        id="nomeUsuario"
        required
        placeholder="Nome do usuário">

      <label for="emailUsuario">E-mail</label>
      <input type="email"
        id="emailUsuario"
        required
        placeholder="E-mail do usuário">

      <div id="campoSenhaUsuario">

        <label for="senhaUsuario">Senha</label>
        <input type="password"
          id="senhaUsuario"
          minlength="6"
          required
          placeholder="Mínimo de 6 caracteres">

      </div>

      <button type="submit"
        id="botaoSalvarUsuario"
        style="background:#7041a6;color:white;padding:13px 22px;border:0;border-radius:8px;cursor:pointer;">
        Cadastrar usuário
      </button>

      <button type="button"
        id="botaoCancelarUsuario"
        style="display:none;background:#999;color:white;padding:13px 22px;border:0;border-radius:8px;cursor:pointer;">
        Cancelar edição
      </button>

      <p id="mensagemUsuario" class="mensagem-painel"></p>

    </form>
  </div>

  <div class="lista-painel">

    <h3>Usuários cadastrados</h3>

    <div id="listaUsuarios">
      Carregando usuários...
    </div>

  </div>
`;

// Colocar a seção depois da lista de projetos
const secaoProjetos = listaProjetos.closest('.lista-painel');

if (secaoProjetos) {
  secaoProjetos.insertAdjacentElement('afterend', secaoUsuarios);
} else {
  document.querySelector('main').appendChild(secaoUsuarios);
}

// Elementos do formulário de usuários
const formUsuario = document.getElementById('formUsuario');
const listaUsuarios = document.getElementById('listaUsuarios');
const mensagemUsuario = document.getElementById('mensagemUsuario');

const botaoSalvarUsuario = document.getElementById('botaoSalvarUsuario');
const botaoCancelarUsuario = document.getElementById('botaoCancelarUsuario');
const campoSenhaUsuario = document.getElementById('campoSenhaUsuario');

// ======================================
// CHAMAR EDGE FUNCTION
// ======================================

async function chamarGerenciadorUsuarios(acao, dados = {}) {
  const { data, error } = await supabaseClient.functions.invoke(
    'gerenciar-usuarios',
    {
      body: {
        acao,
        ...dados
      }
    }
  );

  if (error) {
    console.error('Erro na Edge Function:', error);
    throw new Error(
      data?.erro || 'Não foi possível acessar o gerenciamento de usuários.'
    );
  }

  if (data?.erro) {
    throw new Error(data.erro);
  }

  return data;
}

// ======================================
// LISTAR USUÁRIOS
// ======================================

async function carregarUsuarios() {
  listaUsuarios.textContent = 'Carregando usuários...';

  try {
    const resultado = await chamarGerenciadorUsuarios('listar');
    const usuarios = resultado.usuarios || [];

    if (usuarios.length === 0) {
      listaUsuarios.textContent = 'Nenhum usuário cadastrado.';
      return;
    }

    listaUsuarios.innerHTML = usuarios.map(usuario => {
      const ehMinhaConta = usuario.id === usuarioAtual.id;

      return `
        <article class="projeto-admin">

          <h3>${escaparHTML(usuario.nome)}</h3>

          <p>E-mail: ${escaparHTML(usuario.email)}</p>

          <p>
            Tipo de conta:
            ${usuario.eh_admin ? 'Administradora' : 'Usuário'}
          </p>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:15px;">

            <button type="button"
              data-usuario-acao="editar"
              data-id="${escaparHTML(usuario.id)}"
              style="background:#7041a6;color:white;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;">
              Editar
            </button>

            <button type="button"
              data-usuario-acao="excluir"
              data-id="${escaparHTML(usuario.id)}"
              ${ehMinhaConta ? 'disabled' : ''}
              style="background:#c62828;color:white;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;${ehMinhaConta ? 'opacity:.5;' : ''}">
              ${ehMinhaConta ? 'Sua conta' : 'Excluir'}
            </button>

          </div>

        </article>
      `;
    }).join('');

  } catch (erro) {
    console.error('Erro ao carregar usuários:', erro);

    listaUsuarios.textContent =
      'Não foi possível carregar os usuários: ' + erro.message;
  }
}

// ======================================
// CANCELAR EDIÇÃO DE USUÁRIO
// ======================================

function cancelarEdicaoUsuario(limparMensagem = true) {
  usuarioEditando = null;

  formUsuario.reset();

  document.getElementById('tituloFormularioUsuario').textContent =
    'Cadastrar usuário';

  botaoSalvarUsuario.textContent = 'Cadastrar usuário';

  botaoCancelarUsuario.style.display = 'none';
  campoSenhaUsuario.style.display = 'block';

  document.getElementById('senhaUsuario').required = true;

  if (limparMensagem) {
    mostrarMensagemUsuario('');
  }
}

// ======================================
// CADASTRAR OU EDITAR USUÁRIO
// ======================================

formUsuario.addEventListener('submit', async function(event) {
  event.preventDefault();

  const nome = document.getElementById('nomeUsuario').value.trim();
  const email = document.getElementById('emailUsuario').value.trim();
  const senha = document.getElementById('senhaUsuario').value;

  botaoSalvarUsuario.disabled = true;

  botaoSalvarUsuario.textContent = 'Salvando...';

  try {
    if (usuarioEditando) {
      await chamarGerenciadorUsuarios('editar', {
        id: usuarioEditando,
        nome,
        email
      });

      cancelarEdicaoUsuario(false);

      mostrarMensagemUsuario('Usuário atualizado com sucesso!');

    } else {
      await chamarGerenciadorUsuarios('criar', {
        nome,
        email,
        senha
      });

      formUsuario.reset();

      mostrarMensagemUsuario('Usuário cadastrado com sucesso!');
    }

    await carregarUsuarios();

  } catch (erro) {
    console.error('Erro ao salvar usuário:', erro);

    mostrarMensagemUsuario(erro.message, true);

  } finally {
    botaoSalvarUsuario.disabled = false;

    botaoSalvarUsuario.textContent = usuarioEditando
      ? 'Atualizar usuário'
      : 'Cadastrar usuário';
  }
});

// ======================================
// EDITAR E EXCLUIR USUÁRIOS
// ======================================

listaUsuarios.addEventListener('click', async function(event) {
  const botao = event.target.closest('button[data-usuario-acao]');

  if (!botao || botao.disabled) return;

  const acao = botao.dataset.usuarioAcao;
  const id = botao.dataset.id;

  if (acao === 'editar') {
    try {
      const resultado = await chamarGerenciadorUsuarios('listar');

      const usuario = resultado.usuarios.find(item => item.id === id);

      if (!usuario) {
        mostrarMensagemUsuario('Usuário não encontrado.', true);
        return;
      }

      usuarioEditando = id;

      document.getElementById('nomeUsuario').value = usuario.nome || '';
      document.getElementById('emailUsuario').value = usuario.email || '';

      document.getElementById('tituloFormularioUsuario').textContent =
        'Editar usuário';

      botaoSalvarUsuario.textContent = 'Atualizar usuário';

      botaoCancelarUsuario.style.display = 'inline-block';

      campoSenhaUsuario.style.display = 'none';

      document.getElementById('senhaUsuario').required = false;

      mostrarMensagemUsuario('Editando: ' + usuario.nome);

      formUsuario.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

    } catch (erro) {
      mostrarMensagemUsuario(erro.message, true);
    }
  }

  if (acao === 'excluir') {
    const confirmar = confirm(
      'Tem certeza que deseja excluir este usuário? Essa ação não pode ser desfeita.'
    );

    if (!confirmar) return;

    try {
      await chamarGerenciadorUsuarios('excluir', { id });

      mostrarMensagemUsuario('Usuário excluído com sucesso!');

      await carregarUsuarios();

    } catch (erro) {
      console.error('Erro ao excluir usuário:', erro);

      mostrarMensagemUsuario(erro.message, true);
    }
  }
});

// Botão cancelar edição
botaoCancelarUsuario.addEventListener('click', function() {
  cancelarEdicaoUsuario();
});

// ======================================
// SAIR DO PAINEL
// ======================================

botaoSair.addEventListener('click', async function() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    mostrarMensagem('Não foi possível sair da conta.', 'erro');
    return;
  }

  window.location.href = 'login.html';
});

// ======================================
// INICIAR PAINEL
// ======================================

async function iniciarPainel() {
  const acessoPermitido = await verificarAcesso();

  if (acessoPermitido) {
    await carregarProjetos();
    await carregarUsuarios();
  }
}

iniciarPainel();
