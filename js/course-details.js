/*
========================================
📁 course-details.js - Course Detail & Quiz Logic
🎯 Handle: Load course, render lessons, quiz UI, progress tracking
✅ FIXED: Progress per-user, sync dengan backend, no duplicate functions
========================================
*/

/*
========================================
⚙️ CONFIG & GLOBAL VARIABLES
========================================
*/
const API_BASE_URL = 'http://127.0.0.1:8000/api';
const API_URL = `${API_BASE_URL}/courses`;

// DOM Elements
const meetingList = document.getElementById('meeting-list');
const contentContainer = document.getElementById('content-container');
const meetingTitleEl = document.getElementById('meeting-title');
const meetingLabelEl = document.getElementById('meeting-label');
const pageTitleEl = document.getElementById('page-title');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const courseProgressValue = document.getElementById('courseProgressValue');
const courseProgressFill = document.getElementById('courseProgressFill');

// Global State
let courseData = null;
let currentMeetingId = null;
let currentCourseId = null;
let currentQuizId = null;
let currentQuizMeetingId = null;
let completedMeetings = new Set(); // ✅ Track completed meetings

/*
========================================
🔐 UTILS: Auth & Helpers
========================================
*/
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return { courseId: params.get('course_id'), title: params.get('title') };
}
function getAuthToken() { return localStorage.getItem('speakout_token'); }
function isLoggedIn() { return !!getAuthToken(); }
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/*
========================================
✅ PROGRESS STORAGE (PER USER - FIXED)
========================================
*/
function getProgressKey(courseId) {
    const userId = api.getUserId();
    return `course_${courseId}_user_${userId}_completed`;
}

function loadCompletedMeetings(courseId) {
    const key = getProgressKey(courseId);
    const saved = localStorage.getItem(key);
    if (saved) {
        completedMeetings = new Set(JSON.parse(saved));
        console.log(`✅ Loaded ${completedMeetings.size} completed meetings for course ${courseId}`);
    } else {
        completedMeetings = new Set();
        console.log(`🆕 No progress found for course ${courseId} - starting fresh`);
    }
}

function saveCompletedMeetings(courseId) {
    const key = getProgressKey(courseId);
    localStorage.setItem(key, JSON.stringify([...completedMeetings]));
}

function clearAllUserProgress() {
    const userId = api.getUserId();
    Object.keys(localStorage).forEach(key => {
        if (key.includes(`user_${userId}`)) {
            localStorage.removeItem(key);
        }
    });
}

/*
========================================
📊 UPDATE COURSE PROGRESS BAR
========================================
*/
function updateCourseProgressBar() {
    if (!courseProgressValue || !courseProgressFill || !courseData) return;
    
    const meetings = courseData.meetings || [];
    const actualLessons = meetings.filter(m => {
        return m.content || m.quiz_id || (m.type && ['test', 'quiz', 'final'].includes(m.type));
    });
    
    const totalLessons = actualLessons.length;
    const completedCount = actualLessons.filter(m => completedMeetings.has(m.id)).length;
    const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    
    courseProgressValue.textContent = `${progress}%`;
    courseProgressFill.style.width = `${progress}%`;
}

