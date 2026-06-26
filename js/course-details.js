/*
========================================
📁 course-details.js - Course Detail & Quiz Logic
🎯 Handle: Load course, render lessons, quiz UI (4 types), progress tracking
✅ UPDATED: Payment validation, Quiz text sistem centang, Quiz Duolingo interaktif
========================================
*/

const API_BASE_URL = typeof API_BASE !== 'undefined' ? API_BASE : 'http://127.0.0.1:8000/api';
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
let completedMeetings = new Set();
let isCourseLocked = false; // ✅ FLAG payment status

// Duolingo-style quiz state
let duoCurrentIndex = 0;
let duoQuestions = [];
let duoAnswers = {};
let duoHearts = 5;
let currentQuizTitle = '';

/*
========================================
🔐 UTILS
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
🔒 PAYMENT VALIDATION
========================================
*/
async function checkPaymentStatus(courseId) {
    const token = getAuthToken();
    if (!token) return { canAccess: false, reason: 'not_logged_in' };

    try {
        const res = await fetch(`${API_BASE_URL}/user/enrollments`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) return { canAccess: false, reason: 'api_error' };

        const data = await res.json();
        const enrollments = data.data || [];
        const enrollment = enrollments.find(e => e.course?.id == courseId);

        if (!enrollment) {
            return { canAccess: false, reason: 'not_enrolled' };
        }

        if (enrollment.payment_status !== 'paid') {
            return {
                canAccess: false,
                reason: 'payment_pending',
                enrollmentId: enrollment.id,
                paymentStatus: enrollment.payment_status,
                amount: enrollment.amount
            };
        }

        return { canAccess: true };

    } catch (err) {
        console.error('❌ Error checking payment status:', err);
        return { canAccess: false, reason: 'error' };
    }
}

