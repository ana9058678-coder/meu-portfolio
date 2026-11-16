
const SUPABASE_URL = 'https://uemjeljauyvnrgqzhwsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UFYkjpwlsFUpINprYjez6g_P052sK70';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const formLogin = document.getElementById('formLogin');
const mensagemLogin = document.getElementById('mensagemLogin');
const botaoEntrar = document.getElementById('botaoEntrar');

function mostrarMensagem(texto, tipo) {
  mensagemLogin.textContent = texto;
  mensagemLogin.className = 'mensagem-login ' + tipo;
}

formLogin.addEventListener('submit', async function(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) {
    mostrarMensagem('Preencha o e-mail e a senha.', 'erro');
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.textContent = 'Verificando acesso...';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      mostrarMensagem('E-mail ou senha incorretos.', 'erro');
      return;
    }

    const { data: perfil, error: erroPerfil } = await supabaseClient
      .from('usuarios')
      .select('id, eh_admin')
      .eq('id', data.user.id)
      .maybeSingle();

    if (erroPerfil || !perfil || perfil.eh_admin !== true) {
      await supabaseClient.auth.signOut();

      mostrarMensagem(
        'Acesso não autorizado. Somente a administradora pode entrar.',
        'erro'
      );

      return;
    }

    mostrarMensagem('Acesso autorizado! Redirecionando...', 'sucesso');
    window.location.href = 'dashboard.html';

  } catch (erro) {
    console.error(erro);
    mostrarMensagem('Erro de conexão. Tente novamente.', 'erro');

  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = 'Entrar no painel';
  }
});
