/**
 * Roleta de Filmes - 16bit Edition
 * Uma experiência mágica e divertida para escolher filmes!
 */

// ============================================
// CONFIGURAÇÃO
// ============================================
// ============================================
// TRADUÇÃO DE GÊNEROS
// ============================================
const GENRES_PT = {
    'Action': 'Ação',
    'Adventure': 'Aventura',
    'Animation': 'Animação',
    'Biography': 'Biografia',
    'Comedy': 'Comédia',
    'Crime': 'Crime',
    'Documentary': 'Documentário',
    'Drama': 'Drama',
    'Family': 'Família',
    'Fantasy': 'Fantasia',
    'Film-Noir': 'Film Noir',
    'History': 'História',
    'Horror': 'Terror',
    'Music': 'Música',
    'Musical': 'Musical',
    'Mystery': 'Mistério',
    'Nacional': 'Nacional',
    'News': 'Notícias',
    'Romance': 'Romance',
    'Sci-Fi': 'Ficção Científica',
    'Short': 'Curta',
    'Sport': 'Esporte',
    'Thriller': 'Suspense',
    'TV Movie': 'Filme de TV',
    'War': 'Guerra',
    'Western': 'Faroeste'
};

function translateGenre(genre) {
    return GENRES_PT[genre] || genre;
}

const CONFIG = {
    TMDB_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmMTE5OTFiNjk5ZGIzYTk5NzhjOTVmYThkOGM5MWM0NiIsIm5iZiI6MTc0NTk1MDE0My45NzYsInN1YiI6IjY4MTExNWJmMjEzN2YzNGMyNGVhZDY4ZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.6yHJrMiDYHRrIlA9Fy9q5qikkGmjnVK23cBuYc-aJ-k',
    TMDB_IMG_BASE: 'https://image.tmdb.org/t/p/w500',
    MOVIES_PER_SPIN: 3,
    MAX_MOVIES_PER_SPIN: 9, // Limite máximo para não sobrecarregar a API
    HISTORY_CACHE_SIZE: 30, // Quantidade de filmes no cache circular
    ROULETTE_DURATION: 2000, // ms
    ROULETTE_FLASHES: 15,
    // Supabase
    SUPABASE_URL: 'https://cfoqjlqtrhdvjelqhgvq.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmb3FqbHF0cmhkdmplbHFoZ3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MjExMDYsImV4cCI6MjA4NDE5NzEwNn0.ix5s_gHMC7qjLmARPNbPrbbqHUFq2UbrWRfZCJej2Wc'
};

// ============================================
// OBTER QUANTIDADE DE FILMES
// ============================================
function getMoviesPerSpin() {
    const select = document.getElementById('movies-count');
    if (!select) return CONFIG.MOVIES_PER_SPIN;
    const value = parseInt(select.value, 10);
    return Math.min(value, CONFIG.MAX_MOVIES_PER_SPIN);
}

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
let movies = [];
let filteredMovies = [];
let selectedMovies = [];
let konamiProgress = 0;
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

