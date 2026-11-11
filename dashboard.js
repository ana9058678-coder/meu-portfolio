
const SUPABASE_URL = 'https://uemjeljauyvnrgqzhwsg.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UFYkjpwlsFUpINprYjez6g_P052sK70';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const formProjeto = document.getElementById('formProjeto');
const mensagem = document.getElementById('mensagemDashboard');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const botaoSair = document.getElementById('botaoSair');

let usuarioAtual = null;

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem-dashboard ' + tipo;
}

// Verificar se existe uma sessão
async function verificarLogin() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'login.html';
    return false;
  }

  usuarioAtual = data.session.user;

  // Verificar se o usuário possui perfil cadastrado
  const { data: perfil, error: erroPerfil } = await supabaseClient
    .from('usuarios')
    .select('id')
    .eq('id', usuarioAtual.id)
    .maybeSingle();

  if (erroPerfil || !perfil) {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

// Cadastrar projeto
formProjeto.addEventListener('submit', async function(event) {
  event.preventDefault();

  if (!usuarioAtual) {
    mostrarMensagem('Faça login novamente.', 'erro');
    return;
  }

  const nome = document.getElementById('nome').value.trim();
  const descricao = document.getElementById('descricao').value.trim();
  const link = document.getElementById('link').value.trim();
  const arquivo = document.getElementById('foto').files[0];

  if (!nome || !descricao || !arquivo) {
    mostrarMensagem('Preencha os campos obrigatórios.', 'erro');
    return;
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
    mostrarMensagem('Escolha uma imagem JPG, PNG ou WebP.', 'erro');
    return;
  }

  if (arquivo.size > 5 * 1024 * 1024) {
    mostrarMensagem('A imagem deve ter no máximo 5 MB.', 'erro');
    return;
  }

  if (link) {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Link inválido');
      }
    } catch {
      mostrarMensagem('Digite um link válido começando com https://.', 'erro');
      return;
    }
  }

  botaoCadastrar.disabled = true;
  botaoCadastrar.textContent = 'Salvando projeto...';

  try {
    // Criar nome único para a imagem
    const extensao = arquivo.name.split('.').pop().toLowerCase();
    const nomeArquivo = `${usuarioAtual.id}/${Date.now()}.${extensao}`;

    // Enviar imagem para o Storage
    const { error: erroUpload } = await supabaseClient.storage
      .from('portfolio-imagens')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: false
      });

    if (erroUpload) {
      throw erroUpload;
    }

    // Obter endereço público da imagem
    const { data: imagemPublica } = supabaseClient.storage
      .from('portfolio-imagens')
      .getPublicUrl(nomeArquivo);

    // Salvar projeto na tabela projetos
    const { error: erroProjeto } = await supabaseClient
      .from('projetos')
      .insert({
        nome: nome,
        descricao: descricao,
        link: link || null,
        foto: imagemPublica.publicUrl,
        usuario_id: usuarioAtual.id
      });

    if (erroProjeto) {
      throw erroProjeto;
    }

    mostrarMensagem('Projeto cadastrado com sucesso!', 'sucesso');
    formProjeto.reset();

  } catch (erro) {
    console.error('Erro ao cadastrar projeto:', erro);
    mostrarMensagem(
      'Não foi possível cadastrar. Verifique as permissões do Supabase e tente novamente.',
      'erro'
    );

  } finally {
    botaoCadastrar.disabled = false;
    botaoCadastrar.textContent = 'Cadastrar projeto';
  }
});

// Sair da conta
botaoSair.addEventListener('click', async function() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    mostrarMensagem('Não foi possível sair da conta.', 'erro');
    return;
  }

  window.location.href = 'index.html';
});

// Iniciar verificação
verificarLogin();
