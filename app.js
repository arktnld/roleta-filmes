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
    // Credenciais carregadas de config.js (API_CONFIG)
    TMDB_TOKEN: typeof API_CONFIG !== 'undefined' ? API_CONFIG.TMDB_TOKEN : '',
    TMDB_IMG_BASE: 'https://image.tmdb.org/t/p/w780',
    MOVIES_PER_SPIN: 3,
    MAX_MOVIES_PER_SPIN: 9, // Limite máximo para não sobrecarregar a API
    HISTORY_CACHE_SIZE: 30, // Quantidade de filmes no cache circular
    ROULETTE_DURATION: 2000, // ms
    ROULETTE_FLASHES: 15,
    // Turso (carregado de config.js)
    TURSO_URL: typeof API_CONFIG !== 'undefined' ? API_CONFIG.TURSO_URL : '',
    TURSO_TOKEN: typeof API_CONFIG !== 'undefined' ? API_CONFIG.TURSO_TOKEN : ''
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
// CACHE E QUEUE PARA API TMDB
// ============================================
const tmdbCache = new Map();
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutos

// Queue de requisições com limite de concorrência
const requestQueue = {
    pending: [],
    active: 0,
    maxConcurrent: 5,

    async add(fn) {
        return new Promise((resolve, reject) => {
            this.pending.push({ fn, resolve, reject });
            this.process();
        });
    },

    async process() {
        if (this.active >= this.maxConcurrent || this.pending.length === 0) return;

        this.active++;
        const { fn, resolve, reject } = this.pending.shift();

        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.active--;
            this.process();
        }
    }
};

// Cache com expiração
function getCached(key) {
    const item = tmdbCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        tmdbCache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    tmdbCache.set(key, {
        data,
        expiry: Date.now() + CACHE_EXPIRY
    });
}

// ============================================
// LAZY LOADING DE IMAGENS
// ============================================
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                img.classList.add('loaded');
            }
            observer.unobserve(img);
        }
    });
}, {
    rootMargin: '100px', // Carrega 100px antes de entrar na tela
    threshold: 0.1
});

// Configura lazy loading para novas imagens
function setupLazyImages(container = document) {
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => imageObserver.observe(img));
}

// Preload de imagens em background
function preloadImages(urls) {
    urls.forEach(url => {
        if (url) {
            const img = new Image();
            img.src = url;
        }
    });
}

// Helper para criar img com lazy loading
function createLazyImage(src, alt, className) {
    if (!src) return `<div class="${className} no-poster">🎬</div>`;
    return `<img class="${className}" data-src="${src}" alt="${alt}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">`;
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
// TURSO API HELPERS
// ============================================
async function tursoExecute(sql, args = []) {
    const url = `${CONFIG.TURSO_URL}/v2/pipeline`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.TURSO_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [
                { type: 'execute', stmt: { sql, args: args.map(a => ({ type: 'text', value: String(a) })) } },
                { type: 'close' }
            ]
        })
    });
    const data = await response.json();
    if (data.results && data.results[0] && data.results[0].response) {
        const result = data.results[0].response.result;
        if (result && result.rows) {
            const cols = result.cols.map(c => c.name);
            return result.rows.map(row => {
                const obj = {};
                row.forEach((cell, i) => obj[cols[i]] = cell.value);
                return obj;
            });
        }
    }
    return [];
}

// Cache local para evitar muitas requisições
let watchedCache = null;
let watchedRatings = {}; // {imdb_id: rating}
let watchlistCache = null;

// ============================================
// WATCHED MOVIES (Turso - global)
// ============================================
async function fetchWatchedMovies() {
    try {
        const data = await tursoExecute('SELECT imdb_id, rating FROM watched');
        watchedCache = data.map(item => item.imdb_id);
        watchedRatings = {};
        data.forEach(item => {
            if (item.rating) watchedRatings[item.imdb_id] = parseInt(item.rating);
        });
        return watchedCache;
    } catch (error) {
        console.error('Error fetching watched:', error);
        return watchedCache || [];
    }
}

function getWatchedMovies() {
    return watchedCache || [];
}

async function toggleWatched(imdbId, rating = null) {
    const watched = getWatchedMovies();
    const isCurrentlyWatched = watched.includes(imdbId);

    try {
        if (isCurrentlyWatched) {
            await tursoExecute('DELETE FROM watched WHERE imdb_id = ?', [imdbId]);
            watchedCache = watched.filter(id => id !== imdbId);
            delete watchedRatings[imdbId];
            playSound('remove');
        } else {
            if (rating) {
                await tursoExecute('INSERT INTO watched (imdb_id, rating) VALUES (?, ?)', [imdbId, rating]);
                watchedRatings[imdbId] = rating;
            } else {
                await tursoExecute('INSERT INTO watched (imdb_id) VALUES (?)', [imdbId]);
            }
            watchedCache = [...watched, imdbId];
            playSound('coin');
        }
    } catch (error) {
        console.error('Error toggling watched:', error);
        playSound('error');
    }

    return !isCurrentlyWatched;
}

async function updateWatchedRating(imdbId, rating) {
    try {
        await tursoExecute('UPDATE watched SET rating = ? WHERE imdb_id = ?', [rating, imdbId]);
        watchedRatings[imdbId] = rating;
        playSound('coin');
        return true;
    } catch (error) {
        console.error('Error updating rating:', error);
        playSound('error');
        return false;
    }
}

function getWatchedRating(imdbId) {
    return watchedRatings[imdbId] || null;
}

function isWatched(imdbId) {
    return getWatchedMovies().includes(imdbId);
}

// Rating Picker
let ratingPickerCallback = null;
let ratingPickerImdbId = null;

function showRatingPicker(imdbId, callback) {
    ratingPickerImdbId = imdbId;
    ratingPickerCallback = callback;
    document.getElementById('rating-picker').classList.remove('hidden');
    playSound('click');
}