// ============================================
// CACHE CIRCULAR DE HISTÓRICO (sessionStorage)
// ============================================
function getMovieHistory() {
    try {
        const stored = sessionStorage.getItem('movieHistory');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveMovieHistory(history) {
    try {
        sessionStorage.setItem('movieHistory', JSON.stringify(history));
    } catch {
        // sessionStorage cheio ou indisponível
    }
}

// ============================================
// SUPABASE API HELPERS
// ============================================
async function supabaseRequest(table, method = 'GET', body = null, query = '') {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}${query}`;
    const options = {
        method,
        headers: {
            'apikey': CONFIG.SUPABASE_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=minimal' : undefined
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (method === 'GET') return response.json();
    return response.ok;
}

// Cache local para evitar muitas requisições
let watchedCache = null;
let watchlistCache = null;

// ============================================
// WATCHED MOVIES (Supabase - global)
// ============================================
async function fetchWatchedMovies() {
    try {
        const data = await supabaseRequest('watched', 'GET', null, '?select=imdb_id');
        watchedCache = data.map(item => item.imdb_id);
        return watchedCache;
    } catch (error) {
        console.error('Error fetching watched:', error);
        return watchedCache || [];
    }
}

function getWatchedMovies() {
    return watchedCache || [];
}

async function toggleWatched(imdbId) {
    const watched = getWatchedMovies();
    const isCurrentlyWatched = watched.includes(imdbId);

    try {
        if (isCurrentlyWatched) {
            await supabaseRequest('watched', 'DELETE', null, `?imdb_id=eq.${imdbId}`);
            watchedCache = watched.filter(id => id !== imdbId);
            playSound('click');
        } else {
            await supabaseRequest('watched', 'POST', { imdb_id: imdbId });
            watchedCache = [...watched, imdbId];
            playSound('coin');
        }
    } catch (error) {
        console.error('Error toggling watched:', error);
    }

    return !isCurrentlyWatched;
}

function isWatched(imdbId) {
    return getWatchedMovies().includes(imdbId);
}

// ============================================
// WATCHLIST (Supabase - global)
// ============================================
async function fetchWatchlist() {
    try {
        const data = await supabaseRequest('watchlist', 'GET', null, '?select=imdb_id');
        watchlistCache = data.map(item => item.imdb_id);
        return watchlistCache;
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        return watchlistCache || [];
    }
}

function getWatchlist() {
    return watchlistCache || [];
}

async function toggleWatchlist(imdbId) {
    console.log('toggleWatchlist called with:', imdbId);

    if (!imdbId) {
        console.error('imdbId is undefined or null!');
        return false;
    }

    const watchlist = getWatchlist();
    const isCurrentlyInList = watchlist.includes(imdbId);

    try {
        if (isCurrentlyInList) {
            await supabaseRequest('watchlist', 'DELETE', null, `?imdb_id=eq.${imdbId}`);
            watchlistCache = watchlist.filter(id => id !== imdbId);
            playSound('click');
        } else {
            await supabaseRequest('watchlist', 'POST', { imdb_id: imdbId });
            watchlistCache = [...watchlist, imdbId];
            playSound('powerup');
        }
        console.log('Watchlist updated:', watchlistCache);
    } catch (error) {
        console.error('Error toggling watchlist:', error);
    }

    return !isCurrentlyInList;
}

function isInWatchlist(imdbId) {
    return getWatchlist().includes(imdbId);
}

// ============================================
// CRIAR BOTÕES DE AÇÃO
// ============================================
function createActionButtons(imdbId) {
    const watchedActive = isWatched(imdbId) ? 'active' : '';
    const watchlistActive = isInWatchlist(imdbId) ? 'active' : '';

    return `
        <div class="movie-actions">
            <button class="action-btn watched ${watchedActive}" onclick="handleWatchedClick(event, '${imdbId}')">
                <span class="icon">${isWatched(imdbId) ? '✓' : '👁'}</span>
                <span>${isWatched(imdbId) ? 'VISTO' : 'JÁ VI'}</span>
            </button>
            <button class="action-btn watchlist ${watchlistActive}" onclick="handleWatchlistClick(event, '${imdbId}')">
                <span class="icon">${isInWatchlist(imdbId) ? '★' : '☆'}</span>
                <span>${isInWatchlist(imdbId) ? 'NA LISTA' : 'QUERO VER'}</span>
            </button>
        </div>
    `;
}

// ============================================
// EFEITOS DE GAME OVER BASEADOS NA NOTA
// ============================================
function getGameOverEffect(rating) {
    // Nota < 4: Efeitos pesados (imagem acinzentada + overlay)
    if (rating < 4) {
        const heavyEffects = [
            'effect-wasted',
            'effect-skull',
            'effect-rip',
            'effect-glitch',
            'effect-bomb',
            'effect-wanted',
            'effect-tomato',
            'effect-ghost'
        ];
        return heavyEffects[Math.floor(Math.random() * heavyEffects.length)];
    }

    // Nota 4-5: Efeitos leves (só um emoji no canto)
    if (rating < 5) {
        const lightEffects = [
            'effect-meh',
            'effect-sleepy',
            'effect-clown',
            'effect-trash',
            'effect-warning'
        ];
        return lightEffects[Math.floor(Math.random() * lightEffects.length)];
    }

    return ''; // Nota >= 5: sem efeito
}

async function handleWatchedClick(event, imdbId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    btn.disabled = true;

    const added = await toggleWatched(imdbId);

    btn.classList.toggle('active', added);
    btn.querySelector('.icon').textContent = added ? '✓' : '👁';
    btn.querySelector('span:last-child').textContent = added ? 'VISTO' : 'JÁ VI';
    btn.disabled = false;

    updateListCounts();

    if (added) {
        showPowerUp('WATCHED!');
    }
}

async function handleWatchlistClick(event, imdbId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    btn.disabled = true;

    const added = await toggleWatchlist(imdbId);

    btn.classList.toggle('active', added);
    btn.querySelector('.icon').textContent = added ? '★' : '☆';
    btn.querySelector('span:last-child').textContent = added ? 'NA LISTA' : 'QUERO VER';
    btn.disabled = false;

    updateWatchlistCount();

    if (added) {
        showPowerUp('+1 WATCHLIST!');
    }
}

// ============================================
// VISUALIZAÇÃO DAS LISTAS (QUERO VER / JÁ VI)
// ============================================
let currentListView = null; // 'watchlist' ou 'watched'

function updateListCounts() {
    // Atualizar contador de Quero Ver
    const watchlistCount = getWatchlist().length;
    const watchlistCountEl = document.getElementById('watchlist-count');
    if (watchlistCountEl) {
        watchlistCountEl.textContent = watchlistCount;
        watchlistCountEl.style.display = watchlistCount > 0 ? 'inline' : 'none';
    }

    // Atualizar contador de Já Vi
    const watchedCount = getWatchedMovies().length;
    const watchedCountEl = document.getElementById('watched-count');
    if (watchedCountEl) {
        watchedCountEl.textContent = watchedCount;
        watchedCountEl.style.display = watchedCount > 0 ? 'inline' : 'none';
    }

    // Atualizar contadores da navbar
    updateNavbarCounts();
}

// Alias para manter compatibilidade
function updateWatchlistCount() {
    updateListCounts();
}

function toggleListView(type) {
    const listSection = document.getElementById('list-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-container, #results');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const watchedBtn = document.getElementById('watched-btn');

    // Se já está mostrando a mesma lista, fecha
    if (currentListView === type) {
        closeListView();
        return;
    }

    // Atualizar estado
    currentListView = type;

    // Atualizar título
    const titleEl = document.getElementById('list-title');
    if (titleEl) {
        titleEl.textContent = type === 'watchlist' ? 'Quero Ver' : 'Já Vi';
    }

    // Mostrar seção de lista
    listSection.classList.remove('hidden');
    mainContent.forEach(el => el.classList.add('hidden'));

    // Atualizar botões ativos
    watchlistBtn.classList.toggle('active', type === 'watchlist');
    watchedBtn.classList.toggle('active', type === 'watched');

    // Exibir lista
    displayList(type);
    playSound('click');
}

function closeListView() {
    currentListView = null;

    const listSection = document.getElementById('list-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-container, #results');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const watchedBtn = document.getElementById('watched-btn');

    // Esconder lista
    listSection.classList.add('hidden');

    // Mostrar conteúdo principal
    mainContent.forEach(el => {
        if (!el.id || el.id !== 'results' || selectedMovies.length > 0) {
            el.classList.remove('hidden');
        }
    });

    // Esconder resultados se não tiver filmes selecionados
    if (selectedMovies.length === 0) {
        document.getElementById('results').classList.add('hidden');
    }

    // Remover estado ativo dos botões
    watchlistBtn.classList.remove('active');
    watchedBtn.classList.remove('active');

    playSound('click');
}

async function displayList(type) {
    const grid = document.getElementById('list-grid');
    const emptyMsg = document.getElementById('list-empty');

    // Obter IDs da lista correta
    const listIds = type === 'watchlist' ? getWatchlist() : getWatchedMovies();

    console.log(`${type} IDs:`, listIds);
    console.log('Total movies loaded:', movies.length);

    if (listIds.length === 0) {
        grid.innerHTML = '';
        emptyMsg.textContent = type === 'watchlist'
            ? 'Sua lista de filmes para assistir está vazia!'
            : 'Você ainda não marcou nenhum filme como visto!';
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');
    grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text"></div></div>';

    // Buscar filmes da lista e ordenar por nota (maior para menor)
    const listMovies = movies
        .filter(m => listIds.includes(m.imdb_id))
        .sort((a, b) => b.imdb_score - a.imdb_score);
    console.log(`${type} movies found:`, listMovies.length);

    // Se não encontrou filmes mas a lista não está vazia
    if (listMovies.length === 0) {
        grid.innerHTML = '';
        emptyMsg.textContent = 'Não foi possível carregar os filmes da lista.';
        emptyMsg.classList.remove('hidden');
        return;
    }

    const cards = await Promise.all(listMovies.map(async (movie) => {
        const details = await fetchMovieDetails(movie.imdb_id);

        const posterUrl = details?.poster_path
            ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
            : null;

        // Botões diferentes para cada tipo de lista
        const actionButtons = type === 'watchlist' ? `
            <button class="action-btn watched ${isWatched(movie.imdb_id) ? 'active' : ''}"
                    onclick="event.stopPropagation(); handleWatchedClick(event, '${movie.imdb_id}')">
                <span class="icon">${isWatched(movie.imdb_id) ? '✓' : '👁'}</span>
                <span>${isWatched(movie.imdb_id) ? 'VISTO' : 'JÁ VI'}</span>
            </button>
            <button class="action-btn remove" onclick="event.stopPropagation(); removeFromListView('${movie.imdb_id}', 'watchlist')">
                <span class="icon">✕</span>
                <span>REMOVER</span>
            </button>
        ` : `
            <button class="action-btn watchlist ${isInWatchlist(movie.imdb_id) ? 'active' : ''}"
                    onclick="event.stopPropagation(); handleWatchlistClick(event, '${movie.imdb_id}')">
                <span class="icon">${isInWatchlist(movie.imdb_id) ? '★' : '☆'}</span>
                <span>${isInWatchlist(movie.imdb_id) ? 'NA LISTA' : 'QUERO VER'}</span>
            </button>
            <button class="action-btn remove" onclick="event.stopPropagation(); removeFromListView('${movie.imdb_id}', 'watched')">
                <span class="icon">✕</span>
                <span>REMOVER</span>
            </button>
        `;

        return `
            <div class="list-card" data-imdb="${movie.imdb_id}" onclick="openModalByImdbId('${movie.imdb_id}')">
                <div class="list-poster-wrapper">
                    ${posterUrl
                        ? `<img class="list-poster" src="${posterUrl}" alt="${movie.title_pt}" loading="lazy">`
                        : `<div class="no-poster list-poster"></div>`
                    }
                </div>
                <div class="list-info">
                    <h3 class="list-title">${movie.title_pt}</h3>
                    <div class="list-meta">
                        <span>${movie.year}</span>
                        <span class="movie-rating">★ ${movie.imdb_score}</span>
                    </div>
                    <div class="list-actions">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    }));

    grid.innerHTML = cards.join('');
}

