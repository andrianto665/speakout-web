/**
 * Splash Screen Controller
 * Handle show/hide splash screen
 */

// Hide splash screen setelah semua resource load
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    
    // Minimal tampil 1.5 detik
    setTimeout(() => {
        hideSplashScreen();
    }, 1500);
});

/**
 * Hide splash screen dengan animasi
 */
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    
    if (splash) {
        splash.classList.add('hidden');
        
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}