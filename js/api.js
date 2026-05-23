/**
 * 📁 FILE: js/api.js
 * 🎯 Service untuk komunikasi dengan Laravel API
 * ✅ Compatible dengan js/auth.js & js/dashboard.js
 */

// 🔹 Konfigurasi Base URL (Auto-detect environment)
const getApiBaseUrl = () => {
    // Jika dijalankan di Android Emulator, gunakan 10.0.2.2
    // Jika di Web/Desktop, gunakan localhost/127.0.0.1
    // Jika di Production, ganti dengan domain asli
    const isAndroidEmulator = typeof navigator !== 'undefined' && 
                              navigator.userAgent.includes('Android');
    
    if (isAndroidEmulator) return 'http://10.0.2.2:8000/api';
    return 'http://127.0.0.1:8000/api'; // Lebih stabil daripada 'localhost'
};

const API_BASE = getApiBaseUrl();
const API_TIMEOUT = 15000; // 15 detik timeout

const api = {
    // ========== TOKEN MANAGEMENT ==========
    
    getToken() {
        return localStorage.getItem('speakout_token');
    },
    
    setToken(token) {
        if (!token) return;
        localStorage.setItem('speakout_token', token);
    },
    
    clearToken() {
        localStorage.removeItem('speakout_token');
        localStorage.removeItem('speakout_user');
    },
    
    isLoggedIn() {
        return !!this.getToken();
    },
    
    // ========== USER & ROLE ==========
    
    getUser() {
        try {
            const userStr = localStorage.getItem('speakout_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    },
    
    getUserRole() {
        const user = this.getUser();
        // Default ke 'user' jika role tidak ditemukan
        return user?.role || 'user'; 
    },
    
    // ========== HELPER: FETCH WITH TIMEOUT ==========
    
    async _fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Server is taking too long to respond.');
            }
            throw error;
        }
    },
    
    // ========== AUTH METHODS ==========
    
    /**
     * Register user baru
     * @returns {Promise<{success: boolean, data: object}>}
     */
    async register(name, email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    password_confirmation: password // Laravel butuh konfirmasi password
                })
            });
            
            const data = await response.json();
            
            return {
                success: response.ok,
                data,
                status: response.status
            };
            
        } catch (error) {
            console.error('❌ Register API Error:', error);
            return {
                success: false,
                data: { message: error.message || 'Network error. Please check your connection.' },
                status: 0
            };
        }
    },
    
    /**
     * Login user
     * @returns {Promise<{success: boolean, data: object}>}
     */
    async login(email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                // Simpan token dan user info ke localStorage
                this.setToken(data.token);
                
                // Simpan data user (termasuk role)
                if (data.user) {
                    localStorage.setItem('speakout_user', JSON.stringify(data.user));
                }
            }
            
            return {
                success: response.ok,
                data,
                status: response.status
            };
            
        } catch (error) {
            console.error('❌ Login API Error:', error);
            return {
                success: false,
                data: { message: error.message || 'Network error. Is Laravel running?' },
                status: 0
            };
        }
    },
    
    /**
     * Logout user
     */
    async logout() {
        const token = this.getToken();
        
        // Optional: Notify backend tentang logout
        if (token) {
            try {
                await this._fetchWithTimeout(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                // Ignore error, tetap logout di frontend
                console.warn('⚠️ Backend logout failed, clearing local session anyway');
            }
        }
        
        this.clearToken();
        window.location.href = 'index.html';
    },
    
    // ========== COURSE METHODS ==========
    
    /**
     * Get semua courses (butuh auth)
     * @returns {Promise<Array>}
     */
    async getCourses() {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No token found. Please login first.');
            return [];
        }
        
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/courses`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Jika 401 Unauthorized, token mungkin expired
                if (response.status === 401) {
                    this.clearToken();
                    window.location.href = 'index.html';
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Courses Error:', error);
            return [];
        }
    },
    
    /**
     * Update progress course (butuh auth) - METHOD POST
     * @param {number} courseId 
     * @param {number} progress (0-100)
     * @returns {Promise<object>}
     */
    async updateProgress(courseId, progress) {
        const token = this.getToken();
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        // Validasi input
        if (progress < 0 || progress > 100) {
            throw new Error('Progress must be between 0 and 100');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/courses/${courseId}/progress`, 
                {
                    method: 'POST', // ✅ PASTIKAN POST, BUKAN GET
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ progress })
                }
            );
            
            const data = await response.json();
            
            if (!response.ok) {
                // Handle error spesifik dari Laravel
                if (response.status === 405) {
                    throw new Error('Method not allowed. Use POST for this endpoint.');
                }
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Update Progress Error:', error);
            throw error; // Re-throw agar bisa di-catch di UI
        }
    },
    
    // ========== UTILITY ==========
    
    /**
     * Refresh user data dari backend (opsional)
     */
    async refreshUser() {
        const token = this.getToken();
        if (!token) return null;
        
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const user = await response.json();
                localStorage.setItem('speakout_user', JSON.stringify(user));
                return user;
            }
        } catch (e) {
            console.warn('⚠️ Failed to refresh user data');
        }
        return null;
    }
};

// ========== AUTO-AUTH CHECK (Global) ==========
// Jalankan saat DOM siap, kecuali di halaman yang memang public
document.addEventListener('DOMContentLoaded', () => {
    // Daftar halaman yang TIDAK butuh login
    const publicPages = ['index.html', 'register.html', ''];
    const currentPage = window.location.pathname.split('/').pop();
    
    const isPublicPage = publicPages.includes(currentPage);
    
    // 1. Jika user SUDAH login tapi buka halaman public → redirect ke dashboard
    if (api.isLoggedIn() && isPublicPage) {
        const role = api.getUserRole();
        const target = role === 'admin' ? 'admin.html' : 'dashboard.html';
        // Hindari redirect loop
        if (!window.location.pathname.includes(target)) {
            window.location.href = target;
        }
    }
    
    // 2. Jika user BELUM login dan buka halaman protected → redirect ke login
    if (!api.isLoggedIn() && !isPublicPage) {
        window.location.href = 'index.html';
    }
});

// Export untuk module system (jika pakai)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}