async function removeFromListView(imdbId, type) {
    if (type === 'watchlist') {
        await toggleWatchlist(imdbId);
    } else {
        await toggleWatched(imdbId);
    }
    updateListCounts();

    // Remover card com animação
    const card = document.querySelector(`[data-imdb="${imdbId}"]`);
    if (card) {
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => {
            card.remove();
            // Verificar se lista ficou vazia
            const listIds = type === 'watchlist' ? getWatchlist() : getWatchedMovies();
            if (listIds.length === 0) {
                const emptyMsg = document.getElementById('list-empty');
                emptyMsg.textContent = type === 'watchlist'
                    ? 'Sua lista de filmes para assistir está vazia!'
                    : 'Você ainda não marcou nenhum filme como visto!';
                emptyMsg.classList.remove('hidden');
            }
        }, 200);
    }

    showPowerUp('REMOVIDO!');
}

function addToHistory(moviesArr) {
    const history = getMovieHistory();

    moviesArr.forEach(movie => {
        if (movie.imdb_id && !history.includes(movie.imdb_id)) {
            history.push(movie.imdb_id);
        }
    });

    // Remove os mais antigos se passar do limite (cache circular)
    while (history.length > CONFIG.HISTORY_CACHE_SIZE) {
        history.shift();
    }

    saveMovieHistory(history);
}

// ============================================
// SONS 8-BIT (Web Audio API)
// ============================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Nintendo-style sounds (more melodic and cheerful)
    const sounds = {
        spin: { freq: [440, 554, 659, 880], duration: 0.08, type: 'square' },      // Coin spin
        reveal: { freq: [523, 659, 784, 1047], duration: 0.12, type: 'square' },   // Power-up!
        click: { freq: [987, 1318], duration: 0.04, type: 'square' },              // Menu select
        powerup: { freq: [523, 659, 784, 1047, 1318], duration: 0.08, type: 'square' }, // 1-UP!
        gameover: { freq: [392, 349, 330, 294, 262], duration: 0.15, type: 'triangle' }, // Sad trombone
        secret: { freq: [659, 784, 880, 987, 1047, 1175, 1318, 1568], duration: 0.06, type: 'square' }, // Zelda secret
        coin: { freq: [988, 1319], duration: 0.08, type: 'square' }                // Coin!
    };

    const sound = sounds[type] || sounds.click;
    oscillator.type = sound.type;

    let time = audioCtx.currentTime;
    sound.freq.forEach((freq, i) => {
        oscillator.frequency.setValueAtTime(freq, time + i * sound.duration);
    });

    gainNode.gain.setValueAtTime(0.12, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + sound.freq.length * sound.duration);

    oscillator.start(time);
    oscillator.stop(time + sound.freq.length * sound.duration);
}

