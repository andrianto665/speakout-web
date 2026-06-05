const API_URL = 'http://127.0.0.1:8000/api/courses';
const BASE_IMAGE_URL = 'http://127.0.0.1:8000/assets/courses/';

const coursesList = document.getElementById('coursesList');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');

/*
========================================
COURSE IMAGE MAP (Fallback jika thumbnail tidak ada)
========================================
*/
const courseImages = {
    "Public Speaking 101": "publicspeaking.png",
    "Debate & Argumentation": "debate.png",
    "English For Family": "englishforfamily.png",
    "English For Society": "englishforsociety.png",
    "English For Professional": "englishforprofessional.png"
};

/*
========================================
✅ GET IMAGE URL - Prioritas: thumbnail dari API, fallback ke mapping
========================================
*/
function getImageUrl(course) {
    // ✅ Prioritas 1: thumbnail dari database/API
    if (course.thumbnail && course.thumbnail.trim() !== '') {
        return `http://127.0.0.1:8000/${course.thumbnail}`;
    }
    
    // ✅ Prioritas 2: mapping berdasarkan title
    const imageName = courseImages[course.title] || 'default.png';
    return BASE_IMAGE_URL + imageName;
}

/*
========================================
✅ FORMAT HARGA - Konversi ke format "Rp XXX rb"
========================================
*/
function formatPrice(price) {
    if (!price || price === 0 || price === 'free') {
        return {
            text: 'Free',
            isFree: true
        };
    }
    
    // Konversi ke ribuan (misal 375000 → 375)
    const priceInRb = Math.round(price / 1000);
    return {
        text: `Rp ${priceInRb.toLocaleString('id-ID')} rb`,
        isFree: false
    };
}

/*
========================================
LOAD COURSES
========================================
*/
async function loadCourses() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`HTTP ERROR ${response.status}`);
        }

        const courses = await response.json();

        loadingState.style.display = 'none';

        renderCourses(courses);

    } catch(error) {
        console.error(error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        errorState.innerHTML = `
            <h2>Failed to load courses</h2>
            <p>${error.message}</p>
        `;
    }
}

/*
========================================
RENDER COURSES
========================================
*/
function renderCourses(courses) {
    coursesList.innerHTML = '';

    courses.forEach(course => {
        const lessonsCount = course.lessons?.length || course.total_lessons || 0;

        /*
        ========================================
        ✅ IMAGE - Gunakan fungsi getImageUrl
        ========================================
        */
        const imageUrl = getImageUrl(course);
        const hasThumbnail = course.thumbnail && course.thumbnail.trim() !== '';

        // ✅ Handle null description
        const description = course.description
            ? course.description.substring(0, 180) + '...'
            : 'Deskripsi belum tersedia.';

        /*
        ========================================
        ✅ PRICE - Gunakan fungsi formatPrice
        ========================================
        */
        const priceData = formatPrice(course.price);

        /*
        ========================================
        CARD
        ========================================
        */
        const card = document.createElement('div');
        card.className = 'course-card';
        card.style.cursor = 'pointer';

        card.innerHTML = `
            <div class="course-image ${!hasThumbnail ? 'no-image' : ''}">
                ${hasThumbnail 
                    ? `<img src="${imageUrl}" alt="${course.title}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">`
                    : `<div class="course-placeholder">${course.title.substring(0, 30)}${course.title.length > 30 ? '...' : ''}</div>`
                }
                <div class="course-badge">Premium Course</div>
            </div>

            <div class="course-content">
                <div>
                    <h2 class="course-title">${course.title}</h2>
                    <div class="course-author">
                        by <span>${course.instructor || 'Unknown'}</span>
                    </div>

                    <div class="course-meta">
                        <div class="meta-item">🎥 ${lessonsCount} Lessons</div>
                        <div class="meta-item">📚 ${course.level || 'All Levels'}</div>
                        <div class="meta-item">🌍 ${course.category || 'English Course'}</div>
                    </div>

                    <div class="course-desc">${description}</div>
                </div>

                <div class="course-footer">
                    <div class="course-price ${priceData.isFree ? 'free-price' : ''}">
                        ${priceData.text}
                    </div>
                </div>
            </div>
        `;

        // ✅ Event Click untuk navigasi ke course-details.html
        card.addEventListener('click', function() {
            const encodedTitle = encodeURIComponent(course.title);
            window.location.href = `course-details.html?course_id=${course.id}&title=${encodedTitle}`;
        });

        // ✅ Efek hover
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });

        coursesList.appendChild(card);
    });
}

/*
========================================
RUN
========================================
*/
loadCourses();