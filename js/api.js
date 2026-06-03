/**
 * 📁 FILE: js/api.js
 * 🎯 API Service untuk komunikasi dengan Laravel Backend
 * ✅ Compatible dengan auth.js, dashboard.js, course-details.js, courses.js
 * 
 * @module api
 * @version 2.2.0 - Fixed auto-login issue
 */

// ============================================================================
// ⚙️ CONFIGURATION
// ============================================================================

const getApiBaseUrl = () => {
    const isAndroidEmulator = typeof navigator !== 'undefined' && 
                              navigator.userAgent?.includes('Android');
    
    if (isAndroidEmulator) {
        return 'http://10.0.2.2:8000/api';
    }
    
    return 'http://127.0.0.1:8000/api';
};

const API_BASE = getApiBaseUrl();
const API_TIMEOUT = 15000;

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
    
    getUserRole() {
        const user = this.getUser();
        return user?.role || 'user';
    },
    
    // =========================================================================
    // HTTP HELPER
    // =========================================================================
    
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
    
    // =========================================================================
    // 🔐 AUTHENTICATION METHODS
    // =========================================================================
    
    async register(name, email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
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
                data: { message: error.message || 'Network error.' },
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
        
        this.clearToken();
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
    
    async downloadCertificate(courseId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user/certificates/${courseId}/download`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
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
// 🔒 PAGE PROTECTION (IMPROVED - No Auto-Redirect from Landing Pages)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // ✅ Halaman yang SELALU tampil tanpa auto-redirect (landing & auth pages)
    const alwaysPublicPages = [
        'index.html',       // Landing page - selalu tampil
        'login.html',       // Login page - selalu tampil
        'register.html',    // Register page - selalu tampil
        ''                  // Root path
    ];
    
    // ✅ Halaman publik yang bisa diakses tanpa login (tapi tidak auto-redirect)
    const publicPages = [
        ...alwaysPublicPages,
        'courses.html',     // Browse courses
        'teachers.html'     // Browse teachers
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    const isAlwaysPublic = alwaysPublicPages.includes(currentPage);
    const isPublicPage = publicPages.includes(currentPage);
    
    // ✅ RULE 1: Halaman yang selalu publik → JANGAN auto-redirect apapun
    // Biarkan user memutuskan mau login sebagai siapa
    if (isAlwaysPublic) {
        console.log('📄 Public page:', currentPage, '- No auto-redirect');
        return; // STOP! Jangan lakukan apapun
    }
    
    // ✅ RULE 2: Jika TIDAK login + di halaman protected → redirect ke login
    if (!api.isLoggedIn() && !isPublicPage) {
        console.log('🔒 Protected page - redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    // ✅ RULE 3: Jika sudah login + di dashboard.html tapi role admin → redirect ke admin.html
    if (api.isLoggedIn() && currentPage === 'dashboard.html') {
        const role = api.getUserRole();
        if (role === 'admin') {
            console.log('👑 Admin detected on dashboard - redirecting to admin.html');
            window.location.href = 'admin.html';
            return;
        }
    }
    
    // ✅ RULE 4: Jika sudah login + di admin.html tapi role bukan admin → redirect ke dashboard
    if (api.isLoggedIn() && currentPage === 'admin.html') {
        const role = api.getUserRole();
        if (role !== 'admin') {
            console.log('👤 Non-admin on admin.html - redirecting to dashboard.html');
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