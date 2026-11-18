
/* =====================================
   CONFIGURAÇÃO DO SUPABASE
===================================== */

const SUPABASE_URL = 'https://uemjeljauyvnrgqzhwsg.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UFYkjpwlsFUpINprYjez6g_P052sK70';

/* =====================================
   CONEXÃO GLOBAL
===================================== */

if (!window.supabase) {
    console.error('A biblioteca do Supabase não foi carregada.');
} else {
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log('Supabase conectado ao portfólio.');
}
// Atualizado para gerar uma nova publicação na Vercel.