async function updateCourseProgressFromAPI(courseId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/${courseId}/progress`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            const progress = data.progress || 0;
            
            if (courseProgressValue) {
                courseProgressValue.textContent = `${progress}%`;
            }
            if (courseProgressFill) {
                courseProgressFill.style.width = `${progress}%`;
            }
        }
    } catch (error) {
        console.warn('⚠️ Failed to fetch progress from API, using localStorage');
        updateCourseProgressBar();
    }
}

/*
========================================
📊 RENDER COURSE META INFO
========================================
*/
function renderCourseMeta(data) {
    const metaContainer = document.getElementById('courseMetaHero');
    const metaCategory = document.getElementById('metaCategory');
    const metaLevel = document.getElementById('metaLevel');
    const metaDuration = document.getElementById('metaDuration');
    
    if (!metaContainer || !data) return;
    
    let hasMeta = false;
    
    if (data.category) {
        metaCategory.textContent = `📚 ${data.category}`;
        metaCategory.style.display = 'inline-flex';
        hasMeta = true;
    } else if (metaCategory) {
        metaCategory.style.display = 'none';
    }
    
    if (data.level) {
        metaLevel.textContent = `🎓 ${data.level}`;
        metaLevel.style.display = 'inline-flex';
        hasMeta = true;
    } else if (metaLevel) {
        metaLevel.style.display = 'none';
    }
    
    if (data.duration) {
        metaDuration.textContent = `⏱️ ${data.duration}`;
        metaDuration.style.display = 'inline-flex';
        hasMeta = true;
    } else if (metaDuration) {
        metaDuration.style.display = 'none';
    }
    
    if (hasMeta && metaContainer) {
        metaContainer.style.display = 'flex';
    }
}

/*
========================================
📦 FETCH COURSE DETAILS
========================================
*/
async function loadCourseDetails(courseId) {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_URL}/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ERROR ${response.status}`);
        const data = await response.json();
        courseData = data;
        currentCourseId = courseId;
        
        if (pageTitleEl) pageTitleEl.textContent = data.title || 'Course Details';
        
        // ✅ Load progress per user
        loadCompletedMeetings(courseId);
        
        // ✅ Render meta info
        renderCourseMeta(data);
        
        // ✅ Update progress bar
        updateCourseProgressBar();
        
        renderMeetings(data.meetings || []);
    } catch (error) {
        console.error('❌ Error loading course:', error);
        if (meetingList) {
            meetingList.innerHTML = `<p style="color: #e53935; text-align: center; padding: 20px;">❌ Gagal memuat materi.<br><small>${error.message}</small></p>`;
        }
        if (typeof showNotification === 'function') {
            showNotification('Gagal memuat materi course', 'error');
        }
    }
}

/*
========================================
🚪 LOGOUT HANDLER
========================================
*/
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            // ✅ Clear progress user saat ini
            api.clearUserData();
            window.location.href = 'login.html';
        }
    });
}

/*
========================================
📋 RENDER SIDEBAR: Daftar Pertemuan
========================================
*/
function renderMeetings(meetings) {
    if (!meetings || meetings.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666; text-align:center;">Belum ada pertemuan tersedia.</p>';
        return;
    }

    const sortedMeetings = [...meetings].sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
    
    meetingList.innerHTML = '';

    sortedMeetings.forEach((meeting, index) => {
        const meetingEl = document.createElement('div');
        meetingEl.className = 'meeting-item';
        
        if (currentMeetingId === meeting.id || (index === 0 && !currentMeetingId)) {
            meetingEl.classList.add('active');
            if (!currentMeetingId) currentMeetingId = meeting.id;
        }
        
        // ✅ Show checkmark if completed
        const isCompleted = completedMeetings.has(meeting.id);
        const checkmark = isCompleted ? ' ✓' : '';
        
        // ✅ Determine icon based on type
        let typeIcon = '📄';
        if (meeting.type === 'quiz' || meeting.type === 'test') {
            typeIcon = '✍️';
        } else if (meeting.type === 'final') {
            typeIcon = '🏆';
        } else if (meeting.quiz_id) {
            typeIcon = '✍️';
        } else if (!meeting.content || meeting.content.trim() === '') {
            typeIcon = '📁';
        }
        
        meetingEl.innerHTML = `
            <span class="meeting-icon">${typeIcon}</span>
            <span style="flex:1;">${escapeHtml(meeting.title || `Pertemuan ${index + 1}`)}${checkmark}</span>
        `;
        
        meetingEl.addEventListener('click', function() {
            document.querySelectorAll('.meeting-item').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            currentMeetingId = meeting.id;
            
            if (meetingTitleEl) meetingTitleEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
            
            if (meeting.quiz_id && (meeting.type === 'quiz' || meeting.type === 'test' || meeting.type === 'final')) {
                currentQuizId = meeting.quiz_id;
                currentQuizMeetingId = meeting.id;
                renderQuizUI(meeting);
                
            } else if (meeting.content && meeting.content.trim() !== '') {
                renderLessonContent(meeting);
                
            } else {
                if (contentContainer) {
                    contentContainer.innerHTML = `
                        <div style="text-align:center; padding:60px 20px; color:var(--gray);">
                            <div style="font-size:64px; margin-bottom:16px;">📁</div>
                            <h3 style="margin-bottom:8px; font-family:'Playfair Display',serif; color:var(--dark);">${escapeHtml(meeting.title)}</h3>
                            <p>Pilih materi di bawah untuk memulai belajar.</p>
                        </div>
                    `;
                }
            }
        });
        
        meetingList.appendChild(meetingEl);
    });

    if (!currentMeetingId && sortedMeetings.length > 0) {
        const firstMeeting = sortedMeetings[0];
        currentMeetingId = firstMeeting.id;
        if (meetingTitleEl) meetingTitleEl.textContent = firstMeeting.title || 'Pertemuan 1';
        
        setTimeout(() => {
            meetingList.querySelector('.meeting-item')?.click();
        }, 100);
    }
}

