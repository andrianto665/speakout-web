// ============================================
// 📁 FILE: js/auth.js
// 🎯 Fungsi: Handle Login, Register, Logout
// ============================================

// 🔐 LOGIN HANDLER
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.querySelector('#loginForm .login-btn');
    
    const originalBtnText = btn?.textContent || 'Login';
    if (btn) {
        btn.textContent = 'Logging in...';
        btn.disabled = true;
    }

    try {
        const result = await api.login(email, password);
        console.log('🔹 Login Response:', result);

        if (result.success) {
            const role = api.getUserRole();
            const targetPage = role === 'admin' ? 'admin.html' : 'dashboard.html';
            window.location.href = targetPage;
        } else {
            const errorMsg = result.data?.message || result.data?.errors?.email?.[0] || 'Login failed. Please check your credentials.';
            alert('⚠️ ' + errorMsg);
        }
    } catch (error) {
        console.error('❌ Login Error:', error);
        alert('🌐 Connection error. Make sure Laravel API is running at http://localhost:8000');
    } finally {
        if (btn) {
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    }
});

// 📝 REGISTER HANDLER - ✅ FIXED
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const messageDiv = document.getElementById('message');
    
    // ✅ FIXED: Gunakan .register-btn, BUKAN .login-btn
    const btn = document.querySelector('#registerForm .register-btn');

    // ✅ Validasi frontend
    if (!name || !email || !password) {
        if (messageDiv) {
            messageDiv.style.color = '#E53935';
            messageDiv.textContent = '⚠️ Please fill in all fields.';
        }
        return;
    }

    // ✅ Validasi confirm password
    if (password !== confirmPassword) {
        if (messageDiv) {
            messageDiv.style.color = '#E53935';
            messageDiv.textContent = '⚠️ Passwords do not match!';
        }
        return;
    }

    // ✅ Validasi panjang password
    if (password.length < 6) {
        if (messageDiv) {
            messageDiv.style.color = '#E53935';
            messageDiv.textContent = '⚠️ Password must be at least 6 characters!';
        }
        return;
    }

    const originalBtnText = btn?.textContent || 'Register';
    if (btn) {
        btn.textContent = 'Registering...';
        btn.disabled = true;
    }

    // ✅ CLEAR localStorage sebelum register (PENTING!)
    localStorage.removeItem('speakout_token');
    localStorage.removeItem('speakout_user');

    try {
        const result = await api.register(name, email, password);
        console.log('🔹 Register Response:', result);

        if (result.success) {
            if (messageDiv) {
                messageDiv.style.color = '#10b981';
                messageDiv.textContent = '✅ Registration successful! Redirecting to login...';
            }
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            const errors = result.data?.errors;
            let errorMsg = 'Registration failed.';
            
            if (errors) {
                const firstError = Object.values(errors)[0]?.[0];
                errorMsg = firstError || errorMsg;
            } else if (result.data?.message) {
                errorMsg = result.data.message;
            }
            
            if (messageDiv) {
                messageDiv.style.color = '#E53935';
                messageDiv.textContent = '⚠️ ' + errorMsg;
            }
        }
    } catch (error) {
        console.error('❌ Register Error:', error);
        if (messageDiv) {
            messageDiv.style.color = '#E53935';
            messageDiv.textContent = '🌐 Connection error. Please try again.';
        }
    } finally {
        if (btn) {
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    }
});

// 🚪 LOGOUT HANDLER
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        api.logout();
    }
}