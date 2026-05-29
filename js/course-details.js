/*
========================================
📁 course-details.js - Course Detail & Quiz Logic
🎯 Handle: Load course, render lessons, quiz UI, progress tracking
✅ FIX: Sidebar meeting tidak hilang, logic click lebih robust
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
const lessonList = document.getElementById('lesson-list');
const contentContainer = document.getElementById('content-container');
const meetingTitleEl = document.getElementById('meeting-title');
const meetingLabelEl = document.getElementById('meeting-label');
const pageTitleEl = document.getElementById('page-title');
const logoutBtn = document.getElementById('logoutBtn');

// Global State
let courseData = null;
let currentMeetingId = null;
let currentCourseId = null;
let currentQuizId = null;
let currentQuizMeetingId = null;

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
        renderMeetings(data.meetings || []);
    } catch (error) {
        console.error('❌ Error loading course:', error);
        if (meetingList) {
            meetingList.innerHTML = `<p style="color: #e53935; text-align: center; padding: 20px;">❌ Gagal memuat materi.<br><small>${error.message}</small></p>`;
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
            localStorage.removeItem('speakout_token');
            localStorage.removeItem('speakout_user');
            window.location.href = 'login.html';
        }
    });
}

/*
========================================
📋 RENDER SIDEBAR: Daftar Pertemuan (FIXED VERSION)
✅ Show ALL meetings, handle click based on meeting properties
========================================
*/
function renderMeetings(meetings) {
    console.log('🔍 renderMeetings called:', { count: meetings?.length });
    
    if (!meetings || meetings.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666;">Belum ada pertemuan tersedia.</p>';
        return;
    }

    // ✅ FIX: Sort meetings by order_number first (ensure correct display order)
    const sortedMeetings = [...meetings].sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
    
    meetingList.innerHTML = '';

    sortedMeetings.forEach((meeting, index) => {
        const meetingEl = document.createElement('div');
        meetingEl.className = 'meeting-item';
        
        // Set active for first item
        if (index === 0) {
            meetingEl.classList.add('active');
            currentMeetingId = meeting.id;
        }
        
        // Display title with type indicator
        const typeIcon = meeting.type === 'quiz' ? '📝 ' : meeting.type === 'test' ? '✍️ ' : '📁 ';
        meetingEl.textContent = `${typeIcon}${meeting.title || `Pertemuan ${index + 1}`}`;
        
        // ✅ Robust click handler: decide what to render based on meeting properties
        meetingEl.addEventListener('click', function() {
            console.log('🔍 Sidebar click:', { 
                meeting_id: meeting.id, 
                title: meeting.title, 
                type: meeting.type, 
                quiz_id: meeting.quiz_id,
                has_content: !!meeting.content 
            });
            
            // Update active state
            document.querySelectorAll('.meeting-item').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            currentMeetingId = meeting.id;
            
            // Update header text
            if (meetingTitleEl) meetingTitleEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
            if (meetingLabelEl) meetingLabelEl.textContent = ``;
            
            // ✅ Decision tree: what to render?
            if (meeting.quiz_id && (meeting.type === 'quiz' || meeting.type === 'test' || meeting.type === 'final')) {
                // 🎯 Case 1: Meeting is a quiz → render quiz UI
                console.log('🎯 Rendering quiz UI for quiz_id:', meeting.quiz_id);
                currentQuizId = meeting.quiz_id;
                currentQuizMeetingId = meeting.id;
                renderQuizUI(meeting);
                
            } else if (meeting.content && meeting.content.trim() !== '') {
                // 📄 Case 2: Meeting has content (Google Drive link) → render lesson
                console.log('📄 Rendering lesson with content:', meeting.content.substring(0, 50) + '...');
                renderLessonContent(meeting);
                
            } else {
                // 📁 Case 3: Section header (no content, no quiz) → show info message
                console.log('📁 Section header clicked (no content/quiz)');
                if (contentContainer) {
                    contentContainer.innerHTML = `
                        <div style="text-align:center; padding:40px; color:var(--gray);">
                            <div style="font-size:48px; margin-bottom:16px;">📁</div>
                            <h3 style="margin-bottom:8px;">${escapeHtml(meeting.title)}</h3>
                            <p>Pilih materi di bawah untuk memulai belajar.</p>
                        </div>
                    `;
                }
            }
        });
        
        meetingList.appendChild(meetingEl);
    });

    // ✅ Auto-render first meeting on page load
    if (sortedMeetings.length > 0) {
        const firstMeeting = sortedMeetings[0];
        if (meetingTitleEl) meetingTitleEl.textContent = firstMeeting.title || 'Pertemuan 1';
        if (meetingLabelEl) meetingLabelEl.textContent = `Pertemuan ${firstMeeting.order_number || 1}`;
        
        // Trigger click on first item to load its content
        meetingList.querySelector('.meeting-item')?.click();
    }
}

