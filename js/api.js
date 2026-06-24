/**
 * 📁 FILE: js/api.js
 * 🎯 API Service untuk komunikasi dengan Laravel Backend
 * ✅ Compatible dengan auth.js, dashboard.js, course-details.js, courses.js
 * 
 * @module api
 * @version 2.4.0 - Fixed downloadCertificate, added 401 handler, added getAssetUrl helper
 */

// ============================================================================
// ⚙️ CONFIGURATION
// ============================================================================

/**
 * 🎯 Auto-detect API Base URL berdasarkan environment
 * - Localhost development: http://127.0.0.1:8000/api
 * - GitHub Pages production: https://xxx.ngrok-free.dev/api
 */
const getApiBaseUrl = () => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.protocol === 'file:';
    
    if (isLocalhost) {
        console.log('🔧 Development mode: Using localhost backend');
        return 'http://127.0.0.1:8000/api';
    } else {
        console.log('🚀 Production mode: Using Ngrok backend');
        return 'https://sliding-famished-scoreless.ngrok-free.dev/api';
    }
};

const API_BASE = getApiBaseUrl();
const API_TIMEOUT = 15000;

console.log(`📡 API Base URL: ${API_BASE}`);

// ============================================================================
// 🔐 API SERVICE OBJECT
// ============================================================================