function closeRatingPicker() {
    document.getElementById('rating-picker').classList.add('hidden');
    ratingPickerCallback = null;
    ratingPickerImdbId = null;
    playSound('click');
}

async function selectRating(rating) {
    const picker = document.getElementById('rating-picker');
    picker.classList.add('hidden');

    if (ratingPickerCallback) {
        await ratingPickerCallback(ratingPickerImdbId, rating);
    }

    ratingPickerCallback = null;
    ratingPickerImdbId = null;
}

// ============================================
// WATCHLIST (Turso - global)
// ============================================
async function fetchWatchlist() {
    try {
        const data = await tursoExecute('SELECT imdb_id FROM watchlist');
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
            await tursoExecute('DELETE FROM watchlist WHERE imdb_id = ?', [imdbId]);
            watchlistCache = watchlist.filter(id => id !== imdbId);
            playSound('remove');
        } else {
            await tursoExecute('INSERT INTO watchlist (imdb_id) VALUES (?)', [imdbId]);
            watchlistCache = [...watchlist, imdbId];
            playSound('powerup');
        }
        console.log('Watchlist updated:', watchlistCache);
    } catch (error) {
        console.error('Error toggling watchlist:', error);
        playSound('error');
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
const ALL_GAME_OVER_EFFECTS = [
    'effect-wasted',      // GTA WASTED
    'effect-skull',       // Caveira flutuante
    'effect-rip',         // Lápide R.I.P.
    'effect-glitch',      // TV sem sinal
    'effect-bomb',        // Bomba explodindo
    'effect-wanted',      // GTA WANTED
    'effect-tomato',      // Tomate podre
    'effect-ghost',       // Fantasma
    'effect-fire',        // Em chamas
    'effect-matrix',      // Matrix glitch
    'effect-thanos'       // Thanos snap
];

let availableEffects = [];

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function resetAvailableEffects() {
    availableEffects = shuffleArray(ALL_GAME_OVER_EFFECTS);
}

function getGameOverEffect(rating) {
    // Nota < 5: Efeitos de Game Over
    if (rating < 5) {
        // Se não tem mais efeitos disponíveis, reseta a lista
        if (availableEffects.length === 0) {
            resetAvailableEffects();
        }
        return availableEffects.pop();
    }

    return ''; // Nota >= 5: sem efeito
}

// Inicializa os efeitos
resetAvailableEffects();

async function handleWatchedClick(event, imdbId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const isCurrentlyWatched = isWatched(imdbId);

    if (isCurrentlyWatched) {
        // Remover - não precisa de picker
        btn.disabled = true;
        await toggleWatched(imdbId);
        btn.classList.remove('active');
        btn.querySelector('.icon').textContent = '👁';
        btn.querySelector('span:last-child').textContent = 'JÁ VI';
        btn.disabled = false;
        updateListCounts();
    } else {
        // Adicionar - mostrar picker de nota
        showRatingPicker(imdbId, async (id, rating) => {
            btn.disabled = true;
            await toggleWatched(id, rating);
            btn.classList.add('active');
            btn.querySelector('.icon').textContent = '✓';
            btn.querySelector('span:last-child').textContent = rating ? `NOTA ${rating}` : 'VISTO';
            btn.disabled = false;
            updateListCounts();
            showPowerUp(rating ? `NOTA ${rating}!` : 'WATCHED!');
        });
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
}

// Alias para manter compatibilidade
function updateWatchlistCount() {
    updateListCounts();
}

async function toggleListView(type) {
    const listSection = document.getElementById('list-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-wrapper, #results');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const watchedBtn = document.getElementById('watched-btn');

    // Se já está mostrando a mesma lista, fecha
    if (currentListView === type) {
        closeListView();
        return;
    }

    // Recarregar dados do banco para pegar notas atualizadas
    if (type === 'watched') {
        await fetchWatchedMovies();
    } else {
        await fetchWatchlist();
    }

    // Atualizar estado
    currentListView = type;

    // Resetar filtros e paginação
    listPage = 1;
    const searchInput = document.getElementById('list-search-input');
    const genreSelect = document.getElementById('list-filter-genre');
    const decadeSelect = document.getElementById('list-filter-decade');
    const sortSelect = document.getElementById('list-filter-sort');
    if (searchInput) searchInput.value = '';
    if (genreSelect) genreSelect.value = '';
    if (decadeSelect) decadeSelect.value = '';
    if (sortSelect) sortSelect.value = 'rating-desc';

    // Atualizar título
    const titleEl = document.getElementById('list-title');
    if (titleEl) {
        titleEl.textContent = type === 'watchlist' ? 'Quero Ver' : 'Já Vi';
    }

    // Mostrar seção de lista
    listSection.classList.remove('hidden');
    mainContent.forEach(el => el.classList.add('hidden'));

    // Esconder botão flutuante mobile
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) mobileFab.classList.add('hidden');

    // Atualizar botões ativos
    watchlistBtn.classList.toggle('active', type === 'watchlist');
    watchedBtn.classList.toggle('active', type === 'watched');

    // Exibir lista
    displayList(type);

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    playSound('click');
}

function closeListView() {
    currentListView = null;

    const listSection = document.getElementById('list-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-wrapper, #results');
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

    // Mostrar botão flutuante mobile
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) mobileFab.classList.remove('hidden');

    playSound('click');
}

// Estado para filtros e paginação da lista
let listFilteredMovies = [];
let listPage = 1;
const LIST_PER_PAGE = 12;

