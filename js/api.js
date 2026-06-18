/**
 * 📁 FILE: js/api.js
 * 🎯 API Service untuk komunikasi dengan Laravel Backend
 * ✅ Compatible dengan auth.js, dashboard.js, course-details.js, courses.js
 * 
 * @module api
 * @version 2.3.0 - Fixed duplicate login, added clearUserData
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
    
    /**
     * ✅ Clear token & user data (basic logout)
     */
    clearToken() {
        localStorage.removeItem('speakout_token');
        localStorage.removeItem('speakout_user');
    },
    
    /**
     * ✅ NEW: Clear SEMUA data user termasuk course progress
     * Dipanggil saat login user baru atau logout
     */
    clearUserData() {
        // 1. Hapus token & user info
        localStorage.removeItem('speakout_token');
        localStorage.removeItem('speakout_user');
        
        // 2. Hapus semua course progress (key mengandung '_completed')
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

    // ← TAMBAHKAN INI:
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
    // HTTP HELPER
    // =========================================================================
    
    async _fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        try {
            const response = await fetch(url, {
                ...options,
                cache: 'no-store',
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
    
    /**
     * ✅ FIXED: Login dengan clearUserData untuk mencegah data user lama terbaca
     */
    async login(email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                // ✅ PENTING: Clear SEMUA data user lama sebelum simpan user baru
                this.clearUserData();
                
                // Simpan data user baru
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
        
        // ✅ Clear semua data termasuk progress
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