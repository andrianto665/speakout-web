/**
 * 📁 FILE: js/api.js
 * 🎯 Service untuk komunikasi dengan Laravel API
 * ✅ Compatible dengan js/auth.js & js/dashboard.js
 */

// 🔹 Konfigurasi Base URL (Auto-detect environment)
const getApiBaseUrl = () => {
    const isAndroidEmulator = typeof navigator !== 'undefined' && 
                              navigator.userAgent.includes('Android');
    
    if (isAndroidEmulator) return 'http://10.0.2.2:8000/api';
    return 'http://127.0.0.1:8000/api'; // ✅ Lebih stabil daripada 'localhost'
};

const API_BASE = getApiBaseUrl();
const API_TIMEOUT = 15000;

// ✅ DEFINISIKAN OBJECT api SEKALI SAJA DI SINI
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
    async register(name, email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    name, email, password,
                    password_confirmation: password
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
    
    async login(email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.setToken(data.token);
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
    
    async logout() {
        const token = this.getToken();
        
        if (token) {
            try {
                await this._fetchWithTimeout(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.warn('⚠️ Backend logout failed, clearing local session anyway');
            }
        }
        
        this.clearToken();
        window.location.href = 'index.html';
    },
    
    // ========== COURSE METHODS ==========
    async getCourses() {
        const token = this.getToken();
        if (!token) {
            console.warn('⚠️ No token found. Please login first.');
            return [];
        }
        
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/courses`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.clearToken();
                    window.location.href = 'login.html';
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Courses Error:', error);
            return [];
        }
    },
    
    // ✅ FIXED: Update progress dengan format snake_case yang benar
    async updateProgress(courseId, meetingId, isCompleted) {
        const token = this.getToken();
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/courses/${courseId}/progress`, 
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    // ✅ PENTING: snake_case sesuai Laravel API
                    body: JSON.stringify({
                        meeting_id: meetingId,
                        is_completed: isCompleted
                    })
                }
            );
            
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 405) {
                    throw new Error('Method not allowed. Use POST for this endpoint.');
                }
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Update Progress Error:', error);
            throw error;
        }
    },
    
    // ✅ FIXED: Get progress - pakai API_BASE global (bukan this.API_BASE)
    async getCourseProgress(courseId) {
        const token = this.getToken();
        if (!token) throw new Error('Not authenticated');
        
        const res = await this._fetchWithTimeout(`${API_BASE}/courses/${courseId}/progress`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${res.status}`);
        }
        
        return await res.json();
    },
    
    // ✅ FIXED: Update progress for meeting/lesson - pakai API_BASE global
    async updateCourseProgress(courseId, meetingId, isCompleted) {
        const token = this.getToken();
        if (!token) throw new Error('Not authenticated');
        
        const res = await this._fetchWithTimeout(`${API_BASE}/courses/${courseId}/progress`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                meeting_id: meetingId,
                is_completed: isCompleted
            })
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${res.status}`);
        }
        
        return await res.json();
    },
    
    // ========== UTILITY ==========
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
document.addEventListener('DOMContentLoaded', () => {
    const publicPages = ['index.html', 'login.html', 'register.html', ''];
    const currentPage = window.location.pathname.split('/').pop();
    const isPublicPage = publicPages.includes(currentPage);
    
    if (api.isLoggedIn() && isPublicPage) {
        const role = api.getUserRole();
        const target = role === 'admin' ? 'admin.html' : 'dashboard.html';
        if (!window.location.pathname.includes(target)) {
            window.location.href = target;
        }
    }
    
    if (!api.isLoggedIn() && !isPublicPage) {
        window.location.href = 'login.html';
    }
});

// ✅ HAPUS export default jika tidak pakai ES modules (browser biasa)
// Jika pakai module, uncomment baris bawah:
// export default api;