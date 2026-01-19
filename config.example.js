/**
 * Configurações de API
 *
 * INSTRUÇÕES:
 * 1. Copie este arquivo para config.js
 * 2. Substitua os valores abaixo pelas suas credenciais
 * 3. O arquivo config.js é ignorado pelo git (não será commitado)
 */
const API_CONFIG = {
    // Token do TMDB (obrigatório)
    // Obtenha em: https://www.themoviedb.org/settings/api
    TMDB_TOKEN: 'seu-token-tmdb-aqui',

    // URL do banco Turso (obrigatório)
    // Obtenha com: turso db show <nome-db> --url
    // Troque libsql:// por https://
    TURSO_URL: 'https://seu-banco.turso.io',

    // Token do Turso (obrigatório)
    // Obtenha com: turso db tokens create <nome-db>
    TURSO_TOKEN: 'seu-token-turso-aqui'
};
