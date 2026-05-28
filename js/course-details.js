/*
========================================
CONFIG & ELEMENTS
========================================
*/

const API_BASE_URL = 'http://127.0.0.1:8000/api';
const API_URL = `${API_BASE_URL}/courses`;

const meetingList = document.getElementById('meeting-list');
const lessonList = document.getElementById('lesson-list');
const contentContainer = document.getElementById('content-container');
const meetingTitleEl = document.getElementById('meeting-title');
const meetingLabelEl = document.getElementById('meeting-label');
const pageTitleEl = document.getElementById('page-title');
const logoutBtn = document.getElementById('logoutBtn');

// Global state
let courseData = null;
let currentMeetingId = null;
let currentCourseId = null;
let currentQuizId = null;
let currentQuizMeetingId = null;  // ✅ NEW: Store Meeting ID for quiz (bukan Quiz ID!)

/*
========================================
UTILS: Baca Parameter URL & Auth
========================================
*/

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        courseId: params.get('course_id'),
        title: params.get('title')
    };
}

function getAuthToken() {
    return localStorage.getItem('speakout_token');
}

function isLoggedIn() {
    return !!getAuthToken();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/*
========================================
FETCH COURSE DETAILS
========================================
*/

async function loadCourseDetails(courseId) {
    const token = getAuthToken();
    
    try {
        const response = await fetch(`${API_URL}/${courseId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ERROR ${response.status}`);
        
        const data = await response.json();
        courseData = data;
        currentCourseId = courseId;
        
        if (pageTitleEl) pageTitleEl.textContent = data.title || 'Course Details';
        renderMeetings(data.meetings || []);

    } catch (error) {
        console.error('Error loading course:', error);
        if (meetingList) {
            meetingList.innerHTML = `
                <p style="color: #e53935; text-align: center; padding: 20px;">
                    ❌ Gagal memuat materi.<br>
                    <small>${error.message}</small>
                </p>
            `;
        }
    }
}

/*
========================================
SETUP LOGOUT BUTTON
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
RENDER SIDEBAR: Daftar Pertemuan (FIXED: Quiz Meeting Included)
========================================
*/

function renderMeetings(meetings) {
    if (!meetings || meetings.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666;">Belum ada pertemuan tersedia.</p>';
        return;
    }

    // ✅ FIXED: Include 'quiz' type meetings in sidebar headers
    const meetingHeaders = meetings.filter(m => 
        (m.type === 'normal' && (m.content === null || m.content === '')) ||
        m.type === 'quiz'  // ← Quiz meetings now appear in sidebar!
    );
    
    if (meetingHeaders.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666;">Tidak ada pertemuan ditemukan.</p>';
        return;
    }

    meetingList.innerHTML = '';

    meetingHeaders.forEach((meeting, index) => {
        const meetingEl = document.createElement('div');
        meetingEl.className = 'meeting-item';
        
        if (index === 0) {
            meetingEl.classList.add('active');
            currentMeetingId = meeting.id;
        }
        
        meetingEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
        
        meetingEl.addEventListener('click', function() {
            document.querySelectorAll('.meeting-item').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            
            currentMeetingId = meeting.id;
            
            // ✅ FIXED: If clicked meeting is a quiz, render quiz UI directly
            if (meeting.type === 'quiz' && meeting.quiz_id) {
                renderQuizUI(meeting);
                if (meetingTitleEl) meetingTitleEl.textContent = meeting.title || 'Quiz';
                if (meetingLabelEl) meetingLabelEl.textContent = `Pertemuan ${meeting.order_number || index + 1}`;
                return;
            }
            
            // For normal meetings: find lessons between this meeting and next
            const currentOrder = meeting.order_number;
            const nextMeeting = meetingHeaders[index + 1];
            const nextOrder = nextMeeting ? nextMeeting.order_number : Infinity;
            
            const items = meetings.filter(m => 
                (m.content !== null && m.content !== '') && 
                m.order_number > currentOrder && 
                m.order_number < nextOrder
            );
            
            if (items.length > 0 && items[0].type === 'quiz' && items[0].quiz_id) {
                renderQuizUI(items[0]);
            } else {
                renderLessons(items);
            }
            
            if (meetingTitleEl) meetingTitleEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
            if (meetingLabelEl) meetingLabelEl.textContent = `Pertemuan ${index + 1}`;
        });
        
        meetingList.appendChild(meetingEl);
    });

    // Auto render first meeting on page load
    const firstMeeting = meetingHeaders[0];
    if (firstMeeting) {
        meetingTitleEl.textContent = firstMeeting.title || 'Pertemuan 1';
        meetingLabelEl.textContent = 'Pertemuan 1';
        
        // If first meeting is a quiz, render it directly
        if (firstMeeting.type === 'quiz' && firstMeeting.quiz_id) {
            renderQuizUI(firstMeeting);
            return;
        }
        
        const nextMeeting = meetingHeaders[1];
        const nextOrder = nextMeeting ? nextMeeting.order_number : Infinity;
        
        const items = meetings.filter(m => 
            (m.content !== null && m.content !== '') && 
            m.order_number > firstMeeting.order_number && 
            m.order_number < nextOrder
        );
        
        if (items.length > 0 && items[0].type === 'quiz' && items[0].quiz_id) {
            renderQuizUI(items[0]);
        } else {
            renderLessons(items);
        }
    }
}

/*
========================================
🔥 QUIZ SYSTEM FUNCTIONS (Dengan Progress Bar)
========================================
*/

async function renderQuizUI(quizItem) {
    const quizId = quizItem.quiz_id;
    currentQuizId = quizId;
    
    // ✅ FIXED: Simpan Meeting ID (bukan Quiz ID!) untuk update progress nanti
    currentQuizMeetingId = quizItem.id;
    
    if (!contentContainer) {
        console.error('content-container element not found');
        return;
    }
    
    contentContainer.innerHTML = `
        <div class="quiz-container">
            <div class="quiz-loading">
                <div class="spinner"></div>
                <p>Loading quiz questions...</p>
            </div>
        </div>
    `;
    
    try {
        const token = getAuthToken();
        
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to load quiz');
        
        const quiz = await response.json();
        
        // Render quiz WITH progress bar & one-question-at-a-time
        contentContainer.innerHTML = `
            <div class="quiz-container">
                <!-- 🔥 PROGRESS BAR -->
                <div class="quiz-progress">
                    <span class="quiz-progress-text" id="quiz-progress-text">Question 1 of ${quiz.questions.length}</span>
                    <div class="quiz-progress-bar">
                        <div class="quiz-progress-fill" id="quiz-progress-fill" style="width: ${100 / quiz.questions.length}%"></div>
                    </div>
                </div>
                
                <h3 style="margin-bottom: 20px; font-family: 'Playfair Display', serif;">${escapeHtml(quiz.title)}</h3>
                <p style="color: var(--gray); margin-bottom: 24px; font-size: 14px;">
                    Passing Score: <strong>${quiz.passing_score}%</strong>
                    ${quiz.time_limit ? `| Time Limit: ${quiz.time_limit} menit` : ''}
                </p>
                
                <form id="quiz-form">
                    ${quiz.questions.map((q, index) => `
                        <div class="quiz-question" data-question-id="${q.id}" style="display: ${index === 0 ? 'block' : 'none'}">
                            <div>
                                <span class="quiz-question-number">${index + 1}</span>
                                <span class="quiz-question-text">${escapeHtml(q.question)}</span>
                            </div>
                            <div class="quiz-options">
                                ${q.options.map((option, optIndex) => {
                                    const optionLetter = String.fromCharCode(65 + optIndex);
                                    return `
                                        <label class="quiz-option" data-option="${optionLetter}">
                                            <input type="radio" name="question_${q.id}" value="${optionLetter}" required>
                                            <span><strong>${optionLetter}.</strong> ${escapeHtml(option)}</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                    
                    <!-- Navigation Buttons -->
                    <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: space-between;">
                        <button type="button" class="quiz-retry-btn" id="quiz-prev-btn" style="display: none;">← Previous</button>
                        <button type="button" class="quiz-submit-btn" id="quiz-next-btn">Next →</button>
                        <button type="submit" class="quiz-submit-btn" id="quiz-submit-btn" style="display: none;">Submit Answers</button>
                    </div>
                </form>
                
                <div id="quiz-result" class="quiz-result" style="display: none;"></div>
            </div>
        `;
        
        // Initialize progress & navigation logic
        let currentQuestionIndex = 0;
        const totalQuestions = quiz.questions.length;
        const progressText = document.getElementById('quiz-progress-text');
        const progressFill = document.getElementById('quiz-progress-fill');
        const prevBtn = document.getElementById('quiz-prev-btn');
        const nextBtn = document.getElementById('quiz-next-btn');
        const submitBtn = document.getElementById('quiz-submit-btn');
        
        function updateProgress() {
            progressText.textContent = `Question ${currentQuestionIndex + 1} of ${totalQuestions}`;
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
            const currentQuestion = document.querySelectorAll('.quiz-question')[currentQuestionIndex];
            const selected = currentQuestion?.querySelector('input[type="radio"]:checked');
            if (!selected) {
                alert('Please answer this question before proceeding.');
                return;
            }
            if (currentQuestionIndex < totalQuestions - 1) {
                currentQuestionIndex++;
                updateProgress();
            }
        });
        
        updateProgress();
        
        // Attach submit handler
        document.getElementById('quiz-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            submitQuizAnswers(quizId);
        });
        
        // Custom radio styling
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.quiz-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                this.querySelector('input[type="radio"]').checked = true;
            });
        });
        
    } catch (error) {
        console.error('Error loading quiz:', error);
        contentContainer.innerHTML = `
            <div class="quiz-container">
                <p style="color: var(--error); text-align: center; padding: 20px;">Failed to load quiz. Please try again.</p>
                <button class="quiz-retry-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

async function submitQuizAnswers(quizId) {
    const token = getAuthToken();
    const submitBtn = document.getElementById('quiz-submit-btn');
    const resultContainer = document.getElementById('quiz-result');
    
    // Collect ALL answers from all questions
    const answers = {};
    document.querySelectorAll('.quiz-question').forEach(qEl => {
        const questionId = qEl.dataset.questionId;
        const selected = qEl.querySelector('input[type="radio"]:checked');
        if (selected) answers[questionId] = selected.value;
    });
    
    const totalQuestions = document.querySelectorAll('.quiz-question').length;
    if (Object.keys(answers).length < totalQuestions) {
        alert('Please answer all questions before submitting.');
        return;
    }
    
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
        
        // ✅ FIXED: Gunakan currentQuizMeetingId (Meeting ID), bukan currentQuizId (Quiz ID)
        if (result.passed && currentCourseId && currentQuizMeetingId) {
            await updateProgress(currentCourseId, currentQuizMeetingId, true);
            await checkCourseCompletion(currentCourseId);
        }
        
    } catch (error) {
        console.error('Error submitting quiz:', error);
        resultContainer.className = 'quiz-result failed';
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
            <p class="quiz-result-message">❌ Failed to submit answers. Please try again.</p>
            <button class="quiz-retry-btn" onclick="document.getElementById('quiz-submit-btn').disabled = false; document.getElementById('quiz-submit-btn').textContent = 'Submit Answers';">Try Again</button>
        `;
    }
}

