
const SUPABASE_URL = 'https://uemjeljauyvnrgqzhwsg.supabase.co';

const SUPABASE_KEY = 'sb_publishable_UFYkjpwlsFUpINprYjez6g_P052sK70';

// Verifica se a biblioteca foi carregada
if (!window.supabase) {
    console.error("Biblioteca do Supabase não carregada.");
} else {
    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log("Supabase inicializado!");

    // Testa a comunicação com o banco
    supabaseClient
        .from("projetos")
        .select("id")
        .limit(1)
        .then(({ data, error }) => {
            if (error) {
                console.error("Erro ao consultar projetos:", error.message);
            } else {
                console.log("Conexão com o Supabase funcionando!");
            }
        });
}
