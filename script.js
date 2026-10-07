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