// ============================================
// CONFETTI / PARTÍCULAS
// ============================================
function createConfetti() {
    const colors = ['#00fff5', '#ff00ff', '#ffff00', '#00ff00', '#ff0040'];
    const container = document.querySelector('.container');

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            position: fixed;
            width: ${Math.random() * 10 + 5}px;
            height: ${Math.random() * 10 + 5}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -20px;
            z-index: 9999;
            pointer-events: none;
            animation: confetti-fall ${Math.random() * 2 + 2}s linear forwards;
            box-shadow: 0 0 10px currentColor;
        `;
        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 4000);
    }
}

// Adicionar keyframe de confetti
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px) rotate(-1deg); }
        75% { transform: translateX(10px) rotate(1deg); }
    }

    .shake {
        animation: shake 0.5s ease-in-out;
    }

    .power-up-text {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 2rem;
        color: #ffd700;
        text-shadow:
            4px 4px 0 #e53935,
            -2px -2px 0 #4caf50,
            0 0 30px #ffd700;
        z-index: 10000;
        animation: power-up 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        pointer-events: none;
    }

    @keyframes power-up {
        0% { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.3) rotate(5deg); opacity: 1; }
        70% { transform: translate(-50%, -50%) scale(1.1) rotate(-3deg); }
        100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; }
    }

    /* Zelda-style Heart Bar */
    .heart-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0.5rem 0;
        flex-wrap: wrap;
    }

    .hearts {
        display: flex;
        gap: 0.15rem;
    }

    .heart {
        font-size: 1.3rem;
        transition: transform 0.2s ease;
    }

    .heart.full {
        color: #e53935;
        text-shadow:
            0 0 10px #e53935,
            2px 2px 0 #7f0000;
        animation: heart-pulse 1s ease-in-out infinite;
    }

    .heart.half {
        background: linear-gradient(90deg, #e53935 50%, #666 50%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .heart.empty {
        color: #666;
        opacity: 0.5;
    }

    @keyframes heart-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
    }

    .heart-label {
        font-size: 0.5rem;
        color: #ffd700;
        text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
    }

    .roulette-preview {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        padding: 1.5rem;
        border: 6px solid #ffd700;
        border-radius: 16px;
        z-index: 10000;
        text-align: center;
        font-family: 'Press Start 2P', monospace;
        box-shadow: 0 0 100px rgba(255, 215, 0, 0.5);
        width: 90vw;
        max-width: 400px;
        box-sizing: border-box;
    }

    .roulette-title {
        font-size: 0.7rem;
        color: #ffd700;
        margin-bottom: 1rem;
        animation: blink 0.5s steps(1) infinite;
    }

    @keyframes blink {
        50% { opacity: 0; }
    }

    .roulette-slot {
        font-size: 0.5rem;
        color: #00fff5;
        padding: 0.75rem;
        border: 3px solid #e53935;
        border-radius: 8px;
        margin: 0.4rem 0;
        background: #1a1a2e;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

    .secret-mode {
        filter: hue-rotate(180deg) saturate(1.5);
    }

    @keyframes rainbow-bg {
        0% { filter: hue-rotate(0deg) saturate(1.2); }
        100% { filter: hue-rotate(360deg) saturate(1.2); }
    }
`;
document.head.appendChild(confettiStyle);

// ============================================
// POWER-UP TEXT
// ============================================
function showPowerUp(text) {
    const powerUp = document.createElement('div');
    powerUp.className = 'power-up-text';
    powerUp.textContent = text;
    document.body.appendChild(powerUp);
    playSound('powerup');
    setTimeout(() => powerUp.remove(), 1000);
}

// ============================================
// KONAMI CODE EASTER EGG
// ============================================
function checkKonamiCode(key) {
    if (key === KONAMI_CODE[konamiProgress]) {
        konamiProgress++;
        if (konamiProgress === KONAMI_CODE.length) {
            activateSecretMode();
            konamiProgress = 0;
        }
    } else {
        konamiProgress = 0;
    }
}

function activateSecretMode() {
    playSound('secret');
    showPowerUp('★ SECRET ★');
    document.body.classList.toggle('secret-mode');
    // Rainbow mode!
    document.body.style.animation = 'rainbow-bg 2s linear infinite';
    createConfetti();
    createConfetti();
    createConfetti();
    setTimeout(() => {
        document.body.style.animation = '';
    }, 10000);
}

// ============================================
// SHAKE EFFECT
// ============================================
function shakeScreen() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 500);
}

// ============================================
// CARREGAR FILMES
// ============================================
async function loadMovies() {
    const loadingOverlay = document.getElementById('app-loading');

    try {
        // Carregar filmes e listas do Supabase em paralelo
        const [moviesResponse] = await Promise.all([
            fetch('movies.json'),
            fetchWatchlist(),
            fetchWatchedMovies()
        ]);

        movies = await moviesResponse.json();
        filteredMovies = [...movies];
        populateFilters();
        console.log(`Loaded ${movies.length} movies`);
        console.log(`Watchlist: ${getWatchlist().length} items`);
        console.log(`Watched: ${getWatchedMovies().length} items`);

        // Atualizar contadores das listas
        updateListCounts();

        // Esconder loading
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }

        showPowerUp(`${movies.length} FILMES!`);
    } catch (error) {
        console.error('Error loading movies:', error);
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        showPowerUp('ERROR LOADING!');
    }
}

