"use strict";
// Esta configuração é pública: use apenas a chave sb_publishable_.
// Cole abaixo a Project URL copiada do Supabase > Connect.
window.PORTFOLIO_CONFIG = Object.freeze({
  supabaseUrl: "https://sjwckxawbcqwsjumcyka.supabase.co",
  supabaseKey: "sb_publishable_z1UhgsItiR1P88OvdcDE5A_Wfk9s979"
});

const config = window.PORTFOLIO_CONFIG || {};
const form = document.querySelector("#form-contato");
const estadoForm = document.querySelector("#estado-form");
const estadoProjetos = document.querySelector("#estado-projetos");
const lista = document.querySelector("#lista-projetos");
const enviar = document.querySelector("#enviar");
const recarregar = document.querySelector("#recarregar");
document.querySelector("#ano").textContent = new Date().getFullYear();

function obterUrl() {
  let url;
  try { url = new URL(config.supabaseUrl); } catch {
    throw new Error("Falta configurar a URL do Supabase no arquivo script.js.");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password) {
    throw new Error("Use a Project URL HTTPS do Supabase no arquivo script.js.");
  }
  if (!config.supabaseKey?.startsWith("sb_publishable_")) {
    throw new Error("Configure uma chave pública sb_publishable_ no arquivo script.js.");
  }
  return url.origin;
}

async function requisicao(caminho, opcoes = {}) {
  const base = obterUrl();
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 15000);
  try {
    const resposta = await fetch(`${base}/rest/v1/${caminho}`, {
      ...opcoes,
      headers: { apikey: config.supabaseKey, ...opcoes.headers },
      signal: controle.signal
    });
    if (!resposta.ok) {
      const detalhe = await resposta.json().catch(() => ({}));
      console.error("Supabase:", resposta.status, detalhe.code);
      if ([401,403].includes(resposta.status)) throw new Error("Acesso recusado. Confira a chave pública e as permissões/RLS no Supabase.");
      if (resposta.status === 404 || detalhe.code === "PGRST205") throw new Error("Tabela não encontrada. Confira se o SQL foi executado no mesmo projeto.");
      if (detalhe.code === "23514") throw new Error("Confira o tamanho dos campos: nome com 2 caracteres e mensagem com 10 ou mais.");
      throw new Error(`O Supabase recusou a operação (HTTP ${resposta.status}). Confira as tabelas e permissões.`);
    }
    return resposta;
  } catch (erro) {
    if (erro.name === "AbortError") throw new Error("O servidor demorou a responder. Confira no Supabase se a mensagem chegou antes de reenviar.");
    if (erro instanceof TypeError) throw new Error("Falha de conexão. Confira sua internet e a URL do Supabase. Antes de reenviar, confira se a mensagem chegou.");
    throw erro;
  } finally { clearTimeout(limite); }
}