function displayQuizResult(result, container) {
    const isPassed = result.passed;
    
    container.className = `quiz-result ${isPassed ? 'passed' : 'failed'}`;
    container.style.display = 'block';
    
    container.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">${isPassed ? '🎉' : '💪'}</div>
        <div class="quiz-result-score">${result.score}%</div>
        <p class="quiz-result-message">
            ${isPassed 
                ? `🎉 Selamat! Kamu lulus dengan skor ${result.score}% (Passing: ${result.passing_score}%)` 
                : `❌ Skor ${result.score}% belum memenuhi batas kelulusan (${result.passing_score}%). Coba lagi!`
            }
        </p>
        ${!isPassed ? `<button class="quiz-retry-btn" onclick="renderQuizUI({quiz_id: ${currentQuizId}})">🔄 Coba Lagi</button>` : ''}
    `;
    
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/*
========================================
RENDER CONTENT: Daftar Lesson
========================================
*/

function renderLessons(lessons) {
    if (!contentContainer) {
        console.error('content-container element not found');
        return;
    }
    
    contentContainer.innerHTML = '';

    if (!lessons || lessons.length === 0) {
        contentContainer.innerHTML = `
            <p style="color: #666; text-align: center; padding: 30px;">
                📭 Belum ada materi untuk pertemuan ini.<br>
                <small>Silakan cek kembali nanti.</small>
            </p>
        `;
        return;
    }

    const lessonListEl = document.createElement('ul');
    lessonListEl.className = 'lesson-list';
    lessonListEl.id = 'lesson-list';

    lessons.forEach((lesson, index) => {
        const lessonItem = document.createElement('li');
        lessonItem.className = 'lesson-item';
        
        let iconText = '📄';
        let tagText = 'Materi';
        
        if (lesson.type === 'test' || lesson.type === 'quiz') { iconText = '✍️'; tagText = 'Quiz'; }
        else if (lesson.type === 'final') { iconText = '🏆'; tagText = 'Final Test'; }
        else if (lesson.title?.toLowerCase().includes('video')) { iconText = '🎬'; tagText = 'Video'; }
        else if (lesson.title?.toLowerCase().includes('listening') || lesson.title?.toLowerCase().includes('audio')) { iconText = '🎧'; tagText = 'Audio'; }
        else if (lesson.title?.toLowerCase().includes('reading')) { iconText = '📖'; tagText = 'Reading'; }
        
        const lessonLink = lesson.content || lesson.google_drive_link || lesson.link || '#';
        const isDisabled = lessonLink === '#';
        
        lessonItem.innerHTML = `
            <div class="lesson-icon">${iconText}</div>
            <a href="${lessonLink}" class="lesson-link ${isDisabled ? 'disabled' : ''}" target="_blank" ${isDisabled ? 'onclick="return false"' : ''}>
                ${escapeHtml(lesson.title || `Lesson ${index + 1}`)}
            </a>
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
PROGRESS & COMPLETION FUNCTIONS
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
        console.error('Error toggling lesson complete:', error);
        alert('Failed to update progress. Please try again.');
        const checkbox = document.getElementById(`lesson-${meetingId}`);
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

async function checkCourseCompletion(courseId) {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/${courseId}/check-completion`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
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
    overlay.innerHTML = `
        <div class="emoji">🎉</div>
        <h2>Course Completed!</h2>
        <p>Congratulations! You've earned your certificate. 🏆</p>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">View Dashboard</button>
            <button class="btn btn-secondary" onclick="this.closest('.celebration-overlay').remove()">Keep Learning</button>
        </div>
    `;
    document.body.appendChild(overlay);
    createConfetti(overlay);
}

function createConfetti(container) {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#a67cda', '#ef4444'];
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            background: ${colors[i % colors.length]};
            left: ${Math.random() * 100}%;
            top: -10px;
            animation-duration: ${2 + Math.random() * 3}s;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        container.appendChild(confetti);
    }
}

/*
========================================
INIT: Jalankan Saat Halaman Load
========================================
*/

document.addEventListener('DOMContentLoaded', function() {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return; }

    const { courseId, title } = getUrlParams();
    
    if (!courseId) {
        if (meetingList) {
            meetingList.innerHTML = `
                <p style="color: #e53935; padding: 20px;">
                    ❌ Course ID tidak ditemukan.<br>
                    <a href="courses.html" style="color: var(--blue);">← Kembali ke Courses</a>
                </p>
            `;
        }
        return;
    }
    
    currentCourseId = courseId;
    if (title && pageTitleEl) pageTitleEl.textContent = decodeURIComponent(title);
    loadCourseDetails(courseId);
});