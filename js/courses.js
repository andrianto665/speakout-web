const API_URL = 'http://127.0.0.1:8000/api/courses';

const BASE_IMAGE_URL =
    'http://127.0.0.1:8000/assets/courses/';

const coursesList =
    document.getElementById('coursesList');

const loadingState =
    document.getElementById('loadingState');

const errorState =
    document.getElementById('errorState');

/*
========================================
COURSE IMAGE MAP
========================================
*/

const courseImages = {

    "Public Speaking 101":
        "publicspeaking.png",

    "Debate & Argumentation":
        "debate.png",

    "English For Family":
        "englishforfamily.png",

    "English For Society":
        "englishforsociety.png",

    "English For Professional":
        "englishforprofessional.png"
};

/*
========================================
LOAD COURSES
========================================
*/

async function loadCourses() {

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(
                `HTTP ERROR ${response.status}`
            );
        }

        const courses = await response.json();

        loadingState.style.display = 'none';

        renderCourses(courses);

    } catch(error){

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

function renderCourses(courses){

    coursesList.innerHTML = '';

    courses.forEach(course => {

        const lessonsCount =
            course.lessons?.length || 0;

        /*
        ========================================
        IMAGE
        ========================================
        */

        const imageName =
            courseImages[course.title]
            || 'default.png';

        const imageUrl =
            BASE_IMAGE_URL + imageName;

        // ✅ FIX: handle null description
        const description = course.description
            ? course.description.substring(0, 180) + '...'
            : 'Deskripsi belum tersedia.';

        /*
        ========================================
        CARD
        ========================================
        */

        const card =
            document.createElement('div');

        card.className = 'course-card';
        
        // ✅ TAMBAHAN: Ubah cursor jadi pointer agar user tahu bisa diklik
        card.style.cursor = 'pointer';

        card.innerHTML = `

            <div class="course-image">

                <img
                    src="${imageUrl}"
                    alt="${course.title}"
                >

                <div class="course-badge">
                    Premium Course
                </div>

            </div>

            <div class="course-content">

                <div>

                    <h2 class="course-title">
                        ${course.title}
                    </h2>

                    <div class="course-author">
                        by
                        <span>
                            ${course.instructor || 'Unknown'}
                        </span>
                    </div>

                    <div class="course-meta">

                        <div class="meta-item">
                            🎥 ${lessonsCount} Lessons
                        </div>

                        <div class="meta-item">
                            📚 All Levels
                        </div>

                        <div class="meta-item">
                            🌍 English Course
                        </div>

                    </div>

                    <div class="course-desc">
                        ${description}
                    </div>

                </div>

                <div class="course-footer">

                    <div class="course-price">
                        Free
                    </div>

                </div>

            </div>
        `;

        // ✅ TAMBAHAN: Event Click untuk navigasi ke course-details.html
        card.addEventListener('click', function() {
            
            // Encode title agar aman untuk URL (spasi jadi %20, dll)
            const encodedTitle = encodeURIComponent(course.title);
            
            // Redirect ke halaman detail dengan membawa parameter
            // Contoh: course-details.html?course_id=5&title=English%20For%20Family
            window.location.href = `course-details.html?course_id=${course.id}&title=${encodedTitle}`;
            
        });

        // ✅ TAMBAHAN: Efek hover kecil (opsional, untuk UX lebih baik)
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