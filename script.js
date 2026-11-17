
// Conexão de teste com o Supabase

const SUPABASE_URL = 'https://uemjeljauyvnrgqzhwsg.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UFYkjpwlsFUpINprYjez6g_P052sK70';

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Conexão com Supabase inicializada!");