function showLockedCourseUI(paymentInfo) {
    isCourseLocked = true; // ✅ Set flag
    const courseTitle = pageTitleEl?.textContent || 'Course';

    if (meetingList) {
        meetingList.innerHTML = `
            <div style="text-align:center; padding:40px 20px;">
                <div style="font-size:64px; margin-bottom:16px;">🔒</div>
                <h3 style="font-family:'Playfair Display',serif; color:var(--dark); margin-bottom:8px;">Course Terkunci</h3>
                <p style="color:var(--gray); font-size:13px;">Selesaikan pembayaran untuk mengakses materi</p>
            </div>
        `;
    }

    if (contentContainer) {
        contentContainer.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="font-size:80px; margin-bottom:20px;">🔒</div>
                <h2 style="font-family:'Playfair Display',serif; font-size:32px; color:var(--dark); margin-bottom:12px;">
                    Course Belum Aktif
                </h2>
                <p style="color:var(--gray); font-size:16px; max-width:500px; margin:0 auto 32px; line-height:1.6;">
                    Anda perlu menyelesaikan pembayaran untuk mengakses materi pembelajaran di course <strong>${escapeHtml(courseTitle)}</strong>.
                </p>
                <div style="background:rgba(245,158,11,0.08); border:2px solid rgba(245,158,11,0.3); border-radius:16px; padding:24px; max-width:400px; margin:0 auto 32px;">
                    <div style="font-size:14px; color:var(--gray); margin-bottom:8px;">Status Pembayaran</div>
                    <div style="font-size:24px; font-weight:700; color:var(--warning); margin-bottom:4px;">
                        ${paymentInfo.paymentStatus === 'pending' ? '⏳ Menunggu Konfirmasi' : '❌ Belum Dibayar'}
                    </div>
                    ${paymentInfo.amount ? `<div style="font-size:18px; color:var(--dark); font-weight:600;">Rp ${parseInt(paymentInfo.amount).toLocaleString('id-ID')}</div>` : ''}
                </div>
                <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                    <button onclick="window.location.href='payment.html?enrollment_id=${paymentInfo.enrollmentId}'"
                            style="padding:14px 32px; background:var(--warning); color:#0d0d18; border:none; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer;">
                        💳 Selesaikan Pembayaran
                    </button>
                    <button onclick="window.location.href='dashboard.html'"
                            style="padding:14px 32px; background:transparent; color:var(--dark); border:2px solid #e0e0f0; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer;">
                        🏠 Kembali ke Dashboard
                    </button>
                </div>
                <div style="margin-top:32px; padding:16px; background:rgba(139,44,152,0.05); border-radius:10px; max-width:400px; margin-left:auto; margin-right:auto;">
                    <p style="font-size:13px; color:var(--gray); margin:0;">
                        💡 <strong>Catatan:</strong> Setelah upload bukti pembayaran, admin akan memverifikasi dalam 1x24 jam.
                        Course akan otomatis aktif setelah pembayaran dikonfirmasi.
                    </p>
                </div>
            </div>
        `;
    }

    if (courseProgressValue) courseProgressValue.textContent = '0%';
    if (courseProgressFill) courseProgressFill.style.width = '0%';
}

/*
========================================
✅ PROGRESS STORAGE
========================================
*/
function getProgressKey(courseId) {
    const userId = api.getUserId();
    return `course_${courseId}_user_${userId}_completed`;
}

function loadCompletedMeetings(courseId) {
    const key = getProgressKey(courseId);
    const saved = localStorage.getItem(key);
    completedMeetings = saved ? new Set(JSON.parse(saved)) : new Set();
}

function saveCompletedMeetings(courseId) {
    const key = getProgressKey(courseId);
    localStorage.setItem(key, JSON.stringify([...completedMeetings]));
}

function clearAllUserProgress() {
    const userId = api.getUserId();
    Object.keys(localStorage).forEach(key => {
        if (key.includes(`user_${userId}`)) localStorage.removeItem(key);
    });
}

/*
========================================
📊 PROGRESS BAR
========================================
*/
function updateCourseProgressBar() {
    if (!courseProgressValue || !courseProgressFill || !courseData) return;

    const meetings = courseData.meetings || [];
    const actualLessons = meetings.filter(m =>
        m.content || m.quiz_id || (m.type && ['test', 'quiz', 'final'].includes(m.type))
    );

    const totalLessons = actualLessons.length;
    const completedCount = actualLessons.filter(m => completedMeetings.has(m.id)).length;
    const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    courseProgressValue.textContent = `${progress}%`;
    courseProgressFill.style.width = `${progress}%`;
}

/*
========================================
📦 FETCH COURSE
========================================
*/
async function loadCourseDetails(courseId) {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_URL}/${courseId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) throw new Error(`HTTP ERROR ${response.status}`);
        const data = await response.json();
        courseData = data;
        currentCourseId = courseId;

        if (pageTitleEl) pageTitleEl.textContent = data.title || 'Course Details';

        loadCompletedMeetings(courseId);
        renderCourseMeta(data);
        updateCourseProgressBar();
        renderMeetings(data.meetings || []);
    } catch (error) {
        console.error('❌ Error loading course:', error);
        if (meetingList) {
            meetingList.innerHTML = `<p style="color:#e53935; text-align:center; padding:20px;">❌ Gagal memuat materi.<br><small>${error.message}</small></p>`;
        }
        if (typeof showNotification === 'function') showNotification('Gagal memuat materi course', 'error');
    }
}

/*
========================================
📋 RENDER SIDEBAR
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

        const isCompleted = completedMeetings.has(meeting.id);
        const checkmark = isCompleted ? ' ✓' : '';

        let typeIcon = '📄';
        if (meeting.type === 'quiz' || meeting.type === 'test') typeIcon = '✍️';
        else if (meeting.type === 'final') typeIcon = '🏆';
        else if (meeting.quiz_id) typeIcon = '✍️';
        else if (!meeting.content || meeting.content.trim() === '') typeIcon = '📁';

        meetingEl.innerHTML = `
            <span class="meeting-icon">${typeIcon}</span>
            <span style="flex:1;">${escapeHtml(meeting.title || `Pertemuan ${index + 1}`)}${checkmark}</span>
        `;

        meetingEl.addEventListener('click', function () {
            // ✅ PAYMENT CHECK
            if (isCourseLocked) {
                if (typeof showNotification === 'function') {
                    showNotification('Course belum aktif. Selesaikan pembayaran terlebih dahulu.', 'error');
                }
                return;
            }

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
📄 RENDER LESSON (Google Drive)
========================================
*/
function renderLessonContent(meeting) {
    // ✅ PAYMENT CHECK
    if (isCourseLocked) {
        if (typeof showNotification === 'function') {
            showNotification('Course belum aktif. Selesaikan pembayaran terlebih dahulu.', 'error');
        }
        return;
    }

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
                <div style="width:48px; height:48px; background:linear-gradient(135deg, var(--purple), var(--blue)); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:24px;">🎬</div>
                <div>
                    <h3 style="font-family:'Playfair Display',serif; font-size:24px; color:var(--dark); margin-bottom:4px;">${escapeHtml(meeting.title)}</h3>
                    <p style="font-size:13px; color:var(--gray);">Video Pembelajaran</p>
                </div>
            </div>
            <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; background:#000; box-shadow:0 8px 24px rgba(0,0,0,0.15);">
                <iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>
            </div>
            <div style="margin-top:24px; display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
                <button onclick="window.open('${meeting.content}', '_blank')" style="padding:12px 24px; background:var(--blue); color:white; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer;">🔗 Buka di Tab Baru</button>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px 16px; background:white; border-radius:10px; border:2px solid #e0e0f0;">
                    <input type="checkbox" id="checkbox-meeting-${meeting.id}" data-meeting-id="${meeting.id}" onchange="toggleLessonComplete(${currentCourseId}, ${meeting.id}, this.checked)" ${isCompleted ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--success); cursor:pointer;">
                    <span style="font-size:14px; font-weight:500; color:var(--dark);">✓ Tandai selesai</span>
                </label>
            </div>
        </div>
    `;
}

/*
========================================
🔥 QUIZ SYSTEM - ROUTER
========================================
*/
async function renderQuizUI(quizItem) {
    // ✅ PAYMENT CHECK
    if (isCourseLocked) {
        if (contentContainer) {
            contentContainer.innerHTML = `
                <div class="quiz-container" style="text-align:center; padding:60px 20px;">
                    <div style="font-size:64px; margin-bottom:16px;">🔒</div>
                    <h3 style="font-family:'Playfair Display',serif; margin-bottom:8px; color:var(--dark);">Quiz Terkunci</h3>
                    <p style="color:var(--gray); margin-bottom:24px;">Selesaikan pembayaran untuk mengakses quiz ini.</p>
                    <button class="quiz-retry-btn" onclick="window.location.href='dashboard.html'">🏠 Kembali ke Dashboard</button>
                </div>
            `;
        }
        return;
    }

    const quizId = quizItem.quiz_id;
    currentQuizId = quizId;
    currentQuizMeetingId = quizItem.id;

    if (!contentContainer) return;
    contentContainer.innerHTML = `<div class="quiz-container"><div class="quiz-loading"><div class="spinner"></div><p>Loading quiz questions...</p></div></div>`;

    try {
        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (!response.ok) throw new Error(`Failed to load quiz: HTTP ${response.status}`);

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

        const hasDuolingo = quiz.questions.some(q => ['image', 'translation', 'fillblank'].includes(q.question_type));
        const hasText = quiz.questions.some(q => q.question_type === 'text' || !q.question_type);

        if (hasDuolingo && !hasText) {
            renderDuolingoQuiz(quiz);
        } else {
            renderTextQuizCheckbox(quiz);
        }

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

/*
========================================
📝 QUIZ TEXT - SISTEM CENTANG
========================================
*/
function renderTextQuizCheckbox(quiz) {
    const questions = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const isCompleted = completedMeetings.has(currentQuizMeetingId);

    contentContainer.innerHTML = `
        <div class="quiz-container">
            <div class="quiz-header">
                <h3 class="quiz-title">${escapeHtml(quiz.title)}</h3>
                <p style="color:var(--gray); margin-top:8px; font-size:14px;">
                    📋 Pilih jawaban untuk setiap soal, lalu centang checkbox di bawah setelah selesai.
                </p>
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:16px;">
                    <span style="padding:6px 14px; background:rgba(91,45,142,0.1); color:var(--purple); border-radius:20px; font-size:13px; font-weight:600;">
                        📝 ${questions.length} Soal
                    </span>
                    <span style="padding:6px 14px; background:rgba(16,185,129,0.1); color:var(--success); border-radius:20px; font-size:13px; font-weight:600;">
                        ${isCompleted ? '✓ Selesai' : '⏳ Belum selesai'}
                    </span>
                </div>
            </div>

            <div id="text-quiz-questions" style="display:flex; flex-direction:column; gap:16px;">
                ${questions.map((q, idx) => {
                    const options = Array.isArray(q.options) ? q.options : [];
                    return `
                        <div class="text-quiz-item" data-question-id="${q.id}" style="background:var(--surface2); border-radius:12px; padding:20px; border:2px solid transparent; transition:all 0.2s;">
                            <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:16px;">
                                <span style="background:linear-gradient(135deg, var(--purple), var(--blue)); color:white; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0;">${idx + 1}</span>
                                <div style="font-weight:600; font-size:16px; color:var(--dark); line-height:1.5; flex:1;">${escapeHtml(q.question)}</div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:8px; padding-left:44px;">
                                ${options.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    return `
                                        <div class="text-quiz-option" data-question="${q.id}" data-option="${letter}" data-index="${optIdx}"
                                            style="padding:12px 16px; background:white; border:2px solid #e0e0f0; border-radius:8px; font-size:14px; color:#333; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:12px;"
                                            onclick="selectTextQuizOption(this, '${q.id}', '${letter}')">
                                            <div style="width:32px; height:32px; background:var(--spk-border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; color:white; flex-shrink:0;" class="option-letter">${letter}</div>
                                            <div style="flex:1;">${escapeHtml(opt)}</div>
                                            <div style="width:24px; height:24px; border:2px solid var(--spk-border); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;" class="option-check">
                                                <svg style="width:16px; height:16px; color:var(--success); display:none;" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                                </svg>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="margin-top:32px; padding:24px; background:rgba(16,185,129,0.08); border:2px solid rgba(16,185,129,0.2); border-radius:12px;">
                <label style="display:flex; align-items:center; gap:12px; cursor:pointer;">
                    <input type="checkbox" id="text-quiz-complete-checkbox" ${isCompleted ? 'checked' : ''} disabled style="width:24px; height:24px; accent-color:var(--success); cursor:pointer;">
                    <span style="font-size:16px; font-weight:600; color:var(--dark);">✓ Saya sudah menyelesaikan semua soal di quiz ini</span>
                </label>
            </div>

            <div style="margin-top:20px; display:flex; gap:12px; justify-content:flex-end;">
                <button class="quiz-submit-btn" id="text-quiz-submit-btn" onclick="completeTextQuiz()" disabled>
                    Tandai Selesai
                </button>
            </div>
        </div>
    `;

    window.textQuizAnswers = {};

    window.checkAllQuestionsAnswered = function () {
        const totalQuestions = questions.length;
        const answeredQuestions = Object.keys(window.textQuizAnswers).length;
        const completeCheckbox = document.getElementById('text-quiz-complete-checkbox');
        const submitBtn = document.getElementById('text-quiz-submit-btn');

        if (answeredQuestions === totalQuestions) {
            completeCheckbox.disabled = false;
            submitBtn.disabled = false;
            submitBtn.textContent = '✓ Tandai Selesai';
            submitBtn.style.background = 'linear-gradient(135deg, var(--success), #059669)';
        } else {
            completeCheckbox.disabled = true;
            completeCheckbox.checked = false;
            submitBtn.disabled = true;
            submitBtn.textContent = `Jawab ${totalQuestions - answeredQuestions} soal lagi`;
            submitBtn.style.background = 'var(--gray)';
        }
    };
}

/*
========================================
✅ SELECT OPTION FOR TEXT QUIZ
========================================
*/
function selectTextQuizOption(element, questionId, option) {
    const allOptions = document.querySelectorAll(`.text-quiz-option[data-question="${questionId}"]`);
    allOptions.forEach(opt => {
        opt.style.borderColor = '#e0e0f0';
        opt.style.background = 'white';
        opt.querySelector('.option-letter').style.background = 'var(--spk-border)';
        opt.querySelector('.option-check svg').style.display = 'none';
    });

    element.style.borderColor = 'var(--purple)';
    element.style.background = 'rgba(91,45,142,0.1)';
    element.querySelector('.option-letter').style.background = 'var(--purple)';
    element.querySelector('.option-check svg').style.display = 'block';

    window.textQuizAnswers[questionId] = option;

    if (window.checkAllQuestionsAnswered) window.checkAllQuestionsAnswered();
}

/*
========================================
✅ COMPLETE TEXT QUIZ
========================================
*/
async function completeTextQuiz() {
    const token = getAuthToken();
    if (!token) {
        if (typeof showNotification === 'function') showNotification('Silakan login terlebih dahulu', 'error');
        return;
    }

    if (!currentQuizId) {
        if (typeof showNotification === 'function') showNotification('Quiz tidak valid. Silakan refresh halaman.', 'error');
        return;
    }

    const submitBtn = document.getElementById('text-quiz-submit-btn');
    if (!submitBtn) {
        if (typeof showNotification === 'function') showNotification('Terjadi kesalahan UI. Silakan refresh halaman.', 'error');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Menyimpan...';

    try {
        const response = await fetch(`${API_BASE_URL}/quizzes/${currentQuizId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ answers: window.textQuizAnswers || {} })
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.message || `Gagal submit quiz (HTTP ${response.status})`);
        }

        const result = await response.json();

        if (!result.passed) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            if (typeof showNotification === 'function') {
                showNotification(`Skor ${result.score}% belum memenuhi batas kelulusan (${result.passing_score}%). Coba lagi!`, 'error');
            }
            return;
        }

        completedMeetings.add(currentQuizMeetingId);
        saveCompletedMeetings(currentCourseId);
        updateCourseProgressBar();
        renderMeetings(courseData.meetings || []);

        submitBtn.textContent = '✓ Selesai Dikerjakan';
        submitBtn.style.background = 'linear-gradient(135deg, var(--success), #059669)';
        if (typeof showNotification === 'function') showNotification(`🎉 Lulus dengan skor ${result.score}%!`, 'success');

        await checkCourseCompletion(currentCourseId);

    } catch (error) {
        console.error('❌ Error completing quiz:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if (typeof showNotification === 'function') showNotification(`Gagal menyimpan progress: ${error.message}`, 'error');
        else alert(`Gagal menyimpan progress: ${error.message}`);
    }
}

/*
========================================
🎨 QUIZ DUOLINGO - UI INTERAKTIF
========================================
*/
function renderDuolingoQuiz(quiz) {
    if (typeof startQuizTimer === 'function') startQuizTimer(quiz.time_limit);

    duoQuestions = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    duoCurrentIndex = 0;
    duoAnswers = {};
    duoHearts = 5;
    currentQuizTitle = quiz.title;

    renderDuoQuiz(quiz);
}

function renderDuoQuiz(quiz) {
    const q = duoQuestions[duoCurrentIndex];
    const questionType = q.question_type || 'text';
    const totalQ = duoQuestions.length;
    const progressPercent = ((duoCurrentIndex + 1) / totalQ) * 100;

    let questionHTML = '';
    if (questionType === 'image') questionHTML = renderDuoImageQuestion(q);
    else if (questionType === 'translation') questionHTML = renderDuoTranslationQuestion(q);
    else if (questionType === 'fillblank') questionHTML = renderDuoFillBlankQuestion(q);
    else questionHTML = renderDuoTextQuestion(q);

    contentContainer.innerHTML = `
        <div class="duolingo-quiz">
            <div class="duo-top-bar">
                <button class="duo-close-btn" onclick="closeDuoQuiz()">✕</button>
                <div class="duo-progress-container">
                    <div class="duo-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="duo-hearts">
                    <span class="duo-heart-icon">❤️</span>
                    <span id="duo-hearts-count">${duoHearts}</span>
                </div>
            </div>
            <div id="duo-question-content">${questionHTML}</div>
            <div class="duo-footer">
                <button class="duo-btn-skip" onclick="skipDuoQuestion()">LOMPATI</button>
                <button class="duo-btn-check" id="duo-btn-check" onclick="checkDuoAnswer()" disabled>PERIKSA</button>
            </div>
        </div>
    `;

    setupDuoEventListeners(questionType);
}

function renderDuoImageQuestion(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    return `
        <div class="duo-category-badge"><div class="duo-category-icon">✨</div><span>KOSAKATA BARU</span></div>
        <h1 class="duo-question-title">${escapeHtml(q.question)}</h1>
        <div class="duo-options-grid">
            ${options.map((opt, idx) => `
                <div class="duo-option-card" data-index="${idx}">
                    <div class="duo-emoji">${opt.emoji || '❓'}</div>
                    <div class="duo-label">${escapeHtml(opt.label || '')}</div>
                    <div class="duo-option-number">${idx + 1}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderDuoTranslationQuestion(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    return `
        <div class="duo-category-badge"><div class="duo-category-icon">✨</div><span>POLA BARU</span></div>
        <h1 class="duo-question-title">${escapeHtml(q.question)}</h1>
        <div class="duo-character-container">
            <div class="duo-character-avatar">${q.character_avatar || '👨'}</div>
            <div class="duo-speech-bubble">${escapeHtml(q.question)}</div>
        </div>
        <div class="duo-translation-options">
            ${options.map((opt, idx) => `
                <div class="duo-translation-option" data-index="${idx}">
                    <div class="duo-option-number-small">${idx + 1}</div>
                    <div class="duo-option-text">${escapeHtml(opt.text || '')}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderDuoFillBlankQuestion(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    const template = q.sentence_template || '___';
    const parts = template.split('___');
    return `
        <div class="duo-category-badge"><div class="duo-category-icon">✨</div><span>POLA BARU</span></div>
        <h1 class="duo-question-title">${escapeHtml(q.question)}</h1>
        ${q.audio_text ? `
            <div class="duo-audio-container">
                <div class="duo-character-bear">${q.character_avatar || '🐻'}</div>
                <div class="duo-audio-bubble">
                    <button class="duo-audio-btn" onclick="playDuoAudio('${escapeHtml(q.audio_text)}')">🔊</button>
                    <div class="duo-audio-text">${escapeHtml(q.audio_text)}</div>
                </div>
            </div>
        ` : ''}
        <div class="duo-sentence-container">
            <div class="duo-sentence">
                ${escapeHtml(parts[0])}<span class="duo-blank" id="duo-blank">&nbsp;</span>${parts[1] ? escapeHtml(parts[1]) : ''}
            </div>
        </div>
        <div class="duo-word-bank">
            ${options.map((opt, idx) => `
                <div class="duo-word-chip" data-index="${idx}" data-text="${escapeHtml(opt.text || '')}">
                    ${escapeHtml(opt.text || '')}
                </div>
            `).join('')}
        </div>
    `;
}

function renderDuoTextQuestion(q) {
    const options = Array.isArray(q.options) ? q.options : [];
    return `
        <div class="duo-category-badge"><div class="duo-category-icon">📝</div><span>SOAL PILIHAN</span></div>
        <h1 class="duo-question-title">${escapeHtml(q.question)}</h1>
        <div class="duo-text-options">
            ${options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return `
                    <div class="duo-text-option" data-index="${idx}" data-letter="${letter}">
                        <div class="duo-text-letter">${letter}</div>
                        <div class="duo-text-content">${escapeHtml(opt)}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function setupDuoEventListeners(questionType) {
    const checkBtn = document.getElementById('duo-btn-check');

    if (questionType === 'image') {
        document.querySelectorAll('.duo-option-card').forEach(card => {
            card.addEventListener('click', function () {
                document.querySelectorAll('.duo-option-card').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                duoAnswers[duoQuestions[duoCurrentIndex].id] = { type: 'image', index: parseInt(this.dataset.index), label: this.querySelector('.duo-label').textContent };
                checkBtn.disabled = false;
                checkBtn.classList.add('active');
            });
        });
    } else if (questionType === 'translation') {
        document.querySelectorAll('.duo-translation-option').forEach(opt => {
            opt.addEventListener('click', function () {
                document.querySelectorAll('.duo-translation-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                duoAnswers[duoQuestions[duoCurrentIndex].id] = { type: 'translation', index: parseInt(this.dataset.index), text: this.querySelector('.duo-option-text').textContent };
                checkBtn.disabled = false;
                checkBtn.classList.add('active');
            });
        });
    } else if (questionType === 'fillblank') {
        document.querySelectorAll('.duo-word-chip').forEach(chip => {
            chip.addEventListener('click', function () {
                if (this.classList.contains('used')) return;
                document.querySelectorAll('.duo-word-chip').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected', 'used');
                const blank = document.getElementById('duo-blank');
                blank.textContent = this.dataset.text;
                blank.classList.remove('correct', 'wrong');
                duoAnswers[duoQuestions[duoCurrentIndex].id] = { type: 'fillblank', index: parseInt(this.dataset.index), text: this.dataset.text };
                checkBtn.disabled = false;
                checkBtn.classList.add('active');
            });
        });
    } else {
        document.querySelectorAll('.duo-text-option').forEach(opt => {
            opt.addEventListener('click', function () {
                document.querySelectorAll('.duo-text-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                duoAnswers[duoQuestions[duoCurrentIndex].id] = { type: 'text', index: parseInt(this.dataset.index), letter: this.dataset.letter };
                checkBtn.disabled = false;
                checkBtn.classList.add('active');
            });
        });
    }
}

function playDuoAudio(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    } else {
        if (typeof showNotification === 'function') showNotification('Browser tidak mendukung Text-to-Speech', 'warning');
    }
}

function checkDuoAnswer() {
    const q = duoQuestions[duoCurrentIndex];
    const answer = duoAnswers[q.id];
    if (!answer) return;

    const options = Array.isArray(q.options) ? q.options : [];
    let isCorrect = q.question_type !== 'text' ? options[answer.index]?.correct === true : null;

    if (q.question_type === 'image') {
        document.querySelectorAll('.duo-option-card').forEach((card, idx) => {
            if (options[idx]?.correct) card.classList.add('correct');
            else if (idx === answer.index && isCorrect === false) card.classList.add('wrong');
        });
    } else if (q.question_type === 'translation') {
        document.querySelectorAll('.duo-translation-option').forEach((opt, idx) => {
            if (options[idx]?.correct) opt.classList.add('correct');
            else if (idx === answer.index && isCorrect === false) opt.classList.add('wrong');
        });
    } else if (q.question_type === 'fillblank') {
        const blank = document.getElementById('duo-blank');
        if (isCorrect === true) blank.classList.add('correct');
        else if (isCorrect === false) {
            blank.classList.add('wrong');
            const correctText = options.find(o => o.correct)?.text || '';
            setTimeout(() => { blank.textContent = correctText; }, 800);
        }
    } else {
        document.querySelectorAll('.duo-text-option').forEach((opt, idx) => {
            if (idx === answer.index) opt.classList.add('selected');
        });
    }

    if (isCorrect === false) {
        duoHearts = Math.max(0, duoHearts - 1);
        const heartsEl = document.getElementById('duo-hearts-count');
        if (heartsEl) heartsEl.textContent = duoHearts;
    }

    showDuoFeedback(isCorrect, q, options);
}

function showDuoFeedback(isCorrect, q, options) {
    const footer = document.querySelector('.duo-footer');
    if (footer) footer.style.display = 'none';

    let correctText = '';
    let feedbackTitle = '';
    let feedbackClass = '';

    if (isCorrect === true) {
        feedbackTitle = 'Bagus!';
        feedbackClass = 'correct';
    } else if (isCorrect === false) {
        feedbackTitle = 'Jawaban yang benar:';
        feedbackClass = 'wrong';
        const correctAnswer = options.find(o => o.correct);
        correctText = q.question_type === 'image'
            ? `${correctAnswer?.label || ''} ${correctAnswer?.emoji || ''}`
            : correctAnswer?.text || correctAnswer?.label || '';
    } else {
        feedbackTitle = 'Jawaban tersimpan';
        feedbackClass = 'correct';
        correctText = 'Hasil akan ditampilkan di akhir quiz';
    }

    const feedbackBar = document.createElement('div');
    feedbackBar.className = `duo-feedback-bar ${feedbackClass}`;
    feedbackBar.innerHTML = `
        <div class="duo-feedback-content">
            <div class="duo-feedback-icon">${isCorrect === true ? '✓' : isCorrect === false ? '✗' : '✓'}</div>
            <div class="duo-feedback-text">
                <h3>${feedbackTitle}</h3>
                <p>${correctText}</p>
            </div>
            <button class="duo-btn-continue" onclick="nextDuoQuestion()">LANJUTKAN</button>
        </div>
    `;
    document.body.appendChild(feedbackBar);
}

function nextDuoQuestion() {
    const feedbackBar = document.querySelector('.duo-feedback-bar');
    if (feedbackBar) feedbackBar.remove();

    duoCurrentIndex++;

    if (duoCurrentIndex >= duoQuestions.length || duoHearts <= 0) {
        submitDuoQuiz();
    } else {
        renderDuoQuiz({ title: currentQuizTitle });
    }
}

function skipDuoQuestion() {
    if (confirm('Yakin mau lewati soal ini?')) {
        duoHearts = Math.max(0, duoHearts - 1);
        nextDuoQuestion();
    }
}

function closeDuoQuiz() {
    if (confirm('Yakin mau keluar dari kuis? Progress tidak akan disimpan.')) {
        if (typeof stopQuizTimer === 'function') stopQuizTimer();
        contentContainer.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="font-size:64px; margin-bottom:16px;">👋</div>
                <h3 style="font-family:'Playfair Display',serif; margin-bottom:8px;">Kuis Dibatalkan</h3>
                <p style="color:var(--gray);">Klik pertemuan di sidebar untuk mengulang kuis.</p>
            </div>
        `;
    }
}

async function submitDuoQuiz() {
    if (typeof stopQuizTimer === 'function') stopQuizTimer();

    const token = getAuthToken();
    const formattedAnswers = {};

    duoQuestions.forEach(q => {
        const answer = duoAnswers[q.id];
        if (!answer) return;
        if (answer.type === 'text') formattedAnswers[q.id] = answer.letter;
        else if (answer.type === 'image') formattedAnswers[q.id] = { label: answer.label };
        else if (answer.type === 'translation' || answer.type === 'fillblank') formattedAnswers[q.id] = { text: answer.text };
    });

    contentContainer.innerHTML = `
        <div class="quiz-container" style="text-align:center; padding:60px 20px;">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <p style="color:var(--gray); font-size:16px;">Memproses jawaban...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/quizzes/${currentQuizId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ answers: formattedAnswers })
        });

        const result = await response.json();

        if (result.passed && currentQuizMeetingId) {
            completedMeetings.add(currentQuizMeetingId);
            saveCompletedMeetings(currentCourseId);
            updateCourseProgressBar();
            renderMeetings(courseData.meetings || []);
            await checkCourseCompletion(currentCourseId);
        }

        showDuoFinalResult(result);

    } catch (error) {
        console.error('❌ Error submitting quiz:', error);
        contentContainer.innerHTML = `
            <div class="quiz-container" style="text-align:center; padding:60px 20px;">
                <div style="font-size:64px; margin-bottom:16px;">❌</div>
                <h3 style="font-family:'Playfair Display',serif; margin-bottom:8px; color:var(--error);">Gagal Submit</h3>
                <p style="color:var(--gray); margin-bottom:24px;">${error.message}</p>
                <button class="quiz-retry-btn" onclick="renderQuizUI({quiz_id: ${currentQuizId}, id: ${currentQuizMeetingId}})">🔄 Coba Lagi</button>
            </div>
        `;
    }
}

function showDuoFinalResult(result) {
    const isPassed = result.passed || false;
    const score = result.score || 0;
    const passingScore = result.passing_score || 70;

    contentContainer.innerHTML = `
        <div class="duo-final-result">
            <div class="duo-final-emoji">${isPassed ? '🎉' : '💪'}</div>
            <h2 style="font-family:'Playfair Display',serif; font-size:32px; margin-bottom:8px;">
                ${isPassed ? 'Quiz Selesai!' : 'Hampir Berhasil!'}
            </h2>
            <div class="duo-final-score ${isPassed ? 'passed' : 'failed'}">${score}%</div>
            <p class="duo-final-message">
                ${isPassed
                    ? `🎉 Selamat! Kamu lulus dengan skor ${score}% (Passing: ${passingScore}%)`
                    : `Skor ${score}% belum memenuhi batas kelulusan (${passingScore}%). Coba lagi!`}
            </p>
            <div class="duo-final-stats">
                <div class="duo-final-stat"><div class="duo-final-stat-label">Score</div><div class="duo-final-stat-value">${score}%</div></div>
                <div class="duo-final-stat"><div class="duo-final-stat-label">Passing</div><div class="duo-final-stat-value">${passingScore}%</div></div>
                <div class="duo-final-stat">
                    <div class="duo-final-stat-label">Status</div>
                    <div class="duo-final-stat-value" style="color: ${isPassed ? 'var(--spk-primary)' : 'var(--spk-accent)'}">
                        ${isPassed ? '✓ Lulus' : '✗ Belum'}
                    </div>
                </div>
            </div>
            ${!isPassed ? `
                <button class="duo-btn-retry" onclick="renderQuizUI({quiz_id: ${currentQuizId}, id: ${currentQuizMeetingId}})">🔄 Coba Lagi</button>
            ` : `
                <button class="duo-btn-retry" onclick="window.location.href='dashboard.html'" style="background:var(--spk-primary); color:white; border:none;">
                    🏠 Kembali ke Dashboard
                </button>
            `}
        </div>
    `;

    if (typeof showNotification === 'function') {
        if (isPassed) showNotification(`🎉 Selamat! Kamu lulus dengan skor ${score}%`, 'success');
        else showNotification(`Skor ${score}% belum memenuhi batas kelulusan`, 'error');
    }
}

/*
========================================
📊 PROGRESS FUNCTIONS
========================================
*/
async function toggleLessonComplete(courseId, meetingId, isCompleted) {
    const token = getAuthToken();
    if (!token) {
        if (typeof showNotification === 'function') showNotification('Silakan login terlebih dahulu', 'error');
        return;
    }

    // ✅ PAYMENT CHECK
    const paymentCheck = await checkPaymentStatus(courseId);
    if (!paymentCheck.canAccess) {
        if (typeof showNotification === 'function') {
            showNotification('Course belum aktif. Selesaikan pembayaran terlebih dahulu.', 'error');
        }
        const checkbox = document.getElementById(`checkbox-meeting-${meetingId}`);
        if (checkbox) checkbox.checked = !isCompleted;
        return;
    }

    try {
        if (isCompleted) completedMeetings.add(meetingId);
        else completedMeetings.delete(meetingId);

        saveCompletedMeetings(courseId);
        updateCourseProgressBar();
        renderMeetings(courseData.meetings || []);

        try {
            await updateProgress(courseId, meetingId, isCompleted);
        } catch (apiError) {
            console.warn('⚠️ Backend sync failed:', apiError);
        }

        await checkCourseCompletion(courseId);

        if (typeof showNotification === 'function') {
            showNotification(isCompleted ? '✓ Progress berhasil disimpan!' : 'Progress diupdate', 'success');
        }
    } catch (error) {
        console.error('❌ Error toggling lesson:', error);
        if (typeof showNotification === 'function') showNotification('Gagal mengupdate progress', 'error');
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
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ meeting_id: meetingId, is_completed: isCompleted })
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return await response.json();
}

async function checkCourseCompletion(courseId) {
    if (!courseData || !courseData.meetings) return;

    const meetings = courseData.meetings;
    const actualLessons = meetings.filter(m =>
        m.content || m.quiz_id || (m.type && ['test', 'quiz', 'final'].includes(m.type))
    );

    const allCompleted = actualLessons.every(m => completedMeetings.has(m.id));

    if (allCompleted && actualLessons.length > 0) {
        const hasCelebrated = sessionStorage.getItem(`celebrated_course_${courseId}`);
        if (!hasCelebrated) {
            sessionStorage.setItem(`celebrated_course_${courseId}`, 'true');
            setTimeout(() => showCourseCompletedCelebration(courseId), 500);
        }
    }

    return { course_completed: allCompleted };
}

/*
========================================
🎉 CELEBRATION
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
            <button class="btn btn-certificate" onclick="downloadCertificate(${courseId})">📥 Download Certificate</button>
            <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">🏠 View Dashboard</button>
            <button class="btn btn-secondary" onclick="this.closest('.celebration-overlay').remove()">✕ Keep Learning</button>
        </div>
    `;
    document.body.appendChild(overlay);
    createConfetti(overlay);
    if (typeof showNotification === 'function') showNotification('🎉 Selamat! Kamu telah menyelesaikan course!', 'success');
}

function createConfetti(container) {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#a67cda', '#ef4444'];
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `background:${colors[i % colors.length]};left:${Math.random() * 100}%;top:-10px;animation-duration:${2 + Math.random() * 3}s;animation-delay:${Math.random() * 0.5}s;`;
        container.appendChild(confetti);
    }
}

/*
========================================
🚀 INIT
========================================
*/
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 course-details.js loaded');

    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    if (userNameEl) {
        const user = api.getUser();
        if (user?.name) userNameEl.textContent = user.name.split(' ')[0];
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

    // ✅ PAYMENT VALIDATION
    console.log('🔒 Checking payment status...');
    const paymentCheck = await checkPaymentStatus(courseId);

    if (!paymentCheck.canAccess) {
        console.log('⚠️ Payment validation failed:', paymentCheck.reason);

        switch (paymentCheck.reason) {
            case 'payment_pending':
                showLockedCourseUI(paymentCheck);
                return;
            case 'not_enrolled':
                alert('Anda belum terdaftar di course ini.');
                window.location.href = 'dashboard.html';
                return;
            case 'not_logged_in':
                window.location.href = 'login.html';
                return;
            default:
                console.warn('⚠️ Payment check failed, allowing access');
                break;
        }
    }

    console.log('✅ Payment verified - loading course...');
    loadCourseDetails(courseId);
});