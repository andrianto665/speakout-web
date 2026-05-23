// ============================================
// 📁 FILE: js/auth.js
// 🎯 Fungsi: Handle Login, Register, Logout
// ============================================

// 🔐 LOGIN HANDLER
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah reload halaman

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.querySelector('#loginForm .login-btn');
    
    // Simpan text asli tombol & tampilkan loading
    const originalBtnText = btn.textContent;
    btn.textContent = 'Logging in...';
    btn.disabled = true;

    try {
        // Panggil API login dari api.js
        const result = await api.login(email, password);
        
        console.log('🔹 Login Response:', result); // Debug: cek di Console (F12)

        if (result.success) {
            // ✅ Login berhasil
            const role = api.getUserRole();
            const targetPage = role === 'admin' ? 'admin.html' : 'dashboard.html';
            
            // Optional: tampilkan pesan sukses singkat
            // alert('Welcome back!');
            
            // Redirect ke halaman tujuan
            window.location.href = targetPage;
        } else {
            // ❌ Login gagal (email/password salah, dll)
            const errorMsg = result.data?.message || result.data?.errors?.email?.[0] || 'Login failed. Please check your credentials.';
            alert('⚠️ ' + errorMsg);
        }
    } catch (error) {
        // ❌ Error jaringan / server down
        console.error('❌ Login Error:', error);
        alert('🌐 Connection error. Make sure Laravel API is running at http://localhost:8000');
    } finally {
        // Kembalikan tombol ke keadaan semula
        btn.textContent = originalBtnText;
        btn.disabled = false;
    }
});

// 📝 REGISTER HANDLER
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const btn = document.querySelector('#registerForm .login-btn'); // atau .register-btn

    if (!name || !email || !password) {
        alert('⚠️ Please fill in all fields.');
        return;
    }

    const originalBtnText = btn?.textContent || 'Register';
    if (btn) {
        btn.textContent = 'Registering...';
        btn.disabled = true;
    }

    try {
        const result = await api.register(name, email, password);
        
        console.log('🔹 Register Response:', result);

        if (result.success) {
            alert('✅ Registration successful! Please log in.');
            window.location.href = 'index.html';
        } else {
            // Handle validation errors dari Laravel
            const errors = result.data?.errors;
            if (errors) {
                const firstError = Object.values(errors)[0]?.[0];
                alert('⚠️ ' + firstError);
            } else {
                const errorMsg = result.data?.message || 'Registration failed.';
                alert('⚠️ ' + errorMsg);
            }
        }
    } catch (error) {
        console.error('❌ Register Error:', error);
        alert('🌐 Connection error. Please try again.');
    } finally {
        if (btn) {
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    }
});

// 🚪 LOGOUT HANDLER (bisa dipanggil dari dashboard.html / admin.html)
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        api.logout(); // Fungsi logout sudah ada di api.js
        // Setelah logout, api.js akan redirect ke index.html
    }
}

// 🔁 Auto-check: Jika user sudah login dan buka index.html, redirect ke dashboard
document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');
    
    if (api.isLoggedIn() && isLoginPage) {
        const role = api.getUserRole();
        window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
    }
});