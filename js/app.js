// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')  // ✅ relatif terhadap halaman saat ini
      .then(registration => {
        console.log('[PWA] ServiceWorker registered:', registration.scope);
      })
      .catch(error => {
        console.log('[PWA] ServiceWorker registration failed:', error);
      });
  });
}

// PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('[PWA] Install prompt triggered');
  deferredPrompt = e;
});

// Fungsi untuk install PWA
async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User choice: ${outcome}`);
    deferredPrompt = null;
  }
}

// Close menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        const navMenu = document.querySelector('.nav-menu');
        const hamburger = document.querySelector('.hamburger-menu');
        
        if (navMenu && hamburger) {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
});

// ===== MOBILE MENU TOGGLE =====

// Toggle Mobile Menu
function toggleMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger-menu');
    
    if (!navMenu || !hamburger) {
        console.log('Menu elements not found');
        return;
    }
    
    // Buat overlay jika belum ada
    let overlay = document.querySelector('.menu-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'menu-overlay';
        document.body.appendChild(overlay);
        
        // Klik overlay untuk tutup menu
        overlay.addEventListener('click', function() {
            closeMenu();
        });
    }
    
    // Toggle menu
    const isActive = navMenu.classList.contains('active');
    
    if (isActive) {
        closeMenu();
    } else {
        openMenu();
    }
}

function openMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger-menu');
    const overlay = document.querySelector('.menu-overlay');
    
    if (navMenu) navMenu.classList.add('active');
    if (hamburger) hamburger.classList.add('active');
    if (overlay) overlay.classList.add('active');
    
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger-menu');
    const overlay = document.querySelector('.menu-overlay');
    
    if (navMenu) navMenu.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    document.body.style.overflow = '';
}

// Close menu when clicking link
document.addEventListener('click', function(e) {
    if (e.target.matches('.nav-menu a')) {
        closeMenu();
    }
});

// Close menu with ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMenu();
    }
});