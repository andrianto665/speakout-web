/*
========================================
CONFIG & ELEMENTS
========================================
*/

const API_URL = 'http://127.0.0.1:8000/api/courses';

const meetingList = document.getElementById('meeting-list');
const lessonList = document.getElementById('lesson-list');
const meetingTitleEl = document.getElementById('meeting-title');
const meetingLabelEl = document.getElementById('meeting-label');
const pageTitleEl = document.getElementById('page-title');

// Store data course secara global
let courseData = null;
let currentMeetingId = null;

/*
========================================
UTILS: Baca Parameter URL
========================================
*/

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        courseId: params.get('course_id'),
        title: params.get('title')
    };
}

/*
========================================
FETCH COURSE DETAILS
========================================
*/

async function loadCourseDetails(courseId) {
    try {
        const response = await fetch(`${API_URL}/${courseId}`);
        if (!response.ok) {
            throw new Error(`HTTP ERROR ${response.status}`);
        }
        const data = await response.json();
        courseData = data;
        
        // Update judul halaman
        if (pageTitleEl) {
            pageTitleEl.textContent = data.title || 'Course Details';
        }
        
        // ✅ Render sidebar dengan data FLAT structure
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
RENDER SIDEBAR: Daftar Pertemuan (FLAT STRUCTURE)
========================================
*/

function renderMeetings(meetings) {
    if (!meetings || meetings.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666;">Belum ada pertemuan tersedia.</p>';
        return;
    }

    // ✅ FILTER 1: Meeting Header = type 'normal' DAN content null/empty
    const meetingHeaders = meetings.filter(m => 
        m.type === 'normal' && 
        (m.content === null || m.content === '')
    );
    
    if (meetingHeaders.length === 0) {
        meetingList.innerHTML = '<p style="padding:15px; color:#666;">Tidak ada pertemuan ditemukan.</p>';
        return;
    }

    meetingList.innerHTML = ''; // Clear loading

    meetingHeaders.forEach((meeting, index) => {
        const meetingEl = document.createElement('div');
        meetingEl.className = 'meeting-item';
        
        // Set active untuk item pertama
        if (index === 0) {
            meetingEl.classList.add('active');
            currentMeetingId = meeting.id;
        }
        
        meetingEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
        
        // Event klik: tampilkan lesson untuk meeting ini
        meetingEl.addEventListener('click', function() {
            // Update UI active state
            document.querySelectorAll('.meeting-item').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            
            currentMeetingId = meeting.id;
            
            // ✅ FILTER 2: Ambil lesson yang berada di antara meeting ini dan meeting berikutnya
            const currentOrder = meeting.order_number;
            const nextMeeting = meetingHeaders[index + 1];
            const nextOrder = nextMeeting ? nextMeeting.order_number : Infinity;
            
            const lessons = meetings.filter(m => 
                m.content !== null && 
                m.content !== '' && 
                m.order_number > currentOrder && 
                m.order_number < nextOrder
            );
            
            renderLessons(lessons);
            
            // Update judul section
            if (meetingTitleEl) {
                meetingTitleEl.textContent = meeting.title || `Pertemuan ${index + 1}`;
            }
            if (meetingLabelEl) {
                meetingLabelEl.textContent = `Pertemuan ${index + 1}`;
            }
        });
        
        meetingList.appendChild(meetingEl);
    });

    // ✅ Auto render lesson untuk meeting pertama saat halaman load
    const firstMeeting = meetingHeaders[0];
    if (firstMeeting) {
        meetingTitleEl.textContent = firstMeeting.title || 'Pertemuan 1';
        meetingLabelEl.textContent = 'Pertemuan 1';
        
        const nextMeeting = meetingHeaders[1];
        const nextOrder = nextMeeting ? nextMeeting.order_number : Infinity;
        
        const lessons = meetings.filter(m => 
            m.content !== null && 
            m.content !== '' && 
            m.order_number > firstMeeting.order_number && 
            m.order_number < nextOrder
        );
        
        renderLessons(lessons);
    }
}

/*
========================================
RENDER CONTENT: Daftar Lesson (FLAT STRUCTURE)
========================================
*/

function renderLessons(lessons) {
    lessonList.innerHTML = ''; // Clear konten lama

    if (!lessons || lessons.length === 0) {
        lessonList.innerHTML = `
            <p style="color: #666; text-align: center; padding: 30px;">
                📭 Belum ada materi untuk pertemuan ini.<br>
                <small>Silakan cek kembali nanti.</small>
            </p>
        `;
        return;
    }

    lessons.forEach((lesson, index) => {
        const lessonItem = document.createElement('li');
        lessonItem.className = 'lesson-item';
        
        // ✅ Tentukan icon & tag berdasarkan ENUM type + keyword di title
        let iconText = '📄';
        let tagText = 'Materi';
        
        if (lesson.type === 'test') {
            iconText = '✍️';
            tagText = 'Quiz';
        } else if (lesson.type === 'final') {
            iconText = '🏆';
            tagText = 'Final Test';
        } else if (lesson.title?.toLowerCase().includes('video')) {
            iconText = '🎬';
            tagText = 'Video';
        } else if (lesson.title?.toLowerCase().includes('listening') || lesson.title?.toLowerCase().includes('audio')) {
            iconText = '🎧';
            tagText = 'Audio';
        } else if (lesson.title?.toLowerCase().includes('reading')) {
            iconText = '📖';
            tagText = 'Reading';
        }
        
        // ✅ Link dari kolom 'content' (karena struktur FLAT)
        const lessonLink = lesson.content || lesson.google_drive_link || lesson.link || '#';
        const isDisabled = lessonLink === '#' ? 'style="pointer-events:none; opacity:0.5;"' : '';
        
        lessonItem.innerHTML = `
            <div class="lesson-icon">${iconText}</div>
            <a href="${lessonLink}" 
               class="lesson-link" 
               target="_blank" 
               ${isDisabled}>
                ${lesson.title || `Lesson ${index + 1}`}
            </a>
            <span class="lesson-tag">${tagText}</span>
        `;
        
        lessonList.appendChild(lessonItem);
    });
}

/*
========================================
INIT: Jalankan Saat Halaman Load
========================================
*/

document.addEventListener('DOMContentLoaded', function() {
    const { courseId, title } = getUrlParams();
    
    // Validasi parameter
    if (!courseId) {
        meetingList.innerHTML = `
            <p style="color: #e53935; padding: 20px;">
                ❌ Course ID tidak ditemukan.<br>
                <a href="courses.html" style="color: var(--blue);">← Kembali ke Courses</a>
            </p>
        `;
        return;
    }
    
    // Tampilkan judul course di halaman
    if (title && pageTitleEl) {
        pageTitleEl.textContent = decodeURIComponent(title);
    }
    
    // Load data dari API
    loadCourseDetails(courseId);
});