/*
========================================
📄 RENDER LESSON CONTENT (Google Drive Embed)
========================================
*/
function renderLessonContent(meeting) {
    if (!contentContainer) return;
    
    let embedUrl = meeting.content;
    if (embedUrl && embedUrl.includes('/view')) {
        const match = embedUrl.match(/\/d\/([^\/\?]+)/);
        if (match && match[1]) {
            embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }
    
    const isCompleted = completedMeetings.has(meeting.id);
    
    contentContainer.innerHTML = `
        <div style="background:var(--surface2); border-radius:16px; padding:32px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
                <div style="width:48px; height:48px; background:linear-gradient(135deg, var(--purple), var(--blue)); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:24px;">
                    🎬
                </div>
                <div>
                    <h3 style="font-family:'Playfair Display',serif; font-size:24px; color:var(--dark); margin-bottom:4px;">${escapeHtml(meeting.title)}</h3>
                    <p style="font-size:13px; color:var(--gray);">Video Pembelajaran</p>
                </div>
            </div>
            
            <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; background:#000; box-shadow:0 8px 24px rgba(0,0,0,0.15);">
                <iframe src="${embedUrl}" 
                    style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" 
                    allow="autoplay; encrypted-media" 
                    allowfullscreen 
                    loading="lazy">
                </iframe>
            </div>
            
            <div style="margin-top:24px; display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
                <button onclick="window.open('${meeting.content}', '_blank')" 
                        style="padding:12px 24px; background:var(--blue); color:white; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.3s; display:inline-flex; align-items:center; gap:8px;">
                    🔗 Buka di Tab Baru
                </button>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px 16px; background:white; border-radius:10px; border:2px solid #e0e0f0;">
                    <input type="checkbox" 
                           id="checkbox-meeting-${meeting.id}"
                           class="lesson-checkbox" 
                           data-meeting-id="${meeting.id}" 
                           onchange="toggleLessonComplete(${currentCourseId}, ${meeting.id}, this.checked)"
                           ${isCompleted ? 'checked' : ''}
                           style="width:20px; height:20px; accent-color:var(--success); cursor:pointer;">
                    <span style="font-size:14px; font-weight:500; color:var(--dark);">✓ Tandai selesai</span>
                </label>
            </div>
        </div>
    `;
}

/*
========================================
🔥 QUIZ SYSTEM FUNCTIONS
========================================
*/
async function renderQuizUI(quizItem) {
    const quizId = quizItem.quiz_id;
    currentQuizId = quizId;
    currentQuizMeetingId = quizItem.id;
    
    if (!contentContainer) { console.error('❌ content-container not found'); return; }
    contentContainer.innerHTML = `<div class="quiz-container"><div class="quiz-loading"><div class="spinner"></div><p>Loading quiz questions...</p></div></div>`;
    
    try {
        const token = getAuthToken();
        
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load quiz: HTTP ${response.status}`);
        }
        
        const quiz = await response.json();
        
        if (!quiz.questions || quiz.questions.length === 0) {
            contentContainer.innerHTML = `
                <div class="quiz-container" style="text-align:center; padding:60px 20px;">
                    <div style="font-size:64px; margin-bottom:16px;">📭</div>
                    <h3 style="font-family:'Playfair Display',serif; margin-bottom:8px;">Belum Ada Soal</h3>
                    <p style="color:var(--gray);">Quiz ini belum memiliki soal.</p>
                </div>
            `;
            return;
        }
        
        if (typeof startQuizTimer === 'function') {
            startQuizTimer(quiz.time_limit);
        }
        
        const sortedQuestions = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
        
        contentContainer.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-header">
                    <h3 class="quiz-title">${escapeHtml(quiz.title)}</h3>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:12px;">
                        <span style="padding:6px 14px; background:rgba(91,45,142,0.1); color:var(--purple); border-radius:20px; font-size:13px; font-weight:600;">
                            🎯 Passing Score: ${quiz.passing_score}%
                        </span>
                        ${quiz.time_limit ? `
                            <span style="padding:6px 14px; background:rgba(245,158,11,0.1); color:var(--warning); border-radius:20px; font-size:13px; font-weight:600;">
                                ⏱️ ${quiz.time_limit} Menit
                            </span>
                        ` : ''}
                        <span style="padding:6px 14px; background:rgba(10,77,155,0.1); color:var(--blue); border-radius:20px; font-size:13px; font-weight:600;">
                            📝 ${sortedQuestions.length} Soal
                        </span>
                    </div>
                </div>
                
                <div class="quiz-progress">
                    <span class="quiz-progress-text" id="quiz-progress-text">Soal 1 dari ${sortedQuestions.length}</span>
                    <div class="quiz-progress-bar">
                        <div class="quiz-progress-fill" id="quiz-progress-fill" style="width: ${100 / sortedQuestions.length}%"></div>
                    </div>
                </div>
                
                <form id="quiz-form">
                    ${sortedQuestions.map((q, index) => `
                        <div class="quiz-question" data-question-id="${q.id}" style="display:${index===0?'block':'none'}">
                            <div class="quiz-question-header">
                                <span class="quiz-question-number">${index+1}</span>
                                <span class="quiz-question-text">${escapeHtml(q.question)}</span>
                            </div>
                            <div class="quiz-options">
                                ${Array.isArray(q.options) ? q.options.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    return `
                                        <label class="quiz-option" data-option="${letter}">
                                            <input type="radio" name="question_${q.id}" value="${letter}" required>
                                            <span><strong>${letter}.</strong> ${escapeHtml(opt)}</span>
                                        </label>
                                    `;
                                }).join('') : '<p style="color:#999">No options available</p>'}
                            </div>
                        </div>
                    `).join('')}
                    
                    <div style="display:flex; gap:12px; margin-top:32px; justify-content:space-between;">
                        <button type="button" class="quiz-retry-btn" id="quiz-prev-btn" style="display:none;">← Sebelumnya</button>
                        <button type="button" class="quiz-submit-btn" id="quiz-next-btn">Selanjutnya →</button>
                        <button type="submit" class="quiz-submit-btn" id="quiz-submit-btn" style="display:none;">✓ Submit Jawaban</button>
                    </div>
                </form>
                
                <div id="quiz-result" class="quiz-result" style="display:none;"></div>
            </div>
        `;
        
        let currentQuestionIndex = 0;
        const totalQuestions = sortedQuestions.length;
        const progressText = document.getElementById('quiz-progress-text');
        const progressFill = document.getElementById('quiz-progress-fill');
        const prevBtn = document.getElementById('quiz-prev-btn');
        const nextBtn = document.getElementById('quiz-next-btn');
        const submitBtn = document.getElementById('quiz-submit-btn');
        
        function updateProgress() {
            progressText.textContent = `Soal ${currentQuestionIndex + 1} dari ${totalQuestions}`;
            progressFill.style.width = `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`;
            prevBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'block';
            if (currentQuestionIndex === totalQuestions - 1) { 
                nextBtn.style.display = 'none'; 
                submitBtn.style.display = 'block'; 
            } else { 
                nextBtn.style.display = 'block'; 
                submitBtn.style.display = 'none'; 
            }
            document.querySelectorAll('.quiz-question').forEach((qEl, idx) => { 
                qEl.style.display = idx === currentQuestionIndex ? 'block' : 'none'; 
            });
        }
        
        prevBtn?.addEventListener('click', () => { 
            if (currentQuestionIndex > 0) { 
                currentQuestionIndex--; 
                updateProgress(); 
            } 
        });
        
        nextBtn?.addEventListener('click', () => {
            const currentQ = document.querySelectorAll('.quiz-question')[currentQuestionIndex];
            const selected = currentQ?.querySelector('input[type="radio"]:checked');
            if (!selected) { 
                if (typeof showNotification === 'function') {
                    showNotification('Silakan jawab pertanyaan ini terlebih dahulu', 'warning');
                }
                return; 
            }
            if (currentQuestionIndex < totalQuestions - 1) { 
                currentQuestionIndex++; 
                updateProgress(); 
            }
        });
        
        updateProgress();
        
        document.getElementById('quiz-form')?.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            submitQuizAnswers(currentQuizId); 
        });
        
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input[type="radio"]').checked = true;
            });
        });
        
    } catch (error) {
        console.error('❌ Error in renderQuizUI:', error);
        contentContainer.innerHTML = `
            <div class="quiz-container" style="text-align:center; padding:60px 20px;">
                <div style="font-size:64px; margin-bottom:16px;">❌</div>
                <h3 style="font-family:'Playfair Display',serif; margin-bottom:8px; color:var(--error);">Gagal Memuat Quiz</h3>
                <p style="color:var(--gray); margin-bottom:24px;">${error.message}</p>
                <button class="quiz-retry-btn" onclick="location.reload()">🔄 Coba Lagi</button>
            </div>
        `;
    }
}

