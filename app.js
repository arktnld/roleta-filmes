/**
 * Roleta de Filmes - 16bit Edition
 * Uma experiência mágica e divertida para escolher filmes!
 */

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
    TMDB_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmMTE5OTFiNjk5ZGIzYTk5NzhjOTVmYThkOGM5MWM0NiIsIm5iZiI6MTc0NTk1MDE0My45NzYsInN1YiI6IjY4MTExNWJmMjEzN2YzNGMyNGVhZDY4ZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.6yHJrMiDYHRrIlA9Fy9q5qikkGmjnVK23cBuYc-aJ-k',
    TMDB_IMG_BASE: 'https://image.tmdb.org/t/p/w500',
    MOVIES_PER_SPIN: 3,
    MAX_MOVIES_PER_SPIN: 9, // Limite máximo para não sobrecarregar a API
    HISTORY_CACHE_SIZE: 30, // Quantidade de filmes no cache circular
    ROULETTE_DURATION: 2000, // ms
    ROULETTE_FLASHES: 15
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
    try {
        const response = await fetch('movies.json');
        movies = await response.json();
        filteredMovies = [...movies];
        populateFilters();
        console.log(`Loaded ${movies.length} movies`);
        showPowerUp(`${movies.length} FILMES!`);
    } catch (error) {
        console.error('Error loading movies:', error);
        showPowerUp('ERROR LOADING!');
    }
}

// ============================================
// POPULAR FILTROS
// ============================================
function populateFilters() {
    const genreSelect = document.getElementById('genre');
    const genres = new Set();

    movies.forEach(movie => {
        if (movie.genres) {
            movie.genres.split('|').forEach(g => genres.add(g.trim()));
        }
    });

    Array.from(genres).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreSelect.appendChild(option);
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
        const preview = document.createElement('div');
        preview.className = 'roulette-preview';

        // Criar slots dinamicamente
        let slotsHtml = '<div class="roulette-title">SPINNING...</div>';
        for (let i = 1; i <= moviesCount; i++) {
            slotsHtml += `<div class="roulette-slot" id="slot${i}">???</div>`;
        }
        preview.innerHTML = slotsHtml;
        document.body.appendChild(preview);

        let flashCount = 0;
        const maxFlashes = CONFIG.ROULETTE_FLASHES;

        const interval = setInterval(() => {
            // Mostrar filmes aleatórios rapidamente
            const randomMovies = getRandomMovies(moviesCount);
            for (let i = 1; i <= moviesCount; i++) {
                document.getElementById(`slot${i}`).textContent = randomMovies[i - 1]?.title_pt || '???';
            }

            playSound('spin');
            flashCount++;

            // Diminuir velocidade gradualmente
            if (flashCount >= maxFlashes) {
                clearInterval(interval);

                // Mostrar resultado final
                for (let i = 1; i <= moviesCount; i++) {
                    document.getElementById(`slot${i}`).textContent = selectedMovies[i - 1]?.title_pt || '???';
                }

                playSound('reveal');

                setTimeout(() => {
                    preview.remove();
                    resolve();
                }, 500);
            }
        }, CONFIG.ROULETTE_DURATION / maxFlashes);
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

    let label = 'SUPER STAR!';
    if (rating < 5) {
        label = 'GAME OVER';
    } else if (rating < 7) {
        label = 'NICE!';
    } else if (rating < 8) {
        label = 'GREAT!';
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

    const cards = await Promise.all(selectedMovies.map(async (movie, index) => {
        const details = await fetchMovieDetails(movie.imdb_id);

        const posterUrl = details?.poster_path
            ? `${CONFIG.TMDB_IMG_BASE}${details.poster_path}`
            : null;

        const overview = details?.overview || 'No description available.';
        const genres = details?.genres?.map(g => g.name) || movie.genres?.split('|') || [];

        return `
            <div class="movie-card" onclick="openModal(${index})" data-index="${index}">
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
                        ${genres.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('')}
                    </div>
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
                        ${(details?.genres || []).map(g => `<span class="genre-tag">${g.name}</span>`).join('')}
                    </div>
                </div>
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

console.log('%c🎬 ROLETA DE FILMES 🎬', 'font-size: 24px; color: #00fff5; text-shadow: 2px 2px #ff00ff;');
console.log('%cTry the Konami Code! ↑↑↓↓←→←→BA', 'color: #ffff00;');