const api = {
    
    // =========================================================================
    // TOKEN & SESSION MANAGEMENT
    // =========================================================================
    
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
    
    /**
     * ✅ Clear SEMUA data user termasuk course progress
     */
    clearUserData() {
        localStorage.removeItem('speakout_token');
        localStorage.removeItem('speakout_user');
        
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('_completed')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        console.log('🧹 Cleared user data & progress');
    },
    
    isLoggedIn() {
        return !!this.getToken();
    },
    
    // =========================================================================
    // USER INFO & ROLE
    // =========================================================================
    
    getUser() {
        try {
            const userStr = localStorage.getItem('speakout_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    },

    setUser(userData) {
        if (!userData) return;
        localStorage.setItem('speakout_user', JSON.stringify(userData));
    },
    
    getUserRole() {
        const user = this.getUser();
        return user?.role || 'user';
    },
    
    getUserId() {
        const user = this.getUser();
        return user?.id || 'guest';
    },
    
    // =========================================================================
    // 🆕 HELPER: Get Asset URL (untuk gambar, thumbnail, dll)
    // =========================================================================
    
    /**
     * 🆕 Helper untuk mendapatkan URL asset (gambar, thumbnail, dll)
     * Contoh: api.getAssetUrl('assets/courses/english.png')
     * Hasil: 'http://127.0.0.1:8000/assets/courses/english.png' (localhost)
     *        'https://xxx.ngrok-free.dev/assets/courses/english.png' (production)
     */
    getAssetUrl(path) {
        if (!path) return '';
        // Hapus /api dari API_BASE untuk mendapatkan base URL backend
        const baseUrl = API_BASE.replace('/api', '');
        // Hapus leading slash jika ada
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `${baseUrl}/${cleanPath}`;
    },
    
    // =========================================================================
    // HTTP HELPER
    // =========================================================================
    
    /**
     * ✅ IMPROVED: HTTP helper dengan auto-redirect 401
     */
    async _fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        try {
            // ✅ FIX: Hanya tambahkan Content-Type jika ada body
            const defaultHeaders = {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };
            
            // Hanya tambahkan Content-Type jika ada body (POST/PUT/PATCH)
            if (options.body) {
                defaultHeaders['Content-Type'] = 'application/json';
            }
            
            const response = await fetch(url, {
                ...options,
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            });
            clearTimeout(timeoutId);
            
            // ✅ NEW: Auto-redirect ke login jika 401 Unauthorized
            if (response.status === 401) {
                console.warn('⚠️ Token expired or invalid. Redirecting to login...');
                this.clearUserData();
                
                const currentPage = window.location.pathname.split('/').pop();
                const publicPages = ['index.html', 'login.html', 'register.html', 'courses.html', 'teachers.html', ''];
                
                if (!publicPages.includes(currentPage)) {
                    alert('Sesi Anda telah berakhir. Silakan login kembali.');
                    window.location.href = 'login.html';
                }
                
                throw new Error('Unauthorized. Please login again.');
            }
            
            return response;
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Server is taking too long to respond.');
            }
            throw error;
        }
    },
    
    // =========================================================================
    // 🔐 AUTHENTICATION METHODS
    // =========================================================================
    
    register: async function(name, email, password, courseId = null) {
        try {
            const body = {
                name,
                email,
                password,
                password_confirmation: password,
            };
            if (courseId) body.course_id = courseId;

            const response = await this._fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            const data = await response.json();
            return { success: response.ok, data, status: response.status };

        } catch (error) {
            console.error('❌ Register API Error:', error);
            return { success: false, data: { message: error.message || 'Network error.' }, status: 0 };
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
                this.clearUserData();
                localStorage.setItem('speakout_token', data.token);
                localStorage.setItem('speakout_user', JSON.stringify(data.user));
                return { success: true, data };
            }
            
            return {
                success: false,
                data,
                status: response.status
            };
            
        } catch (error) {
            console.error('❌ Login API Error:', error);
            return {
                success: false,
                data: { message: error.message || 'Network error.' },
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
        
        this.clearUserData();
        window.location.href = 'login.html';
    },
    
    // =========================================================================
    // 📚 COURSE METHODS
    // =========================================================================
    
    async getCourses() {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/courses`, {
                method: 'GET'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Courses Error:', error);
            return [];
        }
    },
    
    async getCourseDetails(courseId) {
        const token = this.getToken();
        
        try {
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await this._fetchWithTimeout(`${API_BASE}/courses/${courseId}`, {
                headers
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
            
        } catch (error) {
            console.error(`❌ Get Course ${courseId} Error:`, error);
            return null;
        }
    },
    
    // =========================================================================
    // 📊 PROGRESS TRACKING
    // =========================================================================
    
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
    
    async getCourseProgress(courseId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Not authenticated');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/courses/${courseId}/progress`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`❌ Get Progress Error (course ${courseId}):`, error);
            throw error;
        }
    },
    
    // =========================================================================
    // 🎓 ENROLLMENT METHODS
    // =========================================================================
    
    async enrollInCourse(courseId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user/enroll/${courseId}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ Enroll Error (course ${courseId}):`, error);
            throw error;
        }
    },
    
    async getEnrolledCourses() {
        const token = this.getToken();
        
        if (!token) {
            console.warn('⚠️ No token found. Please login first.');
            return [];
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user/enrolled-courses`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Enrolled Courses Error:', error);
            return [];
        }
    },
    
    async getDashboardSummary() {
        const token = this.getToken();
        
        if (!token) {
            console.warn('⚠️ No token found. Please login first.');
            return null;
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user/dashboard`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Dashboard Error:', error);
            return null;
        }
    },
    
    // =========================================================================
    // ✍️ QUIZ METHODS
    // =========================================================================
    
    async getQuiz(quizId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/quizzes/${quizId}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`❌ Get Quiz ${quizId} Error:`, error);
            throw error;
        }
    },
    
    async submitQuiz(quizId, answers) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/quizzes/${quizId}/submit`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ answers })
                }
            );
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ Submit Quiz ${quizId} Error:`, error);
            throw error;
        }
    },
    
    // =========================================================================
    // 📄 CERTIFICATE METHODS
    // =========================================================================
    
    /**
     * ✅ FIXED: Download certificate dengan header yang benar untuk PDF
     */
    async downloadCertificate(courseId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            // ✅ FIX: Gunakan fetch langsung, bukan _fetchWithTimeout
            // karena kita butuh header khusus untuk PDF
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            
            const response = await fetch(
                `${API_BASE}/user/certificates/${courseId}/download`,
                {
                    method: 'GET',
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/pdf',
                        'ngrok-skip-browser-warning': 'true'
                    }
                }
            );
            
            clearTimeout(timeoutId);
            
            if (response.status === 401) {
                this.clearUserData();
                window.location.href = 'login.html';
                throw new Error('Unauthorized. Please login again.');
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Certificate not ready yet. Please complete all lessons first.');
                }
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.blob();
            
        } catch (error) {
            console.error(`❌ Download Certificate ${courseId} Error:`, error);
            throw error;
        }
    },
    
    // =========================================================================
    // 🔄 UTILITY METHODS
    // =========================================================================
    
    async refreshUser() {
        const token = this.getToken();
        
        if (!token) return null;
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
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

// ============================================================================
// 🔒 PAGE PROTECTION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const alwaysPublicPages = ['index.html', 'login.html', 'register.html', ''];
    const publicPages = [...alwaysPublicPages, 'courses.html', 'teachers.html'];
    
    const currentPage = window.location.pathname.split('/').pop();
    const isAlwaysPublic = alwaysPublicPages.includes(currentPage);
    const isPublicPage = publicPages.includes(currentPage);
    
    if (isAlwaysPublic) {
        console.log('📄 Public page:', currentPage, '- No auto-redirect');
        return;
    }
    
    if (!api.isLoggedIn() && !isPublicPage) {
        console.log('🔒 Protected page - redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    if (api.isLoggedIn() && currentPage === 'dashboard.html') {
        const role = api.getUserRole();
        if (role === 'admin') {
            console.log('👑 Admin detected - redirecting to admin.html');
            window.location.href = 'admin.html';
            return;
        }
    }
    
    if (api.isLoggedIn() && currentPage === 'admin.html') {
        const role = api.getUserRole();
        if (role !== 'admin') {
            console.log('👤 Non-admin - redirecting to dashboard.html');
            window.location.href = 'dashboard.html';
            return;
        }
    }
});

// ============================================================================
// 📦 MODULE EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}