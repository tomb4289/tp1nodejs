document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    const type = urlParams.get('type');
    const search = urlParams.get('search');
    
    if (movieId) {
        loadMovieDetails(movieId);
    } else if (type) {
        loadMoviesByType(type);
    } else if (search) {
        loadSearchResults(search);
    } else {
        showError('ID de film, type ou recherche manquant dans l\'URL');
    }
});

async function loadMovieDetails(movieId) {
    try {
        const response = await fetch(`/data/${movieId}`);
        
        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const movie = await response.json();
        displayMovieDetails(movie);
        showNotification('Film chargé avec succès!', 'success');
        
    } catch (error) {
        console.error('Error loading movie details:', error);
        showError(`Erreur lors du chargement: ${error.message}`);
        showNotification('Erreur lors du chargement du film', 'error');
    }
}

function displayMovieDetails(movie) {
    const loading = document.getElementById('loading');
    const movieDetails = document.getElementById('movieDetails');
    
    loading.style.display = 'none';
    
    const posterUrl = movie.poster_path 
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=Image+non+disponible';
    
    const backdropUrl = movie.backdrop_path 
        ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
        : '';
    
    const formatCurrency = (amount) => {
        if (!amount || amount === 0) return 'Non disponible';
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };
    
    const formatDate = (dateString) => {
        if (!dateString) return 'Non disponible';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    movieDetails.innerHTML = `
        <div class="container">
            <div class="movie-detail-grid">
                <div class="movie-poster-section">
                    <img src="${posterUrl}" alt="${movie.title}" class="movie-poster-large">
                </div>
                
                <div class="movie-info-section">
                    <h1 class="movie-title-large">${movie.title}</h1>
                    ${movie.original_title !== movie.title ? `<p class="movie-original-title">${movie.original_title}</p>` : ''}
                    
                    <div class="movie-meta-grid">
                        <div class="meta-item">
                            <span class="meta-label">📅 Date de sortie</span>
                            <span class="meta-value">${formatDate(movie.release_date)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">⏱️ Durée</span>
                            <span class="meta-value">${movie.runtime ? movie.runtime + ' minutes' : 'Non disponible'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">⭐ Note</span>
                            <span class="meta-value rating">${movie.vote_average}/10</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">🗳️ Votes</span>
                            <span class="meta-value">${movie.vote_count ? movie.vote_count.toLocaleString('fr-FR') : 'Non disponible'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">💰 Budget</span>
                            <span class="meta-value">${formatCurrency(movie.budget)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">💵 Recettes</span>
                            <span class="meta-value">${formatCurrency(movie.revenue)}</span>
                        </div>
                    </div>
                    
                    ${movie.genres && movie.genres.length > 0 ? `
                    <div class="genres-section">
                        <h3 class="genres-title">Genres</h3>
                        <div class="genres-list">
                            ${movie.genres.map(genre => `<span class="genre-badge">${genre.name}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${movie.overview ? `
                    <div class="overview-section">
                        <h3 class="overview-title">Synopsis</h3>
                        <p class="overview-text">${movie.overview}</p>
                    </div>
                    ` : ''}
                    
                    <div class="production-section">
                        <h3 class="production-title">Informations de production</h3>
                        ${movie.production_companies && movie.production_companies.length > 0 ? `
                        <div class="production-item">
                            <div class="production-label">🏢 Sociétés de production</div>
                            <div class="production-value">${movie.production_companies.map(company => company.name).join(', ')}</div>
                        </div>
                        ` : ''}
                        ${movie.production_countries && movie.production_countries.length > 0 ? `
                        <div class="production-item">
                            <div class="production-label">🌍 Pays d'origine</div>
                            <div class="production-value">${movie.production_countries.map(country => country.name).join(', ')}</div>
                        </div>
                        ` : ''}
                        ${movie.spoken_languages && movie.spoken_languages.length > 0 ? `
                        <div class="production-item">
                            <div class="production-label">🗣️ Langues</div>
                            <div class="production-value">${movie.spoken_languages.map(lang => lang.name).join(', ')}</div>
                        </div>
                        ` : ''}
                        ${movie.status ? `
                        <div class="production-item">
                            <div class="production-label">📊 Statut</div>
                            <div class="production-value">${movie.status}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${backdropUrl ? `
            <div class="backdrop-section">
                <div class="backdrop-large" style="background-image: url('${backdropUrl}')">
                    <div class="backdrop-content-large">
                        <h2 class="backdrop-title">${movie.tagline || movie.title}</h2>
                        ${movie.overview ? `<p class="backdrop-overview">${movie.overview}</p>` : ''}
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    movieDetails.style.display = 'block';
}

async function loadMoviesByType(type) {
    try {
        const response = await fetch(`/data/type/${type}`);
        
        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        displayMoviesGrid(data.results, type);
        showNotification('Films chargés avec succès!', 'success');
        
    } catch (error) {
        console.error('Error loading movies:', error);
        showError(`Erreur lors du chargement: ${error.message}`);
        showNotification('Erreur lors du chargement des films', 'error');
    }
}

function displayMoviesGrid(movies, type) {
    const loading = document.getElementById('loading');
    const moviesHeader = document.getElementById('moviesHeader');
    const moviesGrid = document.getElementById('moviesGrid');
    
    loading.style.display = 'none';
    
    const typeNames = {
        'popular': 'Populaires',
        'toprated': 'Mieux notés',
        'nowplaying': 'Au cinéma'
    };
    
    const typeDescriptions = {
        'popular': 'Les films les plus populaires du moment',
        'toprated': 'Les films avec les meilleures notes',
        'nowplaying': 'Les films actuellement au cinéma'
    };
    
    document.getElementById('moviesTitle').textContent = `Films ${typeNames[type]}`;
    document.getElementById('moviesSubtitle').textContent = typeDescriptions[type];
    moviesHeader.style.display = 'block';
    
    const movieCards = movies.map(movie => createMovieCard(movie)).join('');
    moviesGrid.innerHTML = movieCards;
    moviesGrid.style.display = 'grid';
}

function createMovieCard(movie) {
    const posterUrl = movie.poster_path 
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=Image+non+disponible';
    
    const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
    
    return `
        <div class="movie-card" onclick="window.location.href='/fetch=${movie.id}'">
            <div class="movie-card-poster">
                <img src="${posterUrl}" alt="${movie.title}" loading="lazy">
                <div class="movie-card-overlay">
                    <button class="movie-card-details-btn">Voir les détails</button>
                </div>
            </div>
            <div class="movie-card-info">
                <h3 class="movie-card-title">${movie.title}</h3>
                <p class="movie-card-overview">${movie.overview || 'Aucun synopsis disponible.'}</p>
                <div class="movie-card-meta">
                    <span class="movie-card-year">${releaseYear}</span>
                    <div class="movie-card-rating">
                        <span class="rating-star">⭐</span>
                        <span>${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadSearchResults(query) {
    try {
        const response = await fetch(`/data/search/${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.results || !Array.isArray(data.results)) {
            throw new Error('Format de données invalide reçu du serveur');
        }
        
        if (data.results.length === 0) {
            showNoResults(query);
            return;
        }
        
        displayMoviesGrid(data.results, 'search', query);
        showNotification(`Résultats trouvés pour "${query}"!`, 'success');
        
    } catch (error) {
        console.error('Error loading search results:', error);
        showError(`Erreur lors de la recherche: ${error.message}`);
        showNotification('Erreur lors de la recherche', 'error');
    }
}

function showNoResults(query) {
    const loading = document.getElementById('loading');
    const moviesHeader = document.getElementById('moviesHeader');
    const moviesGrid = document.getElementById('moviesGrid');
    
    loading.style.display = 'none';
    
    document.getElementById('moviesTitle').textContent = `Aucun résultat pour "${query}"`;
    document.getElementById('moviesSubtitle').textContent = 'Essayez avec d\'autres mots-clés';
    moviesHeader.style.display = 'block';
    
    moviesGrid.innerHTML = `
        <div class="no-results">
            <div class="no-results-icon">🔍</div>
            <h3>Aucun film trouvé</h3>
            <p>Essayez de modifier votre recherche ou utilisez les catégories ci-dessous.</p>
            <a href="/" class="btn btn-primary">Retour à l'accueil</a>
        </div>
    `;
    moviesGrid.style.display = 'block';
}

function displayMoviesGrid(movies, type, query = '') {
    const loading = document.getElementById('loading');
    const moviesHeader = document.getElementById('moviesHeader');
    const moviesGrid = document.getElementById('moviesGrid');
    
    loading.style.display = 'none';
    
    const typeNames = {
        'popular': 'Populaires',
        'toprated': 'Mieux notés',
        'nowplaying': 'Au cinéma',
        'search': `Résultats pour "${query}"`
    };
    
    const typeDescriptions = {
        'popular': 'Les films les plus populaires du moment',
        'toprated': 'Les films avec les meilleures notes',
        'nowplaying': 'Les films actuellement au cinéma',
        'search': `Films correspondant à votre recherche`
    };
    
    document.getElementById('moviesTitle').textContent = typeNames[type];
    document.getElementById('moviesSubtitle').textContent = typeDescriptions[type];
    moviesHeader.style.display = 'block';
    
    const movieCards = movies.map(movie => createMovieCard(movie)).join('');
    moviesGrid.innerHTML = movieCards;
    moviesGrid.style.display = 'grid';
}

function showError(message) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    
    loading.style.display = 'none';
    error.innerHTML = `
        <div class="error-icon">⚠️</div>
        <h3 class="error-title">Erreur de chargement</h3>
        <p class="error-message">${message}</p>
    `;
    error.style.display = 'block';
}
