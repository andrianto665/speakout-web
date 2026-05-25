const API_URL = 'http://127.0.0.1:8000/api/teachers';

const loadingState  = document.getElementById('loadingState');
const teachersList  = document.getElementById('teachersList');
const errorState    = document.getElementById('errorState');

// Warna gradien berbeda tiap card biar variatif
const bannerGradients = [
    'linear-gradient(135deg, #5b2d8e 0%, #0A4D9B 100%)',
    'linear-gradient(135deg, #0A4D9B 0%, #5b2d8e 100%)',
    'linear-gradient(135deg, #7b4db5 0%, #1565c0 100%)',
    'linear-gradient(135deg, #3a1a6e 0%, #0a3a80 100%)',
];

// Tag specialty per index (bisa disesuaikan)
const specialtyTags = [
    ['Speaking', 'Grammar', 'TOEFL'],
    ['Conversation', 'Writing', 'Business'],
    ['Pronunciation', 'Listening', 'IELTS'],
    ['Public Speaking', 'Debate', 'Academic'],
];

async function loadTeachers() {
    try {
        const response = await fetch(API_URL);
        const result   = await response.json();

        console.log(result);

        loadingState.style.display = 'none';

        const teachers = result.data;

        if (!teachers || teachers.length === 0) {
            teachersList.innerHTML = '<p style="text-align:center;color:#888;">No teachers found</p>';
            return;
        }

        teachers.forEach((teacher, i) => {
            const initial  = teacher.name.charAt(0).toUpperCase();
            const gradient = bannerGradients[i % bannerGradients.length];
            const tags     = specialtyTags[i % specialtyTags.length];

            // Foto profil: pakai teacher.photo kalau ada, fallback ke inisial
            const avatarHTML = teacher.photo
                ? `<img
                        src="${teacher.photo}"
                        alt="${teacher.name}"
                        class="teacher-avatar"
                        onerror="this.outerHTML='<div class=\\'teacher-avatar-fallback\\'>${initial}</div>'"
                   >`
                : `<div class="teacher-avatar-fallback">${initial}</div>`;

            const tagsHTML = tags.map(t =>
                `<span class="teacher-tag">${t}</span>`
            ).join('');

            const card = `
                <div class="teacher-card">

                    <div class="teacher-banner" style="background:${gradient}">
                        <div class="teacher-avatar-wrap">
                            ${avatarHTML}
                        </div>
                    </div>

                    <div class="teacher-content">

                        <h3>${teacher.name}</h3>
                        <p class="teacher-role">Professional English Mentor</p>

                        <div class="teacher-stats">
                            <div class="stat-box">
                                <span class="stat-number">${teacher.courses_count ?? 0}</span>
                                <span class="stat-label">Courses</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-number">${teacher.total_students ?? 0}</span>
                                <span class="stat-label">Students</span>
                            </div>
                        </div>

                        <div class="teacher-tags">
                            ${tagsHTML}
                        </div>

                        <button class="teacher-btn">View Profile →</button>

                    </div>

                </div>
            `;

            teachersList.innerHTML += card;
        });

    } catch (error) {
        console.error(error);
        loadingState.style.display = 'none';
        errorState.style.display   = 'block';
    }
}

loadTeachers();