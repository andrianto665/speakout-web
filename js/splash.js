/**
 * Splash Screen Controller
 * Force reset dulu baru hide — agar cache SW tidak membekukan state hidden
 */

// ✅ IIFE: jalan LANGSUNG saat script dibaca, sebelum apapun
// Paksa splash kembali visible, buang state lama dari cache
(function () {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.classList.remove('hidden');
    splash.style.removeProperty('display');
})();

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.classList.add('hidden');
    setTimeout(() => { splash.style.display = 'none'; }, 500);
}

if (document.readyState === 'complete') {
    setTimeout(hideSplashScreen, 3000); // ← ganti 1500 jadi 3000
} else {
    window.addEventListener('load', () => {
        setTimeout(hideSplashScreen, 3000); // ← ganti 1500 jadi 3000
    });
}