/*
========================================
📄 RENDER LESSON CONTENT (Google Drive Embed)
========================================
*/
function renderLessonContent(meeting) {
    if (!contentContainer) return;
    
    // Convert Google Drive view link to preview link if needed
    let embedUrl = meeting.content;
    if (embedUrl && embedUrl.includes('/view')) {
        const match = embedUrl.match(/\/d\/([^\/\?]+)/);
        if (match && match[1]) {
            embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }
    
    contentContainer.innerHTML = `
        <div style="background:white; border-radius:16px; padding:24px; box-shadow:0 4px 24px rgba(91,45,142,0.08);">
            <h3 style="margin-bottom:20px; font-family:'Playfair Display',serif;">${escapeHtml(meeting.title)}</h3>
            <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; background:#f8f9fa;">
                <iframe src="${embedUrl}" 
                    style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" 
                    allow="autoplay; encrypted-media" 
                    allowfullscreen 
                    loading="lazy">
                </iframe>
            </div>
            <div style="margin-top:20px; display:flex; gap:12px; align-items:center;">
                <button class="btn-add" onclick="window.open('${meeting.content}', '_blank')" style="padding:10px 20px; font-size:14px;">
                    🔗 Buka di Tab Baru
                </button>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--gray);">
                    <input type="checkbox" class="lesson-checkbox" data-meeting-id="${meeting.id}" onchange="toggleLessonComplete(${currentCourseId}, ${meeting.id}, this.checked)">
                    <span>✓ Tandai selesai</span>
                </label>
            </div>
        </div>
    `;
}

/*
========================================
🔥 QUIZ SYSTEM FUNCTIONS (Dengan Progress Bar + DEBUG LOGGING)
✅ One-question-at-a-time + Progress Bar + Timer + Console Debug
========================================
*/
async function renderQuizUI(quizItem) {
    console.log('🔍 renderQuizUI called:', { 
        id: quizItem.id, title: quizItem.title, quiz_id: quizItem.quiz_id, type: quizItem.type 
    });
    
    const quizId = quizItem.quiz_id;
    currentQuizId = quizId;
    currentQuizMeetingId = quizItem.id;
    
    console.log('🔍 Using quizId for API:', quizId);
    
    if (!contentContainer) { console.error('❌ content-container not found'); return; }
    contentContainer.innerHTML = `<div class="quiz-container"><div class="quiz-loading"><div class="spinner"></div><p>Loading quiz questions...</p></div></div>`;
    
    try {
        const token = getAuthToken();
        console.log('📡 Fetching:', `${API_BASE_URL}/quizzes/${quizId}`);
        
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        console.log('📡 Response status:', response.status);
        if (!response.ok) {
            const errText = await response.text().catch(() => 'No error text');
            console.error('❌ API error:', { status: response.status, text: errText });
            throw new Error(`Failed to load quiz: HTTP ${response.status}`);
        }
        
        const quiz = await response.json();
        
        // ✅ DEBUG: Log quiz response
        console.log('📦 Quiz data:', {
            quiz_id: quiz.id, title: quiz.title, meeting_id: quiz.meeting_id,
            questions_count: quiz.questions?.length,
            sample: quiz.questions?.slice(0,2).map(q => ({ id:q.id, order:q.order }))
        });
        
        if (!quiz.questions || quiz.questions.length === 0) {
            console.warn('⚠️ No questions in quiz!', { quiz_id: quiz.id });
            contentContainer.innerHTML = `<div class="quiz-container"><p style="color:var(--gray);text-align:center;padding:30px;">📭 Belum ada soal untuk quiz ini.<br><small>Hubungi admin untuk menambahkan soal.</small></p></div>`;
            return;
        }
        
        // ✅ START QUIZ TIMER
        if (typeof startQuizTimer === 'function') {
            console.log('⏱️ Starting timer:', quiz.time_limit, 'min');
            startQuizTimer(quiz.time_limit);
        }
        
        // ✅ Sort questions by 'order' field
        const sortedQuestions = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
        console.log('📋 Sorted questions:', sortedQuestions.map(q => ({ id: q.id, order: q.order })));
        
        // Render quiz UI
        contentContainer.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-progress">
                    <span class="quiz-progress-text" id="quiz-progress-text">Question 1 of ${sortedQuestions.length}</span>
                    <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="quiz-progress-fill" style="width: ${100 / sortedQuestions.length}%"></div></div>
                </div>
                <h3 style="margin-bottom:20px;font-family:'Playfair Display',serif;">${escapeHtml(quiz.title)}</h3>
                <p style="color:var(--gray);margin-bottom:24px;font-size:14px;">
                    Passing Score: <strong>${quiz.passing_score}%</strong>
                    ${quiz.time_limit ? `| Time Limit: ${quiz.time_limit} menit` : ''}
                </p>
                <form id="quiz-form">
                    ${sortedQuestions.map((q, index) => `
                        <div class="quiz-question" data-question-id="${q.id}" style="display:${index===0?'block':'none'}">
                            <div><span class="quiz-question-number">${index+1}</span><span class="quiz-question-text">${escapeHtml(q.question)}</span></div>
                            <div class="quiz-options">
                                ${Array.isArray(q.options) ? q.options.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    return `<label class="quiz-option" data-option="${letter}"><input type="radio" name="question_${q.id}" value="${letter}" required><span><strong>${letter}.</strong> ${escapeHtml(opt)}</span></label>`;
                                }).join('') : '<p style="color:#999">No options available</p>'}
                            </div>
                        </div>
                    `).join('')}
                    <div style="display:flex;gap:12px;margin-top:20px;justify-content:space-between;">
                        <button type="button" class="quiz-retry-btn" id="quiz-prev-btn" style="display:none;">← Previous</button>
                        <button type="button" class="quiz-submit-btn" id="quiz-next-btn">Next →</button>
                        <button type="submit" class="quiz-submit-btn" id="quiz-submit-btn" style="display:none;">Submit Answers</button>
                    </div>
                </form>
                <div id="quiz-result" class="quiz-result" style="display:none;"></div>
            </div>
        `;
        
        console.log('✅ Quiz UI rendered');
        
        // Progress & navigation logic
        let currentQuestionIndex = 0;
        const totalQuestions = sortedQuestions.length;
        const progressText = document.getElementById('quiz-progress-text');
        const progressFill = document.getElementById('quiz-progress-fill');
        const prevBtn = document.getElementById('quiz-prev-btn');
        const nextBtn = document.getElementById('quiz-next-btn');
        const submitBtn = document.getElementById('quiz-submit-btn');
        
        function updateProgress() {
            progressText.textContent = `Question ${currentQuestionIndex + 1} of ${totalQuestions}`;
            progressFill.style.width = `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`;
            prevBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'block';
            if (currentQuestionIndex === totalQuestions - 1) { nextBtn.style.display = 'none'; submitBtn.style.display = 'block'; }
            else { nextBtn.style.display = 'block'; submitBtn.style.display = 'none'; }
            document.querySelectorAll('.quiz-question').forEach((qEl, idx) => { qEl.style.display = idx === currentQuestionIndex ? 'block' : 'none'; });
        }
        
        prevBtn?.addEventListener('click', () => { if (currentQuestionIndex > 0) { currentQuestionIndex--; updateProgress(); } });
        nextBtn?.addEventListener('click', () => {
            const currentQ = document.querySelectorAll('.quiz-question')[currentQuestionIndex];
            const selected = currentQ?.querySelector('input[type="radio"]:checked');
            if (!selected) { alert('Please answer this question before proceeding.'); return; }
            if (currentQuestionIndex < totalQuestions - 1) { currentQuestionIndex++; updateProgress(); }
        });
        
        updateProgress();
        document.getElementById('quiz-form')?.addEventListener('submit', (e) => { e.preventDefault(); console.log('📤 Form submitted'); submitQuizAnswers(currentQuizId); });
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input[type="radio"]').checked = true;
            });
        });
        
    } catch (error) {
        console.error('❌ Error in renderQuizUI:', error);
        contentContainer.innerHTML = `<div class="quiz-container"><p style="color:var(--error);text-align:center;padding:20px;">❌ Failed to load quiz.<br><small>${error.message}</small></p><button class="quiz-retry-btn" onclick="location.reload()">Retry</button></div>`;
    }
}

async function submitQuizAnswers(quizId) {
    console.log('📤 submitQuizAnswers called with quizId:', quizId);
    const token = getAuthToken();
    const submitBtn = document.getElementById('quiz-submit-btn');
    const resultContainer = document.getElementById('quiz-result');
    
    const answers = {};
    document.querySelectorAll('.quiz-question').forEach(qEl => {
        const qId = qEl.dataset.questionId;
        const selected = qEl.querySelector('input[type="radio"]:checked');
        if (selected) { answers[qId] = selected.value; console.log('📝 Answer:', { qId, value: selected.value }); }
    });
    console.log('📦 Answers collected:', Object.keys(answers).length);
    
    const totalQuestions = document.querySelectorAll('.quiz-question').length;
    if (Object.keys(answers).length < totalQuestions) { alert('Please answer all questions before submitting.'); return; }
    
    if (typeof stopQuizTimer === 'function') { console.log('⏱️ Stopping timer'); stopQuizTimer(); }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        console.log('📡 Submitting to:', `${API_BASE_URL}/quizzes/${quizId}/submit`);
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
        });
        console.log('📡 Submit response:', response.status);
        const result = await response.json();
        console.log('📦 Submit result:', { success: result.success, score: result.score, passed: result.passed });
        displayQuizResult(result, resultContainer);
        if (result.passed && currentCourseId && currentQuizMeetingId) {
            console.log('✅ Quiz passed, updating progress');
            await updateProgress(currentCourseId, currentQuizMeetingId, true);
            await checkCourseCompletion(currentCourseId);
        }
    } catch (error) {
        console.error('❌ Error submitting quiz:', error);
        resultContainer.className = 'quiz-result failed';
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `<p class="quiz-result-message">❌ Failed to submit answers. Please try again.</p><button class="quiz-retry-btn" onclick="document.getElementById('quiz-submit-btn').disabled=false;document.getElementById('quiz-submit-btn').textContent='Submit Answers';">Try Again</button>`;
    }
}

function displayQuizResult(result, container) {
    const isPassed = result.passed;
    container.className = `quiz-result ${isPassed ? 'passed' : 'failed'}`;
    container.style.display = 'block';
    container.innerHTML = `
        <div style="font-size:48px;margin-bottom:10px;">${isPassed ? '🎉' : '💪'}</div>
        <div class="quiz-result-score">${result.score}%</div>
        <p class="quiz-result-message">${isPassed ? `🎉 Selamat! Kamu lulus dengan skor ${result.score}% (Passing: ${result.passing_score}%)` : `❌ Skor ${result.score}% belum memenuhi batas kelulusan (${result.passing_score}%). Coba lagi!`}</p>
        ${!isPassed ? `<button class="quiz-retry-btn" onclick="renderQuizUI({quiz_id: ${currentQuizId}})">🔄 Coba Lagi</button>` : ''}
    `;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/*
========================================
📚 RENDER CONTENT: Daftar Lesson (Fallback)
========================================
*/
function renderLessons(lessons) {
    if (!contentContainer) { console.error('❌ content-container not found'); return; }
    contentContainer.innerHTML = '';
    if (!lessons || lessons.length === 0) {
        contentContainer.innerHTML = `<p style="color:#666;text-align:center;padding:30px;">📭 Belum ada materi untuk pertemuan ini.<br><small>Silakan cek kembali nanti.</small></p>`;
        return;
    }
    const lessonListEl = document.createElement('ul');
    lessonListEl.className = 'lesson-list';
    lessonListEl.id = 'lesson-list';
    lessons.forEach((lesson, index) => {
        const lessonItem = document.createElement('li');
        lessonItem.className = 'lesson-item';
        let iconText = '📄', tagText = 'Materi';
        if (lesson.type === 'test' || lesson.type === 'quiz') { iconText = '✍️'; tagText = 'Quiz'; }
        else if (lesson.type === 'final') { iconText = '🏆'; tagText = 'Final Test'; }
        else if (lesson.title?.toLowerCase().includes('video')) { iconText = '🎬'; tagText = 'Video'; }
        else if (lesson.title?.toLowerCase().includes('listening') || lesson.title?.toLowerCase().includes('audio')) { iconText = '🎧'; tagText = 'Audio'; }
        else if (lesson.title?.toLowerCase().includes('reading')) { iconText = '📖'; tagText = 'Reading'; }
        const lessonLink = lesson.content || lesson.google_drive_link || lesson.link || '#';
        const isDisabled = lessonLink === '#';
        lessonItem.innerHTML = `
            <div class="lesson-icon">${iconText}</div>
            <a href="${lessonLink}" class="lesson-link ${isDisabled ? 'disabled' : ''}" target="_blank" ${isDisabled ? 'onclick="return false"' : ''}>${escapeHtml(lesson.title || `Lesson ${index + 1}`)}</a>
            <span class="lesson-tag">${tagText}</span>
            <div class="lesson-complete">
                <input type="checkbox" id="lesson-${lesson.id}" class="lesson-checkbox" data-meeting-id="${lesson.id}" ${lesson.is_completed ? 'checked' : ''} onchange="toggleLessonComplete(${currentCourseId}, ${lesson.id}, this.checked)">
                <label for="lesson-${lesson.id}">${lesson.is_completed ? '✓ Done' : 'Mark Done'}</label>
            </div>
        `;
        lessonListEl.appendChild(lessonItem);
    });
    contentContainer.appendChild(lessonListEl);
}

/*
========================================
📊 PROGRESS & COMPLETION FUNCTIONS
========================================
*/
async function toggleLessonComplete(courseId, meetingId, isCompleted) {
    const token = getAuthToken();
    if (!token) { alert('Please login first'); return; }
    try {
        await updateProgress(courseId, meetingId, isCompleted);
        await checkCourseCompletion(courseId);
        const checkbox = document.getElementById(`lesson-${meetingId}`);
        if (checkbox) {
            checkbox.nextElementSibling.style.color = isCompleted ? 'var(--success)' : 'var(--gray)';
            checkbox.nextElementSibling.textContent = isCompleted ? '✓ Done' : 'Mark Done';
        }
    } catch (error) {
        console.error('❌ Error toggling lesson:', error);
        alert('Failed to update progress. Please try again.');
        const checkbox = document.getElementById(`lesson-${meetingId}`);
        if (checkbox) checkbox.checked = !isCompleted;
    }
}
async function updateProgress(courseId, meetingId, isCompleted) {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/${courseId}/progress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, is_completed: isCompleted })
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return await response.json();
}
async function checkCourseCompletion(courseId) {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/${courseId}/check-completion`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('Failed to check completion');
    const data = await response.json();
    if (data.course_completed) showCourseCompletedCelebration(courseId);
    return data;
}
function showCourseCompletedCelebration(courseId) {
    const existing = document.querySelector('.celebration-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.innerHTML = `<div class="emoji">🎉</div><h2>Course Completed!</h2><p>Congratulations! You've earned your certificate. 🏆</p><div class="btn-group"><button class="btn btn-primary" onclick="window.location.href='dashboard.html'">View Dashboard</button><button class="btn btn-secondary" onclick="this.closest('.celebration-overlay').remove()">Keep Learning</button></div>`;
    document.body.appendChild(overlay);
    createConfetti(overlay);
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
    if (!isLoggedIn()) { console.log('🔐 Not logged in, redirecting'); window.location.href = 'login.html'; return; }
    const { courseId, title } = getUrlParams();
    console.log('📦 URL params:', { courseId, title });
    if (!courseId) {
        console.error('❌ No courseId in URL');
        if (meetingList) meetingList.innerHTML = `<p style="color:#e53935;padding:20px;">❌ Course ID tidak ditemukan.<br><a href="courses.html" style="color:var(--blue);">← Kembali ke Courses</a></p>`;
        return;
    }
    currentCourseId = courseId;
    if (title && pageTitleEl) pageTitleEl.textContent = decodeURIComponent(title);
    console.log('📦 Loading course:', courseId);
    loadCourseDetails(courseId);
});