// ============================================
// POPULAR FILTROS
// ============================================
function populateFilters() {
    const genreSelect = document.getElementById('genre');
    const genreCustomOptions = document.querySelector('.custom-select[data-target="genre"] .custom-select-options');
    const genres = new Set();

    movies.forEach(movie => {
        if (movie.genres) {
            movie.genres.split('|').forEach(g => genres.add(g.trim()));
        }
    });

    Array.from(genres).sort().forEach(genre => {
        const genrePt = translateGenre(genre);

        // Select escondido
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genrePt;
        genreSelect.appendChild(option);

        // Custom select
        if (genreCustomOptions) {
            const customOption = document.createElement('div');
            customOption.className = 'custom-select-option';
            customOption.dataset.value = genre;
            customOption.textContent = genrePt;
            customOption.addEventListener('click', () => {
                genreCustomOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                customOption.classList.add('selected');
                document.querySelector('.custom-select[data-target="genre"] .custom-select-value').textContent = genrePt;
                genreSelect.value = genre;
                genreSelect.dispatchEvent(new Event('change'));
                customOption.closest('.custom-select').classList.remove('open');
                playSound('click');
            });
            genreCustomOptions.appendChild(customOption);
        }
    });
}

// ============================================
// APLICAR FILTROS
// ============================================
function applyFilters() {
    const genre = document.getElementById('genre').value;
    const decade = document.getElementById('year').value;
    const minRating = document.getElementById('rating').value;

    filteredMovies = movies.filter(movie => {
        // Filtro de gênero
        if (genre && (!movie.genres || !movie.genres.includes(genre))) {
            return false;
        }

        // Filtro de década
        if (decade) {
            const decadeNum = parseInt(decade);
            if (decadeNum === 1970) {
                if (movie.year >= 1980) return false;
            } else {
                if (movie.year < decadeNum || movie.year >= decadeNum + 10) return false;
            }
        }

        // Filtro de nota
        if (minRating && movie.imdb_score < parseFloat(minRating)) {
            return false;
        }

        return true;
    });

    playSound('click');
}

// ============================================
// EFEITO DE ROLETA
// ============================================
async function showRouletteAnimation() {
    const moviesCount = getMoviesPerSpin();
    return new Promise(resolve => {
        const slotMachine = document.createElement('div');
        slotMachine.className = 'slot-machine';

        // Criar reels dinamicamente
        let reelsHtml = `
            <div class="slot-machine-title">★ GIRANDO ★</div>
            <div class="slot-machine-reels">
        `;
        for (let i = 1; i <= moviesCount; i++) {
            reelsHtml += `<div class="slot-reel spinning" id="reel${i}">???</div>`;
        }
        reelsHtml += `
            </div>
            <div class="slot-machine-lights">
                <div class="slot-light"></div>
                <div class="slot-light"></div>
                <div class="slot-light"></div>
                <div class="slot-light"></div>
                <div class="slot-light"></div>
            </div>
        `;
        slotMachine.innerHTML = reelsHtml;
        document.body.appendChild(slotMachine);

        let flashCount = 0;
        const maxFlashes = CONFIG.ROULETTE_FLASHES;

        const interval = setInterval(() => {
            // Mostrar filmes aleatórios rapidamente
            const randomMovies = getRandomMovies(moviesCount);
            for (let i = 1; i <= moviesCount; i++) {
                const reel = document.getElementById(`reel${i}`);
                if (reel && reel.classList.contains('spinning')) {
                    reel.textContent = randomMovies[i - 1]?.title_pt || '???';
                }
            }

            playSound('spin');
            flashCount++;

            // Parar reels um por um
            if (flashCount >= maxFlashes) {
                clearInterval(interval);
                stopReelsSequentially(moviesCount, slotMachine, resolve);
            }
        }, CONFIG.ROULETTE_DURATION / maxFlashes);
    });
}

function stopReelsSequentially(moviesCount, slotMachine, resolve) {
    let stopped = 0;
    const stopInterval = setInterval(() => {
        const reel = document.getElementById(`reel${stopped + 1}`);
        if (reel) {
            reel.classList.remove('spinning');
            reel.classList.add('stopped');
            reel.textContent = selectedMovies[stopped]?.title_pt || '???';
            playSound('reveal');
        }
        stopped++;

        if (stopped >= moviesCount) {
            clearInterval(stopInterval);

            // Atualizar título
            const title = slotMachine.querySelector('.slot-machine-title');
            if (title) {
                title.textContent = '★ PRONTO! ★';
                title.style.color = 'var(--luigi-green)';
            }

            setTimeout(() => {
                slotMachine.remove();
                resolve();
            }, 800);
        }
    }, 300);
}