async function submitQuizAnswers(quizId) {
    const token = getAuthToken();
    const submitBtn = document.getElementById('quiz-submit-btn');
    const resultContainer = document.getElementById('quiz-result');
    
    const answers = {};
    document.querySelectorAll('.quiz-question').forEach(qEl => {
        const qId = qEl.dataset.questionId;
        const selected = qEl.querySelector('input[type="radio"]:checked');
        if (selected) { answers[qId] = selected.value; }
    });
    
    const totalQuestions = document.querySelectorAll('.quiz-question').length;
    if (Object.keys(answers).length < totalQuestions) { 
        if (typeof showNotification === 'function') {
            showNotification('Silakan jawab semua pertanyaan sebelum submit', 'warning');
        }
        return; 
    }
    
    if (typeof stopQuizTimer === 'function') { stopQuizTimer(); }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}/submit`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/json', 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ answers })
        });
        
        const result = await response.json();
        
        displayQuizResult(result, resultContainer);
        
        // ✅ Mark quiz as completed if passed
        if (result.passed && currentQuizMeetingId) {
            completedMeetings.add(currentQuizMeetingId);
            saveCompletedMeetings(currentCourseId);
            updateCourseProgressBar();
            renderMeetings(courseData.meetings || []);

            // ✅ Check if course is now complete
            await checkCourseCompletion(currentCourseId);
        }
        
        if (typeof showNotification === 'function') {
            if (result.passed) {
                showNotification(`🎉 Selamat! Kamu lulus dengan skor ${result.score}%`, 'success');
            } else {
                showNotification(`Skor ${result.score}% belum memenuhi batas kelulusan`, 'error');
            }
        }
        
    } catch (error) {
        console.error('❌ Error submitting quiz:', error);
        resultContainer.className = 'quiz-result failed';
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
            <div style="font-size:48px; margin-bottom:10px;">❌</div>
            <p class="quiz-result-message">Gagal submit jawaban. Silakan coba lagi.</p>
            <button class="quiz-retry-btn" onclick="document.getElementById('quiz-submit-btn').disabled=false;document.getElementById('quiz-submit-btn').textContent='✓ Submit Jawaban';">🔄 Coba Lagi</button>
        `;
    }
}