async function displayList(type) {
    const grid = document.getElementById('list-grid');
    const emptyMsg = document.getElementById('list-empty');
    const info = document.getElementById('list-results-info');
    const pagination = document.getElementById('list-pagination');

    // Popular gêneros no filtro se ainda não populado
    const listGenreSelect = document.getElementById('list-filter-genre');
    const listGenreCustomOptions = document.querySelector('.custom-select[data-target="list-filter-genre"] .custom-select-options');
    if (listGenreSelect && listGenreSelect.options.length <= 1) {
        const genres = [...new Set(movies.flatMap(m => m.genres ? m.genres.split('|') : []))].sort();
        genres.forEach(genre => {
            // Popular select escondido
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = translateGenre(genre);
            listGenreSelect.appendChild(option);

            // Popular custom-select
            if (listGenreCustomOptions) {
                const customOption = document.createElement('div');
                customOption.className = 'custom-select-option';
                customOption.dataset.value = genre;
                customOption.textContent = translateGenre(genre);
                customOption.addEventListener('click', () => {
                    listGenreCustomOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                    customOption.classList.add('selected');
                    document.querySelector('.custom-select[data-target="list-filter-genre"] .custom-select-value').textContent = translateGenre(genre);
                    listGenreSelect.value = genre;
                    listGenreSelect.dispatchEvent(new Event('change'));
                    customOption.closest('.custom-select').classList.remove('open');
                    playSound('click');
                });
                listGenreCustomOptions.appendChild(customOption);
            }
        });
    }

    // Obter IDs da lista correta
    const listIds = type === 'watchlist' ? getWatchlist() : getWatchedMovies();

    if (listIds.length === 0) {
        grid.innerHTML = '';
        info.innerHTML = '';
        pagination.innerHTML = '';
        emptyMsg.textContent = type === 'watchlist'
            ? 'Sua lista de filmes para assistir está vazia!'
            : 'Você ainda não marcou nenhum filme como visto!';
        emptyMsg.classList.remove('hidden');
        return;
    }

    // Obter valores dos filtros
    const searchQuery = normalizeText(document.getElementById('list-search-input')?.value || '');
    const genre = document.getElementById('list-filter-genre')?.value || '';
    const decade = document.getElementById('list-filter-decade')?.value || '';
    const sortOrder = document.getElementById('list-filter-sort')?.value || 'rating-desc';

    // Filtrar filmes da lista
    listFilteredMovies = movies
        .filter(m => listIds.includes(m.imdb_id))
        .filter(movie => {
            // Filtro de busca
            if (searchQuery) {
                const titlePt = normalizeText(movie.title_pt || '');
                const titleEn = normalizeText(movie.title_en || '');
                const director = normalizeText(movie.director || '');
                if (!titlePt.includes(searchQuery) && !titleEn.includes(searchQuery) && !director.includes(searchQuery)) {
                    return false;
                }
            }

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

            return true;
        });

    // Ordenar
    switch (sortOrder) {
        case 'rating-desc':
            listFilteredMovies.sort((a, b) => b.imdb_score - a.imdb_score);
            break;
        case 'rating-asc':
            listFilteredMovies.sort((a, b) => a.imdb_score - b.imdb_score);
            break;
        case 'year-desc':
            listFilteredMovies.sort((a, b) => b.year - a.year);
            break;
        case 'year-asc':
            listFilteredMovies.sort((a, b) => a.year - b.year);
            break;
        case 'title-asc':
            listFilteredMovies.sort((a, b) => (a.title_pt || '').localeCompare(b.title_pt || ''));
            break;
    }

    if (listFilteredMovies.length === 0) {
        grid.innerHTML = '';
        info.innerHTML = '';
        pagination.innerHTML = '';
        emptyMsg.textContent = 'Nenhum filme encontrado com esses filtros.';
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    // Paginação
    const totalPages = Math.ceil(listFilteredMovies.length / LIST_PER_PAGE);
    const start = (listPage - 1) * LIST_PER_PAGE;
    const end = start + LIST_PER_PAGE;
    const pageMovies = listFilteredMovies.slice(start, end);

    // Info
    info.innerHTML = `<span class="list-count">${listFilteredMovies.length} filme${listFilteredMovies.length !== 1 ? 's' : ''}</span>`;

    grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    const cards = await Promise.all(pageMovies.map(async (movie) => {
        const details = await fetchMovieDetails(movie.imdb_id);

        const posterUrl = details?.poster_path
            ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
            : null;

        // Botões diferentes para cada tipo de lista
        const actionButtons = type === 'watchlist' ? `
            <button class="action-btn watched ${isWatched(movie.imdb_id) ? 'active' : ''}"
                    onclick="event.stopPropagation(); handleWatchedClick(event, '${movie.imdb_id}')">
                <span class="icon">${isWatched(movie.imdb_id) ? '✓' : '👁'}</span>
            </button>
            <button class="action-btn remove" onclick="event.stopPropagation(); removeFromListView('${movie.imdb_id}', 'watchlist')">
                <span class="icon">✕</span>
            </button>
        ` : `
            <button class="action-btn watchlist ${isInWatchlist(movie.imdb_id) ? 'active' : ''}"
                    onclick="event.stopPropagation(); handleWatchlistClick(event, '${movie.imdb_id}')">
                <span class="icon">${isInWatchlist(movie.imdb_id) ? '★' : '☆'}</span>
            </button>
            <button class="action-btn remove" onclick="event.stopPropagation(); removeFromListView('${movie.imdb_id}', 'watched')">
                <span class="icon">✕</span>
            </button>
        `;

        const userRating = type === 'watched' ? getWatchedRating(movie.imdb_id) : null;

        return `
            <div class="list-card" data-imdb="${movie.imdb_id}" onclick="openModalByImdbId('${movie.imdb_id}')">
                <div class="list-poster-wrapper">
                    ${userRating ? `<div class="rating-badge">${userRating}</div>` : ''}
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

    // Ativar lazy loading para as novas imagens
    setupLazyImages(grid);

    // Renderizar paginação
    if (totalPages > 1) {
        let paginationHTML = '';

        if (listPage > 1) {
            paginationHTML += `<button onclick="listGoToPage(${listPage - 1})">←</button>`;
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= listPage - 1 && i <= listPage + 1)) {
                paginationHTML += `<button class="${i === listPage ? 'active' : ''}" onclick="listGoToPage(${i})">${i}</button>`;
            } else if (i === listPage - 2 || i === listPage + 2) {
                paginationHTML += `<span class="pagination-dots">...</span>`;
            }
        }

        if (listPage < totalPages) {
            paginationHTML += `<button onclick="listGoToPage(${listPage + 1})">→</button>`;
        }

        pagination.innerHTML = paginationHTML;
    } else {
        pagination.innerHTML = '';
    }
}

// Filtrar lista atual
function filterCurrentList() {
    if (!currentListView) return;
    listPage = 1;
    displayList(currentListView);
}

// Ir para página na lista
function listGoToPage(page) {
    listPage = page;
    displayList(currentListView);
    // Scroll para o topo da lista
    document.getElementById('list-section').scrollIntoView({ behavior: 'smooth' });
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
let soundMuted = localStorage.getItem('soundMuted') === 'true';

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    updateMuteButton();
}

function toggleMute() {
    soundMuted = !soundMuted;
    localStorage.setItem('soundMuted', soundMuted);
    updateMuteButton();
    if (!soundMuted) playSound('click');
}

function updateMuteButton() {
    const btn = document.getElementById('mute-btn');
    if (btn) {
        btn.textContent = soundMuted ? '🚫' : '🔊';
        btn.title = soundMuted ? 'Ativar sons' : 'Desativar sons';
    }
}

function playSound(type) {
    if (!audioCtx || soundMuted) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Nintendo-style sounds (more melodic and cheerful)
    const sounds = {
        spin: { freq: [440, 554, 659, 880], duration: 0.08, type: 'square' },      // Roleta girando
        reveal: { freq: [523, 659, 784, 1047], duration: 0.12, type: 'square' },   // Filme revelado
        click: { freq: [987, 1318], duration: 0.04, type: 'square' },              // Menu select
        powerup: { freq: [392, 523, 659], duration: 0.1, type: 'triangle' },       // Quero Ver (bookmark)
        gameover: { freq: [392, 349, 330, 294, 262], duration: 0.15, type: 'triangle' }, // Nenhum resultado
        secret: { freq: [659, 784, 880, 987, 1047, 1175, 1318, 1568], duration: 0.06, type: 'square' }, // Easter egg
        coin: { freq: [784, 988, 1175, 1568], duration: 0.07, type: 'square' },    // Já Vi (achievement!)
        error: { freq: [330, 277, 233], duration: 0.12, type: 'sawtooth' },        // Erro
        remove: { freq: [659, 440, 330], duration: 0.06, type: 'triangle' }        // Remover da lista
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
    const sortOrder = document.getElementById('sort-order')?.value || '';

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
        if (minRating) {
            if (minRating === 'below5') {
                if (movie.imdb_score >= 5) return false;
            } else if (movie.imdb_score < parseFloat(minRating)) {
                return false;
            }
        }

        return true;
    });

    // Aplicar ordenação
    if (sortOrder) {
        filteredMovies = sortMovies(filteredMovies, sortOrder);
    }

    playSound('click');
}

// Função para ordenar filmes
function sortMovies(movieList, sortOrder) {
    const sorted = [...movieList];

    switch (sortOrder) {
        case 'year-desc':
            sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
            break;
        case 'year-asc':
            sorted.sort((a, b) => (a.year || 0) - (b.year || 0));
            break;
        case 'rating-desc':
            sorted.sort((a, b) => (b.imdb_score || 0) - (a.imdb_score || 0));
            break;
        case 'rating-asc':
            sorted.sort((a, b) => (a.imdb_score || 0) - (b.imdb_score || 0));
            break;
    }

    return sorted;
}

// ============================================
// EFEITO DE ROLETA - SLOT MACHINE LAS VEGAS
// ============================================
const SLOT_ITEMS_COUNT = 15;

// Criar slot machine overlay
function createSlotMachine(selected) {
    const existing = document.querySelector('.slot-machine');
    if (existing) existing.remove();

    const moviesCount = selected.length;

    // Criar 3 rolos com filmes aleatórios
    const createReelItems = () => {
        const randomMovies = getRandomMovies(SLOT_ITEMS_COUNT);
        return randomMovies.map(m => {
            const posterUrl = m.poster_path ? `${CONFIG.TMDB_IMG_BASE}${m.poster_path}` : null;
            return `
                <div class="slot-reel-item">
                    ${posterUrl ? `<img src="${posterUrl}" alt="">` : `<span>${(m.title_pt || '?').substring(0, 12)}</span>`}
                </div>
            `;
        }).join('');
    };

    const slotMachine = document.createElement('div');
    slotMachine.className = 'slot-machine';
    slotMachine.innerHTML = `
        <div class="slot-machine-cabinet">
            <div class="slot-machine-title">★ SORTEANDO ${moviesCount} FILME${moviesCount > 1 ? 'S' : ''} ★</div>
            <div class="slot-machine-display">
                <div class="slot-machine-reels">
                    <div class="slot-reel-container">
                        <div class="slot-reel" data-reel="0">${createReelItems()}</div>
                    </div>
                    <div class="slot-reel-container">
                        <div class="slot-reel" data-reel="1">${createReelItems()}</div>
                    </div>
                    <div class="slot-reel-container">
                        <div class="slot-reel" data-reel="2">${createReelItems()}</div>
                    </div>
                </div>
            </div>
            <div class="slot-machine-lights">
                <span class="slot-light"></span>
                <span class="slot-light"></span>
                <span class="slot-light"></span>
                <span class="slot-light"></span>
                <span class="slot-light"></span>
                <span class="slot-light"></span>
                <span class="slot-light"></span>
            </div>
            <div class="slot-machine-status">GIRANDO...</div>
            <div class="slot-machine-handle"></div>
        </div>
    `;

    document.body.appendChild(slotMachine);
    return { slotMachine };
}

async function showRouletteAnimation() {
    const moviesCount = getMoviesPerSpin();

    return new Promise(resolve => {
        const { slotMachine } = createSlotMachine(selectedMovies);
        const reels = slotMachine.querySelectorAll('.slot-reel');
        const status = slotMachine.querySelector('.slot-machine-status');
        const lights = slotMachine.querySelectorAll('.slot-light');
        const handle = slotMachine.querySelector('.slot-machine-handle');

        // Animação da alavanca
        handle.classList.add('pulling');
        playSound('click');

        setTimeout(() => {
            handle.classList.remove('pulling');

            // Iniciar spin de todos os rolos
            reels.forEach(reel => reel.classList.add('spinning'));

            // Animação das luzes
            lights.forEach((light, i) => {
                light.style.animationDelay = `${i * 0.1}s`;
            });

            // Som de spinning
            const spinSound = setInterval(() => playSound('spin'), 200);

            // Parar rolos um por um
            const stopDelays = [1500, 2000, 2500];
            reels.forEach((reel, i) => {
                setTimeout(() => {
                    reel.classList.remove('spinning');
                    reel.classList.add('stopping');
                    playSound('click');

                    // No último rolo, mostrar resultado
                    if (i === reels.length - 1) {
                        clearInterval(spinSound);

                        setTimeout(() => {
                            // Mostrar mensagem de sucesso
                            status.textContent = `★ JACKPOT! ${moviesCount} FILME${moviesCount > 1 ? 'S' : ''}! ★`;
                            status.classList.add('jackpot');
                            playSound('reveal');
                            createConfetti();

                            // Remover slot machine após delay
                            setTimeout(() => {
                                slotMachine.style.animation = 'slot-fade-out 0.3s ease forwards';
                                setTimeout(() => {
                                    slotMachine.remove();
                                    resolve();
                                }, 300);
                            }, 1000);
                        }, 500);
                    }
                }, stopDelays[i]);
            });
        }, 300);
    });
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
    resetAvailableEffects(); // Resetar efeitos para garantir variedade
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

    // Prefetch detalhes enquanto animação roda
    prefetchMovieDetails(selectedMovies.map(m => m.imdb_id));

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
    // Verificar cache primeiro
    const cached = getCached(imdbId);
    if (cached) return cached;

    // Usar request queue para limitar concorrência
    return requestQueue.add(async () => {
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

            const details = await detailsResponse.json();

            // Salvar no cache
            if (details) setCache(imdbId, details);

            return details;
        } catch (error) {
            console.error('Error fetching movie details:', error);
            return null;
        }
    });
}

// Prefetch de detalhes para filmes que provavelmente serão exibidos
async function prefetchMovieDetails(imdbIds) {
    // Prefetch em background sem bloquear
    imdbIds.forEach(id => {
        if (!getCached(id)) {
            fetchMovieDetails(id).catch(() => {});
        }
    });
}

// ============================================
// CRIAR RATING DISPLAY
// ============================================
function createHPBar(rating) {
    // Convert rating to hearts (0-10 = 0-5 hearts)
    const totalHearts = 5;
    const filledHearts = Math.round((rating / 10) * totalHearts * 2) / 2;

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

    // Mensagens aleatórias baseadas na nota
    let label = 'SUPER STAR!';
    if (rating < 4) {
        const gameOverMsgs = [
            'WASTED!', 'YOU DIED', 'FATALITY!', 'K.O.!', 'MISSION FAILED',
            'CONTINUE? 9..8..7..', 'INSERT COIN', 'RETRY?', 'F', 'PRESS F',
            'RIP', 'NOT STONKS', 'BRUH...', 'SKILL ISSUE', 'GIT GUD',
            'RAGE QUIT', 'CTRL+ALT+DEL', 'UNINSTALL', '404 QUALITY'
        ];
        label = gameOverMsgs[Math.floor(Math.random() * gameOverMsgs.length)];
    } else if (rating < 5) {
        const badMsgs = [
            'MEH...', 'GAME OVER', 'TRY AGAIN', 'OOF!', 'BRUH',
            'NAH...', 'SKIP!', 'PASS...', 'YIKES', 'CRINGE',
            'MID AF', 'NOT IT', 'NOPE!', 'EH...', 'WHATEVER'
        ];
        label = badMsgs[Math.floor(Math.random() * badMsgs.length)];
    } else if (rating < 6) {
        const okMsgs = ['OK...', 'NOT BAD', 'COULD BE WORSE'];
        label = okMsgs[Math.floor(Math.random() * okMsgs.length)];
    } else if (rating < 7) {
        const niceMsgs = ['NICE!', 'GOOD JOB!', 'LEVEL UP!'];
        label = niceMsgs[Math.floor(Math.random() * niceMsgs.length)];
    } else if (rating < 8) {
        const greatMsgs = ['GREAT!', 'AWESOME!', 'EPIC!'];
        label = greatMsgs[Math.floor(Math.random() * greatMsgs.length)];
    } else if (rating < 9) {
        const amazingMsgs = ['AMAZING!', 'LEGENDARY!', 'GODLIKE!'];
        label = amazingMsgs[Math.floor(Math.random() * amazingMsgs.length)];
    } else {
        const superMsgs = ['SUPER STAR!', 'MASTERPIECE!', 'FLAWLESS!', 'PERFECT!'];
        label = superMsgs[Math.floor(Math.random() * superMsgs.length)];
    }

    return `
        <div class="heart-bar">
            <div class="hearts">${hearts}</div>
            <div class="heart-phrase">${label}</div>
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

    // Ativar lazy loading para as novas imagens
    setupLazyImages(grid);

    // Som removido - já toca no jackpot
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
                    ? `<img class="modal-poster clickable-poster" src="${posterUrl}" alt="${movie.title_pt}" onclick="openImageLightbox('${posterUrl.replace('/w780/', '/original/')}')">`
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
                            ${crew.map(c => `<span class="cast-item clickable" data-person="${c.name.replace(/"/g, '&quot;')}">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${cast.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Elenco</h4>
                        <div class="cast-list">
                            ${cast.map(c => `<span class="cast-item clickable" data-person="${c.name.replace(/"/g, '&quot;')}">${c.name}</span>`).join('')}
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

    // Adicionar event listeners para os nomes clicáveis
    modalBody.querySelectorAll('.cast-item.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const personName = item.dataset.person;
            if (personName) searchByPerson(personName);
        });
    });

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
                    ? `<img class="modal-poster clickable-poster" src="${posterUrl}" alt="${movie.title_pt}" onclick="openImageLightbox('${posterUrl.replace('/w780/', '/original/')}')">`
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
                            ${crew.map(c => `<span class="cast-item clickable" data-person="${c.name.replace(/"/g, '&quot;')}">${c.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${cast.length > 0 ? `
                    <div class="modal-section">
                        <h4 class="modal-section-title">Elenco</h4>
                        <div class="cast-list">
                            ${cast.map(c => `<span class="cast-item clickable" data-person="${c.name.replace(/"/g, '&quot;')}">${c.name}</span>`).join('')}
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

    // Adicionar event listeners para os nomes clicáveis
    modalBody.querySelectorAll('.cast-item.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const personName = item.dataset.person;
            if (personName) searchByPerson(personName);
        });
    });

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
// LIGHTBOX PARA IMAGEM DO POSTER
// ============================================
function openImageLightbox(imageUrl) {
    // Evitar propagação para não fechar o modal
    event.stopPropagation();

    // Criar overlay do lightbox
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-overlay" onclick="closeImageLightbox()"></div>
        <div class="lightbox-content">
            <img src="${imageUrl}" alt="Poster em tamanho grande" onclick="event.stopPropagation()">
            <button class="lightbox-close" onclick="closeImageLightbox()">✕</button>
        </div>
    `;

    document.body.appendChild(lightbox);

    // Animar entrada
    setTimeout(() => lightbox.classList.add('active'), 10);

    // Fechar com ESC
    document.addEventListener('keydown', lightboxEscHandler);
}

function lightboxEscHandler(e) {
    if (e.key === 'Escape') closeImageLightbox();
}

function closeImageLightbox() {
    const lightbox = document.querySelector('.image-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        setTimeout(() => lightbox.remove(), 300);
    }
    document.removeEventListener('keydown', lightboxEscHandler);
}

// ============================================
// BUSCAR POR PESSOA (diretor/ator)
// ============================================
function searchByPerson(name) {
    // Fechar modal
    closeModal();

    // Sempre abrir seção de busca (não toggle)
    openSearchView();

    // Preencher o campo de busca com o nome
    const searchInput = document.getElementById('search-input');
    searchInput.value = name;

    // Executar a busca
    setTimeout(() => {
        performSearch();
    }, 100);
}

// Função para sempre abrir a busca (não toggle)
function openSearchView() {
    const searchSection = document.getElementById('search-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-wrapper, #results, #list-section');

    // Se já está aberta, não fazer nada
    if (currentSearchView) {
        return;
    }

    // Fechar lista se estiver aberta
    if (currentListView) {
        currentListView = null;
    }

    currentSearchView = true;

    // Esconder conteúdo principal
    mainContent.forEach(el => el.classList.add('hidden'));

    // Mostrar busca
    searchSection.classList.remove('hidden');

    // Popular gêneros se ainda não populado
    const searchGenreSelect = document.getElementById('search-genre');
    if (searchGenreSelect && searchGenreSelect.options.length <= 1) {
        const genres = [...new Set(movies.flatMap(m => m.genres ? m.genres.split('|') : []))].sort();
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = translateGenre(genre);
            searchGenreSelect.appendChild(option);
        });
    }

    playSound('click');
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
    document.getElementById('sort-order')?.addEventListener('change', () => {
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
// BUSCA DE FILMES
// ============================================
let currentSearchView = false;
let searchResults = [];
let searchPage = 1;
const SEARCH_PER_PAGE = 12;

function populateSearchGenres() {
    const searchGenreSelect = document.getElementById('search-genre');
    const searchGenreCustomOptions = document.querySelector('.custom-select[data-target="search-genre"] .custom-select-options');
    if (!searchGenreSelect) return;

    const genres = new Set();
    movies.forEach(movie => {
        if (movie.genres) {
            movie.genres.split('|').forEach(g => genres.add(g.trim()));
        }
    });

    Array.from(genres).sort().forEach(genre => {
        // Popular select escondido
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = translateGenre(genre);
        searchGenreSelect.appendChild(option);

        // Popular custom-select
        if (searchGenreCustomOptions) {
            const customOption = document.createElement('div');
            customOption.className = 'custom-select-option';
            customOption.dataset.value = genre;
            customOption.textContent = translateGenre(genre);
            customOption.addEventListener('click', () => {
                searchGenreCustomOptions.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                customOption.classList.add('selected');
                document.querySelector('.custom-select[data-target="search-genre"] .custom-select-value').textContent = translateGenre(genre);
                searchGenreSelect.value = genre;
                customOption.closest('.custom-select').classList.remove('open');
                playSound('click');
            });
            searchGenreCustomOptions.appendChild(customOption);
        }
    });
}

function toggleSearchView() {
    const searchSection = document.getElementById('search-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-wrapper, #results, #list-section');

    if (currentSearchView) {
        closeSearchView();
        return;
    }

    // Fechar lista se estiver aberta
    if (currentListView) {
        currentListView = null;
    }

    currentSearchView = true;

    // Esconder conteúdo principal
    mainContent.forEach(el => el.classList.add('hidden'));

    // Mostrar busca
    searchSection.classList.remove('hidden');

    // Esconder botão flutuante mobile
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) mobileFab.classList.add('hidden');

    // Focar no input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.focus();
    }

    // Popular gêneros se ainda não populado
    const searchGenreSelect = document.getElementById('search-genre');
    if (searchGenreSelect && searchGenreSelect.options.length <= 1) {
        populateSearchGenres();
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    playSound('click');
}

function closeSearchView() {
    currentSearchView = false;

    const searchSection = document.getElementById('search-section');
    const mainContent = document.querySelectorAll('.filters, .roulette-wrapper');

    // Esconder busca
    searchSection.classList.add('hidden');

    // Mostrar conteúdo principal
    mainContent.forEach(el => el.classList.remove('hidden'));

    // Mostrar resultados se tiver filmes selecionados
    if (selectedMovies.length > 0) {
        document.getElementById('results').classList.remove('hidden');
    }

    // Limpar busca
    document.getElementById('search-input').value = '';
    document.getElementById('search-grid').innerHTML = '';
    document.getElementById('search-results-info').innerHTML = '';
    document.getElementById('search-pagination').innerHTML = '';
    document.getElementById('search-empty').classList.add('hidden');

    // Mostrar botão flutuante mobile
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) mobileFab.classList.remove('hidden');

    playSound('click');
}

// Normalizar texto (remover acentos)
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function performSearch() {
    const rawQuery = document.getElementById('search-input').value.trim();
    const query = normalizeText(rawQuery);
    const genre = document.getElementById('search-genre').value;
    const decade = document.getElementById('search-year').value;
    const minRating = document.getElementById('search-rating').value;
    const sortOrder = document.getElementById('search-sort').value;

    // Mostrar loading se for buscar por pessoa
    const searchBtn = document.getElementById('search-submit');
    const originalText = searchBtn.textContent;

    // Primeiro, busca local por título e diretor
    let localResults = movies.filter(movie => {
        // Filtro de palavra-chave (título PT, EN ou diretor) - normalizado sem acentos
        if (query) {
            const titlePt = normalizeText(movie.title_pt || '');
            const titleEn = normalizeText(movie.title_en || '');
            const director = normalizeText(movie.director || '');

            if (!titlePt.includes(query) && !titleEn.includes(query) && !director.includes(query)) {
                return false;
            }
        }

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
        if (minRating) {
            if (minRating === 'below5') {
                if (movie.imdb_score >= 5) return false;
            } else if (movie.imdb_score < parseFloat(minRating)) {
                return false;
            }
        }

        return true;
    });

    // Se a busca parece ser por pessoa (tem espaço ou poucos resultados locais), buscar por ator na TMDB
    let actorResults = [];
    if (query && query.includes(' ')) {
        searchBtn.textContent = '...';
        searchBtn.disabled = true;

        try {
            // Buscar pessoa na TMDB e pegar seus filmes
            const personMovies = await searchPersonMoviesWithTitles(query);

            if (personMovies.length > 0) {
                // Encontrar filmes locais que correspondem aos títulos da TMDB
                actorResults = movies.filter(movie => {
                    // Verificar se o filme está na lista de filmes do ator (normalizado)
                    const titlePt = normalizeText(movie.title_pt || '');
                    const titleEn = normalizeText(movie.title_en || '');

                    const matchesActor = personMovies.some(pm => {
                        const tmdbTitle = normalizeText(pm.title || '');
                        const tmdbOriginal = normalizeText(pm.original_title || '');
                        return titlePt === tmdbTitle ||
                               titleEn === tmdbTitle ||
                               titlePt === tmdbOriginal ||
                               titleEn === tmdbOriginal;
                    });

                    if (!matchesActor) return false;

                    // Aplicar filtros adicionais
                    if (genre && (!movie.genres || !movie.genres.includes(genre))) {
                        return false;
                    }
                    if (decade) {
                        const decadeNum = parseInt(decade);
                        if (decadeNum === 1970) {
                            if (movie.year >= 1980) return false;
                        } else {
                            if (movie.year < decadeNum || movie.year >= decadeNum + 10) return false;
                        }
                    }
                    if (minRating) {
                        if (minRating === 'below5') {
                            if (movie.imdb_score >= 5) return false;
                        } else if (movie.imdb_score < parseFloat(minRating)) {
                            return false;
                        }
                    }

                    return true;
                });
            }
        } catch (error) {
            console.error('Error searching by actor:', error);
        }

        searchBtn.textContent = originalText;
        searchBtn.disabled = false;
    }

    // Combinar resultados (local + ator), removendo duplicatas
    const combinedMap = new Map();
    [...localResults, ...actorResults].forEach(movie => {
        combinedMap.set(movie.imdb_id, movie);
    });
    searchResults = Array.from(combinedMap.values());

    // Ordenar conforme selecionado
    if (sortOrder === 'desc') {
        searchResults.sort((a, b) => b.imdb_score - a.imdb_score);
    } else if (sortOrder === 'asc') {
        searchResults.sort((a, b) => a.imdb_score - b.imdb_score);
    } else if (sortOrder === 'year-desc') {
        searchResults.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortOrder === 'year-asc') {
        searchResults.sort((a, b) => (a.year || 0) - (b.year || 0));
    }
    // Se sortOrder vazio, mantém ordem original (sem ordenação)

    searchPage = 1;
    displaySearchResults();
    playSound('click');
}

// Buscar filmes de uma pessoa na TMDB (retorna títulos para match local)
async function searchPersonMoviesWithTitles(personName) {
    try {
        // Buscar pessoa pelo nome
        const searchResponse = await fetch(
            `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(personName)}&language=pt-BR`,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.TMDB_TOKEN}`,
                    'accept': 'application/json'
                }
            }
        );

        const searchData = await searchResponse.json();

        if (!searchData.results || searchData.results.length === 0) {
            return [];
        }

        // Pegar o primeiro resultado (mais relevante)
        const personId = searchData.results[0].id;

        // Buscar créditos de filmes dessa pessoa
        const creditsResponse = await fetch(
            `https://api.themoviedb.org/3/person/${personId}/movie_credits?language=pt-BR`,
            {
                headers: {
                    'Authorization': `Bearer ${CONFIG.TMDB_TOKEN}`,
                    'accept': 'application/json'
                }
            }
        );

        const creditsData = await creditsResponse.json();

        // Combinar cast e crew para pegar todos os filmes
        const allMovies = [
            ...(creditsData.cast || []),
            ...(creditsData.crew || [])
        ];

        // Retornar filmes com título para match
        return allMovies.map(m => ({
            title: m.title,
            original_title: m.original_title
        }));
    } catch (error) {
        console.error('Error searching person movies:', error);
        return [];
    }
}