// ============================================
// OBTER FILMES ALEATÓRIOS
// ============================================
function getRandomMovies(count, excludeHistory = false) {
    // Filtra filmes que já estão no histórico
    let availableMovies = filteredMovies;
    const history = getMovieHistory();

    if (excludeHistory && history.length > 0) {
        availableMovies = filteredMovies.filter(m => !history.includes(m.imdb_id));
    }

    // Se não tiver filmes suficientes, usa todos (ignora histórico)
    if (availableMovies.length < count) {
        availableMovies = filteredMovies;
    }

    const shuffled = [...availableMovies].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// ============================================
// GIRAR ROLETA
// ============================================
async function spinRoulette() {
    initAudio();
    const spinBtn = document.getElementById('spin-btn');
    const resultsSection = document.getElementById('results');
    const moviesCount = getMoviesPerSpin();

    if (filteredMovies.length < moviesCount) {
        showPowerUp('NOT ENOUGH MOVIES!');
        playSound('gameover');
        return;
    }

    // Desabilitar botão
    spinBtn.disabled = true;
    spinBtn.classList.add('spinning');

    // Shake screen
    shakeScreen();

    // Selecionar filmes (excluindo histórico)
    selectedMovies = getRandomMovies(moviesCount, true);

    // Adicionar ao histórico
    addToHistory(selectedMovies);

    // Mostrar animação de roleta
    await showRouletteAnimation();

    // Confetti!
    createConfetti();
    const messages = ['★ SUPER! ★', '1-UP!', 'YAHOO!', 'LET\'S GO!', 'AMAZING!'];
    showPowerUp(messages[Math.floor(Math.random() * messages.length)]);

    // Mostrar resultados
    await displayResults();

    // Reabilitar botão
    spinBtn.disabled = false;
    spinBtn.classList.remove('spinning');
    resultsSection.classList.remove('hidden');
}

// ============================================
// BUSCAR DETALHES DO FILME NA TMDB
// ============================================
async function fetchMovieDetails(imdbId) {
    try {
        // Primeiro, encontrar o ID do TMDB pelo IMDB ID
        const findResponse = await fetch(
            `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&language=pt-BR`,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.TMDB_TOKEN}`,
                    'accept': 'application/json'
                }
            }
        );

        const findData = await findResponse.json();

        if (!findData.movie_results || findData.movie_results.length === 0) {
            return null;
        }

        const tmdbId = findData.movie_results[0].id;

        // Buscar detalhes completos
        const detailsResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}?language=pt-BR&append_to_response=credits`,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.TMDB_TOKEN}`,
                    'accept': 'application/json'
                }
            }
        );

        return await detailsResponse.json();
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

// ============================================
// CRIAR HEART BAR (Zelda style)
// ============================================
function createHPBar(rating) {
    // Convert rating to hearts (0-10 = 0-5 hearts)
    const totalHearts = 5;
    const filledHearts = Math.round((rating / 10) * totalHearts * 2) / 2; // Allow half hearts

    let hearts = '';
    for (let i = 1; i <= totalHearts; i++) {
        if (i <= filledHearts) {
            hearts += '<span class="heart full">♥</span>';
        } else if (i - 0.5 === filledHearts) {
            hearts += '<span class="heart half">♥</span>';
        } else {
            hearts += '<span class="heart empty">♡</span>';
        }
    }

    // Mensagens baseadas na nota
    let label = 'SUPER STAR!';
    if (rating < 4) {
        // Mensagens engraçadas para filmes muito ruins
        const gameOverMsgs = [
            'WASTED!',
            'YOU DIED',
            'FATALITY!',
            'K.O.!',
            'MISSION FAILED',
            'CONTINUE? 9..8..7..',
            'INSERT COIN',
            'RETRY?',
            'F',
            'PRESS F',
            'RIP',
            'NOT STONKS',
            'BRUH...'
        ];
        label = gameOverMsgs[Math.floor(Math.random() * gameOverMsgs.length)];
    } else if (rating < 5) {
        const badMsgs = ['MEH...', 'GAME OVER', 'TRY AGAIN', 'OOF!'];
        label = badMsgs[Math.floor(Math.random() * badMsgs.length)];
    } else if (rating < 6) {
        label = 'OK...';
    } else if (rating < 7) {
        label = 'NICE!';
    } else if (rating < 8) {
        label = 'GREAT!';
    } else if (rating < 9) {
        label = 'AMAZING!';
    }

    return `
        <div class="heart-bar">
            <div class="hearts">${hearts}</div>
            <div class="heart-label">${rating}/10 ${label}</div>
        </div>
    `;
}

// ============================================
// MOSTRAR RESULTADOS
// ============================================
async function displayResults() {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">LOADING...</div></div>';

    // Ordenar por nota (maior para menor)
    const sortedMovies = [...selectedMovies].sort((a, b) => b.imdb_score - a.imdb_score);

    const cards = await Promise.all(sortedMovies.map(async (movie, index) => {
        const details = await fetchMovieDetails(movie.imdb_id);
        const rank = index + 1;

        const posterUrl = details?.poster_path
            ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
            : null;

        const overview = details?.overview || 'No description available.';
        const genres = details?.genres?.map(g => g.name) || movie.genres?.split('|') || [];

        const gameOverEffect = getGameOverEffect(movie.imdb_score);

        return `
            <div class="movie-card ${gameOverEffect}" onclick="openModalByImdbId('${movie.imdb_id}')" data-index="${index}">
                <div class="rank-badge">${rank}</div>
                <div class="poster-wrapper">
                    ${posterUrl
                        ? `<img class="movie-poster" src="${posterUrl}" alt="${movie.title_pt}" loading="lazy">`
                        : `<div class="no-poster"></div>`
                    }
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${movie.title_pt}</h3>
                    <div class="movie-meta">
                        <span>${movie.year}</span>
                        <span class="movie-rating">★ ${movie.imdb_score}</span>
                    </div>
                    ${createHPBar(movie.imdb_score)}
                    <p class="movie-overview">${overview}</p>
                    <div class="movie-genres">
                        ${genres.slice(0, 3).map(g => `<span class="genre-tag">${translateGenre(g)}</span>`).join('')}
                    </div>
                    ${createActionButtons(movie.imdb_id)}
                </div>
            </div>
        `;
    }));

    grid.innerHTML = cards.join('');

    // Som de reveal para cada card
    selectedMovies.forEach((_, index) => {
        setTimeout(() => playSound('reveal'), 100 + index * 200);
    });
}

// ============================================
// ABRIR MODAL
// ============================================
async function openModal(index) {
    initAudio();
    playSound('click');

    const movie = selectedMovies[index];
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    modalBody.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">LOADING...</div></div>';
    modal.classList.remove('hidden');

    const details = await fetchMovieDetails(movie.imdb_id);

    const posterUrl = details?.poster_path
        ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
        : null;

    const cast = details?.credits?.cast?.slice(0, 8) || [];
    const crew = details?.credits?.crew?.filter(c => c.job === 'Director') || [];
    const runtime = details?.runtime || 'N/A';

    modalBody.innerHTML = `
        <div class="modal-movie">
            <div>
                ${posterUrl
                    ? `<img class="modal-poster" src="${posterUrl}" alt="${movie.title_pt}">`
                    : `<div class="no-poster modal-poster"></div>`
                }
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${details?.title || movie.title_pt}</h2>
                <p class="modal-original-title">${movie.title_en}</p>

                <div class="modal-meta">
                    <span class="modal-meta-item">${movie.year}</span>
                    <span class="modal-meta-item">${runtime} min</span>
                    <span class="modal-meta-item rating">★ ${movie.imdb_score}</span>
                </div>

                ${createHPBar(movie.imdb_score)}

                <div class="modal-section">
                    <h4 class="modal-section-title">Sinopse</h4>
                    <p class="modal-overview">${details?.overview || 'No description available.'}</p>
                </div>

                ${crew.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Diretor</h4>
                        <div class="cast-list">
                            ${crew.map(c => `<span class="cast-item">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${cast.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Elenco</h4>
                        <div class="cast-list">
                            ${cast.map(c => `<span class="cast-item">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="modal-section">
                    <h4 class="modal-section-title">Gêneros</h4>
                    <div class="movie-genres">
                        ${(details?.genres || []).map(g => `<span class="genre-tag">${translateGenre(g.name)}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    playSound('reveal');
}

// ============================================
// ABRIR MODAL POR IMDB ID (para watchlist)
// ============================================
async function openModalByImdbId(imdbId) {
    console.log('openModalByImdbId called with:', imdbId);

    const movie = movies.find(m => m.imdb_id === imdbId);
    if (!movie) {
        console.error('Movie not found:', imdbId);
        return;
    }
    console.log('Movie found:', movie.title_pt);

    initAudio();
    playSound('click');

    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    modalBody.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">LOADING...</div></div>';
    modal.classList.remove('hidden');

    const details = await fetchMovieDetails(movie.imdb_id);

    const posterUrl = details?.poster_path
        ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
        : null;

    const cast = details?.credits?.cast?.slice(0, 8) || [];
    const crew = details?.credits?.crew?.filter(c => c.job === 'Director') || [];
    const runtime = details?.runtime || 'N/A';

    modalBody.innerHTML = `
        <div class="modal-movie">
            <div>
                ${posterUrl
                    ? `<img class="modal-poster" src="${posterUrl}" alt="${movie.title_pt}">`
                    : `<div class="no-poster modal-poster"></div>`
                }
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${details?.title || movie.title_pt}</h2>
                <p class="modal-original-title">${movie.title_en}</p>

                <div class="modal-meta">
                    <span class="modal-meta-item">${movie.year}</span>
                    <span class="modal-meta-item">${runtime} min</span>
                    <span class="modal-meta-item rating">★ ${movie.imdb_score}</span>
                </div>

                ${createHPBar(movie.imdb_score)}

                <div class="modal-section">
                    <h4 class="modal-section-title">Sinopse</h4>
                    <p class="modal-overview">${details?.overview || 'No description available.'}</p>
                </div>

                ${crew.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Diretor</h4>
                        <div class="cast-list">
                            ${crew.map(c => `<span class="cast-item">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${cast.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Elenco</h4>
                        <div class="cast-list">
                            ${cast.map(c => `<span class="cast-item">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="modal-section">
                    <h4 class="modal-section-title">Gêneros</h4>
                    <div class="movie-genres">
                        ${(details?.genres || []).map(g => `<span class="genre-tag">${translateGenre(g.name)}</span>`).join('')}
                    </div>
                </div>

                ${createActionButtons(movie.imdb_id)}
            </div>
        </div>
    `;

    playSound('reveal');
}

// ============================================
// FECHAR MODAL
// ============================================
function closeModal() {
    playSound('click');
    document.getElementById('modal').classList.add('hidden');
}

// ============================================
// MOBILE DETECTION & HAPTICS
// ============================================
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function vibrate(pattern = [50]) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// ============================================
// PREVENT ACCIDENTAL CLICKS DURING SCROLL
// ============================================
let isScrolling = false;
let scrollTimeout = null;

function setupScrollProtection() {
    window.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 150);
    }, { passive: true });
}

// ============================================
// SWIPE GESTURE SUPPORT
// ============================================
let touchStartY = 0;
let touchEndY = 0;

function handleSwipeGesture() {
    const swipeDistance = touchStartY - touchEndY;
    const minSwipe = 100;
    const resultsVisible = !document.getElementById('results').classList.contains('hidden');

    // Desabilitar swipe quando resultados estão visíveis
    if (resultsVisible) {
        return;
    }

    // Swipe up to spin (só quando não tem resultados)
    if (swipeDistance > minSwipe) {
        vibrate([50, 30, 50]);
        spinRoulette();
    }
}

function setupSwipeGestures() {
    const container = document.querySelector('.container');

    container.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipeGesture();
    }, { passive: true });
}

// ============================================
// PULL TO REFRESH PREVENTION
// ============================================
function preventPullToRefresh() {
    let lastTouchY = 0;
    let maybePrevent = false;

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        lastTouchY = e.touches[0].clientY;
        maybePrevent = window.scrollY === 0;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const touchYDelta = touchY - lastTouchY;
        lastTouchY = touchY;

        if (maybePrevent && touchYDelta > 0 && window.scrollY === 0) {
            // User is pulling down at top of page
            // We allow it but show a hint
        }
    }, { passive: true });
}

// ============================================
// MOBILE-SPECIFIC CONFETTI (lighter)
// ============================================
function createConfettiMobile() {
    const colors = ['#00fff5', '#ff00ff', '#ffff00', '#00ff00'];
    const count = isMobile ? 25 : 50; // Less confetti on mobile

    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            position: fixed;
            width: ${Math.random() * 8 + 4}px;
            height: ${Math.random() * 8 + 4}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -20px;
            z-index: 9999;
            pointer-events: none;
            animation: confetti-fall ${Math.random() * 2 + 1.5}s linear forwards;
            box-shadow: 0 0 6px currentColor;
        `;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3500);
    }
}

// Override createConfetti for mobile
const originalCreateConfetti = createConfetti;
createConfetti = function() {
    if (isMobile) {
        createConfettiMobile();
    } else {
        originalCreateConfetti();
    }
};

// ============================================
// MOBILE MODAL HANDLING (Back button)
// ============================================
function setupMobileModalHandling() {
    // Handle back button on mobile
    window.addEventListener('popstate', (e) => {
        const modal = document.getElementById('modal');
        if (!modal.classList.contains('hidden')) {
            e.preventDefault();
            closeModal();
        }
    });
}

// Push state when opening modal + scroll protection
const originalOpenModal = openModal;
openModal = async function(index) {
    // Prevent accidental clicks during scroll
    if (isScrolling) {
        return;
    }

    if (isMobile) {
        history.pushState({ modal: true }, '');
    }
    await originalOpenModal(index);
};

// ============================================
// MOBILE ORIENTATION CHANGE
// ============================================
function handleOrientationChange() {
    // Close modal on orientation change to prevent layout issues
    const modal = document.getElementById('modal');
    if (!modal.classList.contains('hidden')) {
        closeModal();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initCustomSelects();
    loadMovies();

    // Botão principal
    document.getElementById('spin-btn').addEventListener('click', () => {
        if (isTouch) vibrate([30, 20, 30]);
        spinRoulette();
    });

    // Botão sortear novamente
    document.getElementById('spin-again').addEventListener('click', () => {
        if (isTouch) vibrate([30, 20, 30]);
        spinRoulette();
    });

    // Fechar modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    // Filtros
    document.getElementById('genre').addEventListener('change', () => {
        if (isTouch) vibrate([20]);
        applyFilters();
    });
    document.getElementById('year').addEventListener('change', () => {
        if (isTouch) vibrate([20]);
        applyFilters();
    });
    document.getElementById('rating').addEventListener('change', () => {
        if (isTouch) vibrate([20]);
        applyFilters();
    });
    document.getElementById('movies-count').addEventListener('change', () => {
        if (isTouch) vibrate([20]);
        playSound('click');
    });

    // Konami code
    document.addEventListener('keydown', (e) => checkKonamiCode(e.key));

    // ESC para fechar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Inicializar áudio no primeiro clique/touch
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    // Mobile-specific setup
    if (isTouch) {
        setupSwipeGestures();
        preventPullToRefresh();
        setupMobileModalHandling();
        setupScrollProtection();

        // Orientation change
        window.addEventListener('orientationchange', handleOrientationChange);
        screen.orientation?.addEventListener('change', handleOrientationChange);

        console.log('%c📱 MOBILE MODE ACTIVATED', 'color: #00ff00;');
        console.log('%cSwipe UP to spin!', 'color: #ffff00;');
    }
});

// ============================================
// CUSTOM SELECT
// ============================================
function initCustomSelects() {
    const customSelects = document.querySelectorAll('.custom-select');

    customSelects.forEach(select => {
        const trigger = select.querySelector('.custom-select-trigger');
        const options = select.querySelectorAll('.custom-select-option');
        const targetId = select.dataset.target;
        const hiddenSelect = document.getElementById(targetId);
        const valueDisplay = select.querySelector('.custom-select-value');

        // Abrir/fechar
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Fechar outros selects abertos
            customSelects.forEach(s => {
                if (s !== select) s.classList.remove('open');
            });
            select.classList.toggle('open');
            playSound('click');
        });

        // Selecionar opção
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                const text = option.textContent;

                // Atualizar visual
                options.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                valueDisplay.textContent = text;

                // Atualizar select escondido
                if (hiddenSelect) {
                    hiddenSelect.value = value;
                    hiddenSelect.dispatchEvent(new Event('change'));
                }

                select.classList.remove('open');
                playSound('click');
            });
        });
    });

    // Fechar ao clicar fora
    document.addEventListener('click', () => {
        customSelects.forEach(s => s.classList.remove('open'));
    });
}

// ============================================
// MOBILE NAVBAR (esconde/aparece com scroll)
// ============================================
let lastScrollY = 0;
let ticking = false;

function updateNavbar() {
    const navbar = document.getElementById('mobile-navbar');
    if (!navbar) return;

    const currentScrollY = window.scrollY;

    // Mostra quando rola para baixo
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        navbar.classList.add('visible');
    } else if (currentScrollY < lastScrollY) {
        // Esconde quando rola para cima
        navbar.classList.remove('visible');
    }

    lastScrollY = currentScrollY;
    ticking = false;
}

function onScroll() {
    if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
    }
}

// Atualizar contadores da navbar
function updateNavbarCounts() {
    const watchlistCount = getWatchlist().length;
    const watchedCount = getWatchedMovies().length;

    const navWatchlistCount = document.getElementById('navbar-watchlist-count');
    const navWatchedCount = document.getElementById('navbar-watched-count');

    if (navWatchlistCount) {
        navWatchlistCount.textContent = watchlistCount;
        navWatchlistCount.style.display = watchlistCount > 0 ? 'flex' : 'none';
    }

    if (navWatchedCount) {
        navWatchedCount.textContent = watchedCount;
        navWatchedCount.style.display = watchedCount > 0 ? 'flex' : 'none';
    }
}

// Adicionar listener de scroll
window.addEventListener('scroll', onScroll, { passive: true });

console.log('%c🎬 ROLETA DE FILMES 🎬', 'font-size: 24px; color: #00fff5; text-shadow: 2px 2px #ff00ff;');
console.log('%cTry the Konami Code! ↑↑↓↓←→←→BA', 'color: #ffff00;');
