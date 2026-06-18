/**
 * ❤️ Favorites Manager - SpeakOut
 * Simpan course favorit di localStorage
 */

const FavoritesManager = {
    STORAGE_KEY: 'speakout_favorites',
    
    // Ambil semua favorit dari localStorage
    getFavorites() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },
    
    // Cek apakah course sudah di-favorit
    isFavorite(courseId) {
        const favorites = this.getFavorites();
        return favorites.includes(courseId);
    },
    
    // Toggle favorit (tambah/hapus)
    toggle(courseId, btn) {
        let favorites = this.getFavorites();
        
        if (this.isFavorite(courseId)) {
            // Hapus dari favorit
            favorites = favorites.filter(id => id !== courseId);
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = '🤍';
            }
            this.showNotification('💔 Dihapus dari favorit', 'warning');
        } else {
            // Tambah ke favorit
            favorites.push(courseId);
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = '❤️';
            }
            this.showNotification('❤️ Ditambahkan ke favorit!', 'success');
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        this.updateFavoritesCount();
    },
    
    // Tambah tombol favorit ke course card
    addFavoriteButton(card, courseId) {
        // Cek apakah sudah ada tombol
        if (card.querySelector('.favorite-btn')) return;
        
        const isFav = this.isFavorite(courseId);
        
        const btn = document.createElement('button');
        btn.className = 'favorite-btn' + (isFav ? ' active' : '');
        btn.innerHTML = isFav ? '❤️' : '🤍';
        btn.setAttribute('aria-label', 'Toggle favorite');
        
        // Klik tombol
        btn.onclick = (e) => {
            e.stopPropagation(); // Jangan trigger click card
            this.toggle(courseId, btn);
        };
        
        // Tambah ke card (cari thumbnail atau image container)
        const thumbnail = card.querySelector('.course-thumbnail, .course-image, .teacher-photo-container');
        if (thumbnail) {
            thumbnail.style.position = 'relative';
            thumbnail.appendChild(btn);
        } else {
            card.style.position = 'relative';
            card.appendChild(btn);
        }
    },
    
    // Update counter favorit (optional)
    updateFavoritesCount() {
        const count = this.getFavorites().length;
        console.log(`❤️ Total favorites: ${count}`);
    },
    
    // Show notification
    showNotification(message, type = 'success') {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(message);
        }
    },
    
    // Render daftar favorit (untuk halaman khusus)
    renderFavoritesList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const favorites = this.getFavorites();
        
        if (favorites.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--gray);">Belum ada course favorit</p>';
            return;
        }
        
        // Fetch course details dari API
        this.fetchCourseDetails(favorites).then(courses => {
            container.innerHTML = '';
            courses.forEach(course => {
                const card = this.createFavoriteCard(course);
                container.appendChild(card);
            });
        });
    },
    
    // Fetch course details dari API
    async fetchCourseDetails(courseIds) {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/courses');
            const allCourses = await response.json();
            return allCourses.filter(c => courseIds.includes(c.id));
        } catch (error) {
            console.error('Error fetching courses:', error);
            return [];
        }
    },
    
    // Buat card favorit
    createFavoriteCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <div class="course-content">
                <h3>${course.title}</h3>
                <p>${course.instructor}</p>
                <a href="course-details.html?course_id=${course.id}" class="btn-view">Lihat Course →</a>
            </div>
        `;
        return card;
    },
    
    // Init - jalan otomatis saat halaman load
    init() {
        console.log('❤️ Favorites Manager initialized');
        
        // Tambah tombol favorit ke semua course cards
        const observer = new MutationObserver(() => {
            const courseCards = document.querySelectorAll('.course-card');
            courseCards.forEach(card => {
                // Coba ambil course ID dari card
                const onclick = card.getAttribute('onclick') || '';
                const match = onclick.match(/course_id=(\d+)/);
                const courseId = match ? parseInt(match[1]) : null;
                
                if (courseId) {
                    this.addFavoriteButton(card, courseId);
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FavoritesManager.init());
} else {
    FavoritesManager.init();
}