async function displaySearchResults() {
    const grid = document.getElementById('search-grid');
    const info = document.getElementById('search-results-info');
    const pagination = document.getElementById('search-pagination');
    const emptyMsg = document.getElementById('search-empty');

    if (searchResults.length === 0) {
        grid.innerHTML = '';
        info.innerHTML = '';
        pagination.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    // Calcular paginação
    const totalPages = Math.ceil(searchResults.length / SEARCH_PER_PAGE);
    const start = (searchPage - 1) * SEARCH_PER_PAGE;
    const end = start + SEARCH_PER_PAGE;
    const pageResults = searchResults.slice(start, end);

    // Info
    info.innerHTML = `<span class="search-count">${searchResults.length} filme${searchResults.length !== 1 ? 's' : ''} encontrado${searchResults.length !== 1 ? 's' : ''}</span>`;

    // Loading
    grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    // Gerar cards
    const cards = await Promise.all(pageResults.map(async (movie) => {
        const details = await fetchMovieDetails(movie.imdb_id);

        const posterUrl = details?.poster_path
            ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
            : null;

        return `
            <div class="search-card" data-imdb="${movie.imdb_id}" data-rating="★ ${movie.imdb_score}" onclick="openModalByImdbId('${movie.imdb_id}')">
                <div class="search-poster-wrapper">
                    ${posterUrl
                        ? `<img class="search-poster" src="${posterUrl}" alt="${movie.title_pt}" loading="lazy">`
                        : `<div class="no-poster search-poster"></div>`
                    }
                </div>
                <div class="search-info">
                    <h3 class="search-title">${movie.title_pt}</h3>
                    <div class="search-meta">
                        <span>${movie.year}</span>
                        ${movie.director ? `<span>• ${movie.director}</span>` : ''}
                    </div>
                    <div class="search-actions">
                        <button class="action-btn watched ${isWatched(movie.imdb_id) ? 'active' : ''}"
                                onclick="event.stopPropagation(); handleSearchWatchedClick(event, '${movie.imdb_id}')">
                            <span class="icon">${isWatched(movie.imdb_id) ? '✓' : '👁'}</span>
                        </button>
                        <button class="action-btn watchlist ${isInWatchlist(movie.imdb_id) ? 'active' : ''}"
                                onclick="event.stopPropagation(); handleSearchWatchlistClick(event, '${movie.imdb_id}')">
                            <span class="icon">${isInWatchlist(movie.imdb_id) ? '★' : '☆'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }));

    grid.innerHTML = cards.join('');

    // Ativar lazy loading para as novas imagens
    setupLazyImages(grid);

    // Paginação
    if (totalPages > 1) {
        let paginationHtml = '<div class="pagination-buttons">';

        // Botão anterior
        if (searchPage > 1) {
            paginationHtml += `<button class="pagination-btn" onclick="searchGoToPage(${searchPage - 1})">◀ Anterior</button>`;
        }

        // Info da página
        paginationHtml += `<span class="pagination-info">Página ${searchPage} de ${totalPages}</span>`;

        // Botão próximo
        if (searchPage < totalPages) {
            paginationHtml += `<button class="pagination-btn" onclick="searchGoToPage(${searchPage + 1})">Próxima ▶</button>`;
        }

        paginationHtml += '</div>';
        pagination.innerHTML = paginationHtml;
    } else {
        pagination.innerHTML = '';
    }
}

function searchGoToPage(page) {
    searchPage = page;
    displaySearchResults();

    // Scroll para o topo da seção
    const searchSection = document.getElementById('search-section');
    if (searchSection) {
        searchSection.scrollIntoView({ behavior: 'smooth' });
    }

    playSound('click');
}

async function handleSearchWatchedClick(event, imdbId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    btn.disabled = true;

    const added = await toggleWatched(imdbId);

    btn.classList.toggle('active', added);
    btn.querySelector('.icon').textContent = added ? '✓' : '👁';
    btn.disabled = false;

    updateListCounts();

    if (added) {
        showPowerUp('WATCHED!');
    }
}

async function handleSearchWatchlistClick(event, imdbId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    btn.disabled = true;

    const added = await toggleWatchlist(imdbId);

    btn.classList.toggle('active', added);
    btn.querySelector('.icon').textContent = added ? '★' : '☆';
    btn.disabled = false;

    updateWatchlistCount();

    if (added) {
        showPowerUp('+1 WATCHLIST!');
    }
}

console.log('%c🎬 ROLETA DE FILMES 🎬', 'font-size: 24px; color: #00fff5; text-shadow: 2px 2px #ff00ff;');
console.log('%cTry the Konami Code! ↑↑↓↓←→←→BA', 'color: #ffff00;');