function displayQuizResult(result, container) {
    if (!result || typeof result.score === 'undefined') {
        container.className = 'quiz-result failed';
        container.style.display = 'block';
        container.innerHTML = `
            <div style="font-size:64px; margin-bottom:16px;">❌</div>
            <div class="quiz-result-score">Error</div>
            <p class="quiz-result-message">❌ Gagal memproses hasil quiz. Silakan coba lagi.</p>
            <button class="quiz-retry-btn" onclick="renderQuizUI({quiz_id: ${currentQuizId}})">🔄 Coba Lagi</button>
        `;
        return;
    }
    
    const isPassed = result.passed || false;
    const score = result.score || 0;
    const passingScore = result.passing_score || 70;
    
    container.className = `quiz-result ${isPassed ? 'passed' : 'failed'}`;
    container.style.display = 'block';
    container.innerHTML = `
        <div style="font-size:64px; margin-bottom:16px;">${isPassed ? '🎉' : '💪'}</div>
        <div class="quiz-result-score">${score}%</div>
        <p class="quiz-result-message">
            ${isPassed 
                ? `🎉 Selamat! Kamu lulus dengan skor ${score}% (Passing: ${passingScore}%)` 
                : `❌ Skor ${score}% belum memenuhi batas kelulusan (${passingScore}%). Coba lagi!`}
        </p>
        ${!isPassed ? `<button class="quiz-retry-btn" onclick="renderQuizUI({quiz_id: ${currentQuizId}})">🔄 Coba Lagi</button>` : ''}
    `;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/*
========================================
📊 PROGRESS & COMPLETION FUNCTIONS
========================================
*/
async function toggleLessonComplete(courseId, meetingId, isCompleted) {
    const token = getAuthToken();
    if (!token) { 
        if (typeof showNotification === 'function') {
            showNotification('Silakan login terlebih dahulu', 'error');
        }
        return; 
    }
    
    try {
        if (isCompleted) {
            completedMeetings.add(meetingId);
        } else {
            completedMeetings.delete(meetingId);
        }
        saveCompletedMeetings(courseId);
        
        updateCourseProgressBar();
        renderMeetings(courseData.meetings || []);

        // ✅ Check course completion
        await checkCourseCompletion(courseId);
        
        try {
            await updateProgress(courseId, meetingId, isCompleted);
        } catch (apiError) {
            console.warn('⚠️ Backend sync failed, but local state saved:', apiError);
        }
        
        await checkCourseCompletion(courseId);
        
        if (typeof showNotification === 'function') {
            showNotification(isCompleted ? '✓ Progress berhasil disimpan!' : 'Progress diupdate', 'success');
        }
    } catch (error) {
        console.error('❌ Error toggling lesson:', error);
        if (typeof showNotification === 'function') {
            showNotification('Gagal mengupdate progress', 'error');
        }
        const checkbox = document.getElementById(`checkbox-meeting-${meetingId}`);
        if (checkbox) checkbox.checked = !isCompleted;
    }
}

async function updateProgress(courseId, meetingId, isCompleted) {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/${courseId}/progress`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Accept': 'application/json', 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ meeting_id: meetingId, is_completed: isCompleted })
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return await response.json();
}

// Pastikan fungsi ini dipanggil setiap kali lesson/quiz selesai
async function checkCourseCompletion(courseId) {
    if (!courseData || !courseData.meetings) return;
    
    const meetings = courseData.meetings;
    const actualLessons = meetings.filter(m => {
        return m.content || m.quiz_id || (m.type && ['test', 'quiz', 'final'].includes(m.type));
    });
    
    const allCompleted = actualLessons.every(m => completedMeetings.has(m.id));
    
    console.log('📊 Course Completion Check:', {
        total: actualLessons.length,
        completed: actualLessons.filter(m => completedMeetings.has(m.id)).length,
        allCompleted: allCompleted
    });
    
    if (allCompleted && actualLessons.length > 0) {
        // Cek apakah celebration sudah pernah ditampilkan
        const hasCelebrated = sessionStorage.getItem(`celebrated_course_${courseId}`);
        
        if (!hasCelebrated) {
            sessionStorage.setItem(`celebrated_course_${courseId}`, 'true');
            setTimeout(() => {
                showCourseCompletedCelebration(courseId);
            }, 500);
        }
    }
    
    return { course_completed: allCompleted };
}

/*
========================================
🎉 CELEBRATION OVERLAY
========================================
*/
function showCourseCompletedCelebration(courseId) {
    const existing = document.querySelector('.celebration-overlay');
    if (existing) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.innerHTML = `
        <div class="emoji">🎉</div>
        <h2>Course Completed!</h2>
        <p>Selamat! Kamu telah menyelesaikan course ini dan mendapatkan certificate. 🏆</p>
        <div class="btn-group">
            <button class="btn btn-certificate" onclick="downloadCertificate(${courseId})">
                📥 Download Certificate
            </button>
            <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">
                🏠 View Dashboard
            </button>
            <button class="btn btn-secondary" onclick="this.closest('.celebration-overlay').remove()">
                ✕ Keep Learning
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
    createConfetti(overlay);
    if (typeof showNotification === 'function') {
        showNotification('🎉 Selamat! Kamu telah menyelesaikan course!', 'success');
    }
}

function createConfetti(container) {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#a67cda', '#ef4444'];
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `background:${colors[i%colors.length]};left:${Math.random()*100}%;top:-10px;animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*0.5}s;`;
        container.appendChild(confetti);
    }
}

/*
========================================
🚀 INIT: Run When Page Loads
========================================
*/
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 course-details.js loaded');
    
    if (!isLoggedIn()) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    if (userNameEl) {
        const user = api.getUser();
        if (user?.name) {
            userNameEl.textContent = user.name.split(' ')[0];
        }
    }
    
    const { courseId, title } = getUrlParams();
    
    if (!courseId) {
        if (meetingList) {
            meetingList.innerHTML = `<p style="color:#e53935;padding:20px; text-align:center;">❌ Course ID tidak ditemukan.<br><a href="courses.html" style="color:var(--blue);">← Kembali ke Courses</a></p>`;
        }
        return;
    }
    
    currentCourseId = courseId;
    if (title && pageTitleEl) pageTitleEl.textContent = decodeURIComponent(title);
    
    loadCourseDetails(courseId);
});