function linkSeguro(valor) {
  try { const url = new URL(valor); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

function montarCard(projeto) {
  const card = document.createElement("article"); card.className = "card";
  const imagemUrl = linkSeguro(projeto.imagem_url);
  if (imagemUrl) {
    const img = document.createElement("img"); img.src = imagemUrl;
    img.alt = `Imagem do projeto ${projeto.titulo}`; img.loading = "lazy";
    img.referrerPolicy = "no-referrer"; img.addEventListener("error", () => img.remove());
    card.append(img);
  }
  const conteudo = document.createElement("div"); conteudo.className = "conteudo";
  const titulo = document.createElement("h3"); titulo.textContent = projeto.titulo;
  const descricao = document.createElement("p"); descricao.textContent = projeto.descricao;
  const links = document.createElement("div"); links.className = "links";
  for (const [rotulo, valor] of [["Ver site ↗",projeto.site_url],["Código no GitHub ↗",projeto.github_url]]) {
    const url = linkSeguro(valor);
    if (url) { const a = document.createElement("a"); a.href = url; a.textContent = rotulo; a.target = "_blank"; a.rel = "noopener noreferrer"; links.append(a); }
  }
  conteudo.append(titulo, descricao, links); card.append(conteudo); return card;
}

async function carregarProjetos() {
  recarregar.disabled = true; estadoProjetos.className = "";
  estadoProjetos.textContent = "Carregando projetos…"; lista.replaceChildren();
  try {
    const resposta = await requisicao("projetos?select=id,titulo,descricao,imagem_url,github_url,site_url&order=criado_em.desc&limit=30");
    const projetos = await resposta.json();
    if (!Array.isArray(projetos)) throw new Error("O servidor retornou um formato inesperado.");
    estadoProjetos.textContent = projetos.length ? "" : "Ainda não há projetos cadastrados. Eles aparecerão aqui quando forem adicionados ao banco.";
    projetos.forEach(p => lista.append(montarCard(p)));
  } catch (erro) { estadoProjetos.textContent = erro.message; estadoProjetos.className = "erro"; }
  finally { recarregar.disabled = false; }
}

form.addEventListener("submit", async evento => {
  evento.preventDefault();
  if (enviar.disabled || !form.reportValidity()) return;
  const dados = new FormData(form);
  const lead = { nome: dados.get("nome").trim(), email: dados.get("email").trim(), mensagem: dados.get("mensagem").trim() };
  estadoForm.className = "";
  if (lead.nome.length < 2 || lead.mensagem.length < 10) {
    estadoForm.textContent = "Preencha um nome com pelo menos 2 caracteres e uma mensagem com pelo menos 10, sem contar espaços nas pontas.";
    estadoForm.className = "erro"; return;
  }
  enviar.disabled = true; enviar.textContent = "Enviando…"; estadoForm.textContent = "";
  try {
    await requisicao("lead", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(lead)
    });
    form.reset(); estadoForm.textContent = "Mensagem enviada! Obrigado pelo contato.";
    estadoForm.className = "sucesso";
  } catch (erro) { estadoForm.textContent = erro.message; estadoForm.className = "erro"; }
  finally { enviar.disabled = false; enviar.textContent = "Enviar mensagem ↗"; }
});
recarregar.addEventListener("click", carregarProjetos);
carregarProjetos();

// LOGIN E PAINEL: o Supabase Auth gerencia a sessão e renova os tokens.
// A autorização real continua nas políticas RLS das tabelas do banco.
const formLogin = document.querySelector("#form-login");
const painel = document.querySelector("#painel");
const estadoAcesso = document.querySelector("#estado-acesso");
const usuarioAtual = document.querySelector("#usuario-atual");
const entrar = document.querySelector("#entrar");
const sair = document.querySelector("#sair");
const formProjeto = document.querySelector("#form-projeto");
const camposProjeto = document.querySelector("#campos-projeto");
const salvarProjeto = document.querySelector("#salvar-projeto");
const estadoProjeto = document.querySelector("#estado-projeto");
const linkPainel = document.querySelector("#link-painel");
let clienteAuth;
let usuarioId = null;
let perfilPronto = false;
let geracaoAcesso = 0;
let salvandoProjeto = false;

function statusAcesso(texto, erro = false) {
  estadoAcesso.textContent = texto;
  estadoAcesso.className = erro ? "status erro" : "status";
}

function mensagemAuth(erro) {
  if (erro?.code === "invalid_credentials") return "E-mail ou senha incorretos. Confira os dados da conta criada em Authentication → Users.";
  if (erro?.code === "email_not_confirmed") return "O e-mail desta conta ainda não foi confirmado.";
  if (erro?.code === "over_request_rate_limit" || erro?.status === 429) return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  if (erro?.code === "23503") return "Seu perfil não foi encontrado em usuarios. Confira se o ID é o mesmo da conta em Authentication → Users.";
  if (erro?.code === "42501") return "O banco recusou a operação. Confira as políticas RLS de usuarios e projetos.";
  if (erro?.code === "23514") return "Confira os campos: título com 2 caracteres e descrição com pelo menos 10.";
  if (erro?.code === "PGRST205") return "A tabela não foi encontrada. Confira se usuarios e projetos existem neste projeto Supabase.";
  if (erro?.name === "AbortError" || /fetch|network|abort|timeout/i.test(erro?.message || "")) return "A conexão falhou ou demorou demais. Confira sua internet e tente novamente.";
  return "Não foi possível concluir. Confira a conexão e as configurações da conta no Supabase.";
}

// Timeout por requisição, sem repetir automaticamente operações de gravação.
async function fetchAuth(url, opcoes = {}) {
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  if (opcoes.signal?.aborted) controle.abort();
  opcoes.signal?.addEventListener("abort", cancelar, { once: true });
  const limite = setTimeout(cancelar, 15000);
  try { return await fetch(url, { ...opcoes, signal: controle.signal }); }
  finally { clearTimeout(limite); opcoes.signal?.removeEventListener("abort", cancelar); }
}

async function carregarPerfil(id, geracao) {
  try {
    const { data, error } = await clienteAuth.from("usuarios").select("id,nome").eq("id", id).maybeSingle();
    if (geracao !== geracaoAcesso || usuarioId !== id) return;
    if (error) throw error;
    if (!data) {
      statusAcesso("Conta conectada, mas falta o perfil em usuarios. Cadastre seu nome usando o mesmo User ID da conta no Supabase.", true);
      return;
    }
    perfilPronto = true;
    usuarioAtual.textContent = `Olá, ${data.nome}!`;
    camposProjeto.disabled = salvandoProjeto;
    statusAcesso("Você está conectado. Cadastre seu próximo projeto abaixo.");
  } catch (erro) {
    if (geracao === geracaoAcesso) statusAcesso(mensagemAuth(erro) + " Atualize a página para tentar carregar seu perfil novamente.", true);
  }
}

function atualizarSessao(sessao) {
  const novoId = sessao?.user?.id || null;
  // Eventos de renovação não apagam o formulário que está sendo preenchido.
  if (novoId && novoId === usuarioId) return;
  usuarioId = novoId;
  const geracao = ++geracaoAcesso;
  perfilPronto = false;
  camposProjeto.disabled = true;
  formProjeto.reset();
  estadoProjeto.textContent = "";
  formLogin.hidden = Boolean(novoId);
  painel.hidden = !novoId;
  linkPainel.textContent = novoId ? "Meu painel" : "Entrar";
  entrar.disabled = false;
  if (novoId) {
    usuarioAtual.textContent = sessao.user.email || "Conta conectada";
    statusAcesso("Carregando seu perfil…");
    // Fora do callback do Auth para evitar bloqueios entre operações do SDK.
    setTimeout(() => carregarPerfil(novoId, geracao), 0);
  } else {
    usuarioAtual.textContent = "";
    statusAcesso("Entre para publicar seus projetos.");
  }
}

document.querySelector("#mostrar-senha").addEventListener("click", evento => {
  const campo = document.querySelector("#login-senha");
  const mostrar = campo.type === "password";
  campo.type = mostrar ? "text" : "password";
  evento.currentTarget.textContent = mostrar ? "Ocultar" : "Mostrar";
  evento.currentTarget.setAttribute("aria-pressed", String(mostrar));
});

formLogin.addEventListener("submit", async evento => {
  evento.preventDefault();
  if (!clienteAuth || entrar.disabled || !formLogin.reportValidity()) return;
  entrar.disabled = true;
  entrar.textContent = "Entrando…";
  statusAcesso("Verificando sua conta…");
  try {
    const { data, error } = await clienteAuth.auth.signInWithPassword({
      email: document.querySelector("#login-email").value.trim(),
      password: document.querySelector("#login-senha").value
    });
    if (error) throw error;
    if (!data.session) throw new Error("Sessão não recebida");
    atualizarSessao(data.session);
    document.querySelector("#login-senha").value = "";
    document.querySelector("#projeto-titulo").focus();
  } catch (erro) { statusAcesso(mensagemAuth(erro), true); }
  finally { entrar.disabled = false; entrar.textContent = "Entrar no painel"; }
});

sair.addEventListener("click", async () => {
  if (!clienteAuth || sair.disabled || salvandoProjeto) return;
  sair.disabled = true;
  try {
    const { error } = await clienteAuth.auth.signOut({ scope: "local" });
    if (error) throw error;
    atualizarSessao(null);
    formLogin.reset();
    statusAcesso("Você saiu da conta.");
    document.querySelector("#login-email").focus();
  } catch (erro) { statusAcesso(mensagemAuth(erro), true); }
  finally { sair.disabled = false; }
});

formProjeto.addEventListener("submit", async evento => {
  evento.preventDefault();
  if (!clienteAuth || !usuarioId || !perfilPronto || salvandoProjeto || !formProjeto.reportValidity()) return;
  const dados = new FormData(formProjeto);
  const projeto = {
    titulo: dados.get("titulo").trim(), descricao: dados.get("descricao").trim(),
    imagem_url: dados.get("imagem_url").trim() || null,
    github_url: dados.get("github_url").trim() || null,
    site_url: dados.get("site_url").trim() || null
  };
  estadoProjeto.className = "status erro";
  if (projeto.titulo.length < 2 || projeto.descricao.length < 10) {
    estadoProjeto.textContent = "Use pelo menos 2 caracteres no título e 10 na descrição, sem contar espaços nas pontas."; return;
  }
  for (const campo of ["imagem_url", "github_url", "site_url"]) {
    if (projeto[campo] && !linkSeguro(projeto[campo])) {
      estadoProjeto.textContent = "Os links precisam começar com https://. Você também pode deixar os links opcionais vazios."; return;
    }
  }
  salvandoProjeto = true; camposProjeto.disabled = true; sair.disabled = true;
  salvarProjeto.textContent = "Publicando…"; estadoProjeto.textContent = "";
  const idDaOperacao = usuarioId;
  try {
    const { data: conta, error: erroConta } = await clienteAuth.auth.getUser();
    if (erroConta || !conta.user || conta.user.id !== idDaOperacao) {
      throw { message: "Sua sessão mudou ou expirou. Saia e entre novamente.", sessaoExpirada: true };
    }
    // O ID vem da conta autenticada; o banco confirma a propriedade com RLS.
    const { error } = await clienteAuth.from("projetos").insert({ ...projeto, usuario_id: conta.user.id });
    if (error) throw error;
    if (usuarioId === idDaOperacao) {
      formProjeto.reset();
      estadoProjeto.className = "status sucesso";
      estadoProjeto.textContent = "Projeto publicado! Ele já está disponível na seção Meus projetos.";
    }
    await carregarProjetos();
  } catch (erro) {
    if (usuarioId === idDaOperacao) {
      estadoProjeto.className = "status erro";
      estadoProjeto.textContent = erro.sessaoExpirada ? erro.message : mensagemAuth(erro);
      if (/fetch|network|abort|timeout/i.test(erro?.message || "")) estadoProjeto.textContent += " Antes de reenviar, atualize a lista para verificar se o projeto foi salvo.";
    }
  } finally {
    salvandoProjeto = false;
    camposProjeto.disabled = !usuarioId || !perfilPronto;
    sair.disabled = false; salvarProjeto.textContent = "Publicar projeto ↗";
  }
});

try {
  if (!window.supabase?.createClient) throw new Error("A biblioteca de login não carregou. Confira sua internet e atualize a página. O formulário de contato continua disponível.");
  clienteAuth = window.supabase.createClient(obterUrl(), config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: fetchAuth }
  });
  clienteAuth.auth.onAuthStateChange((_evento, sessao) => atualizarSessao(sessao));
} catch (erro) { statusAcesso(erro.message, true); }
