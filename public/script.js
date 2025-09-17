document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('movieForm');
    const loading = document.getElementById('loading');
    const categoryButtons = document.querySelectorAll('.category-btn');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const movieQuery = document.getElementById('movieSearch').value.trim();
        
        if (!movieQuery) {
            showNotification('Veuillez entrer un nom de film', 'error');
            return;
        }
        
        if (movieQuery.length < 2) {
            showNotification('Veuillez entrer au moins 2 caractères', 'error');
            return;
        }
        
        loading.style.display = 'block';
        showNotification(`Recherche de "${movieQuery}"...`, 'info');
        
        window.location.href = `/search=${encodeURIComponent(movieQuery)}`;
    });
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.dataset.category;
            const categoryText = this.querySelector('.category-text').textContent;
            
            loading.style.display = 'block';
            showNotification(`Chargement des films ${categoryText.toLowerCase()}...`, 'info');
            
            window.location.href = `/fetch=${category}`;
        });
    });
});
