/**
 * 📁 FILE: js/api.js
 * 🎯 API Service untuk komunikasi dengan Laravel Backend
 * ✅ Compatible dengan auth.js, dashboard.js, course-details.js, courses.js
 * 
 * @module api
 * @version 2.1.0
 */

// ============================================================================
// ⚙️ CONFIGURATION
// ============================================================================

/**
 * Get API base URL based on environment
 * @returns {string} API base URL
 */
const getApiBaseUrl = () => {
    // Detect Android emulator (10.0.2.2 = localhost for emulator)
    const isAndroidEmulator = typeof navigator !== 'undefined' && 
                              navigator.userAgent?.includes('Android');
    
    if (isAndroidEmulator) {
        return 'http://10.0.2.2:8000/api';
    }
    
    // Use 127.0.0.1 instead of localhost for better IPv4 consistency
    return 'http://127.0.0.1:8000/api';
};

/** @constant {string} */
const API_BASE = getApiBaseUrl();

/** @constant {number} Request timeout in milliseconds (15 seconds) */
const API_TIMEOUT = 15000;

// ============================================================================
// 🔐 API SERVICE OBJECT
// ============================================================================

const api = {
    
    // =========================================================================
    // TOKEN & SESSION MANAGEMENT
    // =========================================================================
    
    /**
     * Get stored authentication token
     * @returns {string|null} Bearer token or null
     */
    getToken() {
        return localStorage.getItem('speakout_token');
    },
    
    /**
     * Save authentication token to storage
     * @param {string} token - JWT token from backend
     */
    setToken(token) {
        if (!token) return;
        localStorage.setItem('speakout_token', token);
    },
    
    /**
     * Clear all auth data from storage
     */
    clearToken() {
        localStorage.removeItem('speakout_token');
        localStorage.removeItem('speakout_user');
    },
    
    /**
     * Check if user is authenticated
     * @returns {boolean} True if token exists
     */
    isLoggedIn() {
        return !!this.getToken();
    },
    
    // =========================================================================
    // USER INFO & ROLE
    // =========================================================================
    
    /**
     * Get stored user data
     * @returns {Object|null} User object or null
     */
    getUser() {
        try {
            const userStr = localStorage.getItem('speakout_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    },
    
    /**
     * Get user role with fallback
     * @returns {string} 'admin' or 'user'
     */
    getUserRole() {
        const user = this.getUser();
        return user?.role || 'user';
    },
    
    // =========================================================================
    // HTTP HELPER: Fetch with timeout & error handling
    // =========================================================================
    
    /**
     * Internal: Fetch wrapper with timeout and default headers
     * @private
     * @param {string} url - Request URL
     * @param {RequestInit} options - Fetch options
     * @returns {Promise<Response>}
     * @throws {Error} On timeout or network error
     */
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
    
    /**
     * Register a new user
     * @param {string} name - User's full name
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<{success: boolean, data: Object, status: number}>}
     */
    async register(name, email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    password_confirmation: password // Laravel requires confirmation
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
     * Login user and store token
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<{success: boolean, data: Object, status: number}>}
     */
    async login(email, password) {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            // Store auth data on success
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
    
    /**
     * Logout user and clear session
     * ✅ FIXED: Redirect to login.html (bukan index.html)
     */
    async logout() {
        const token = this.getToken();
        
        // Notify backend (optional, don't fail if this fails)
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
        
        // Clear local session and redirect
        this.clearToken();
        window.location.href = 'login.html'; // ✅ FIXED: ke login.html
    },
    
    // =========================================================================
    // 📚 COURSE METHODS
    // =========================================================================
    
    /**
     * Get all available courses (public endpoint - no auth required)
     * @returns {Promise<Array>} List of courses or empty array
     */
    async getCourses() {
        try {
            const response = await this._fetchWithTimeout(`${API_BASE}/courses`, {
                method: 'GET'
                // ✅ No auth header needed for public courses listing
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Get Courses Error:', error);
            return [];
        }
    },
    
    /**
     * Get course details by ID (requires auth for enrolled content)
     * @param {number} courseId - Course ID
     * @returns {Promise<Object|null>} Course data or null
     */
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
    // 📊 PROGRESS TRACKING METHODS
    // =========================================================================
    
    /**
     * Update progress for a specific lesson/meeting
     * @param {number} courseId - Course ID
     * @param {number} meetingId - Meeting/Lesson ID (from meetings table)
     * @param {boolean} isCompleted - Completion status
     * @returns {Promise<Object>} Updated progress data
     * @throws {Error} On auth or API error
     */
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
                    // ✅ Laravel expects snake_case keys
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
            throw error; // Re-throw for UI to handle
        }
    },
    
    /**
     * Get progress percentage for a course
     * @param {number} courseId - Course ID
     * @returns {Promise<Object>} Progress data: {progress, total_lessons, completed_lessons}
     * @throws {Error} On auth or API error
     */
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
    
    /**
     * Enroll current user in a course
     * @param {number} courseId - Course ID to enroll in
     * @returns {Promise<Object>} Enrollment confirmation data
     * @throws {Error} On auth or API error
     */
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
    
    /**
     * Get all courses that user is enrolled in (with progress)
     * @returns {Promise<Array>} List of enrolled courses with progress data
     */
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
    
    /**
     * Get dashboard summary (stats + courses)
     * @returns {Promise<Object>} Dashboard data: {stats, in_progress_courses, available_courses}
     */
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
    // ✍️ QUIZ METHODS (NEW: Untuk Udemy-style Quiz System)
    // =========================================================================
    
    /**
     * Get quiz questions (tanpa kunci jawaban - aman untuk frontend)
     * @param {number} quizId - Quiz ID
     * @returns {Promise<Object|null>} Quiz data with questions (no correct_answer)
     */
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
    
    /**
     * Submit quiz answers & get auto-graded result
     * @param {number} quizId - Quiz ID
     * @param {Object} answers - Object dengan format { question_id: "A", ... }
     * @returns {Promise<Object>} Result: { score, passed, message, attempt }
     * @throws {Error} On auth or API error
     */
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
    // 📄 CERTIFICATE METHODS (NEW)
    // =========================================================================
    
    /**
     * Download certificate PDF for completed course
     * @param {number} courseId - Course ID
     * @returns {Promise<Blob>} PDF blob for download
     * @throws {Error} On auth or API error
     */
    async downloadCertificate(courseId) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Unauthorized. Please login first.');
        }
        
        try {
            // ✅ Gunakan Accept: application/json agar Laravel tidak redirect ke login page
            const response = await this._fetchWithTimeout(
                `${API_BASE}/user/certificates/${courseId}/download`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json' // ← WAJIB untuk API request
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
            
            // Return blob untuk trigger download di frontend
            return await response.blob();
            
        } catch (error) {
            console.error(`❌ Download Certificate ${courseId} Error:`, error);
            throw error;
        }
    },
    
    // =========================================================================
    // 🔄 UTILITY METHODS
    // =========================================================================
    
    /**
     * Refresh user data from backend
     * @returns {Promise<Object|null>} Updated user data or null
     */
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
// 🔄 AUTO-AUTH CHECK (Global Page Protection)
// ============================================================================

/**
 * Auto-redirect based on auth status
 * Runs when DOM is ready on all pages
 */
document.addEventListener('DOMContentLoaded', () => {
    // ✅ UPDATED: Tambah courses.html & teachers.html sebagai public pages
    const publicPages = [
        'index.html', 
        'login.html', 
        'register.html', 
        'courses.html',      // ✅ Bisa diakses tanpa login (browse courses)
        'teachers.html',     // ✅ Bisa diakses tanpa login (lihat teachers)
        ''                  // Root path
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    const isPublicPage = publicPages.includes(currentPage);
    
    // 1. If logged in + on public page → redirect to dashboard
    if (api.isLoggedIn() && isPublicPage) {
        const role = api.getUserRole();
        const target = role === 'admin' ? 'admin.html' : 'dashboard.html';
        
        // Avoid redirect loop
        if (!window.location.pathname.includes(target)) {
            window.location.href = target;
        }
    }
    
    // 2. If NOT logged in + on protected page → redirect to login
    if (!api.isLoggedIn() && !isPublicPage) {
        // ✅ Kecuali courses.html & teachers.html yang boleh diakses public
        const protectedButPublic = ['courses.html', 'teachers.html'];
        if (!protectedButPublic.includes(currentPage)) {
            window.location.href = 'login.html';
        }
    }
});

// ============================================================================
// 📦 MODULE EXPORT (Optional: for bundlers like Webpack/Vite)
// ============================================================================

// For CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}

// For ES Modules (uncomment if using type="module" in HTML)
// export default api;