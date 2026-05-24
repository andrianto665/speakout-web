const API_URL = 'http://127.0.0.1:8000/api/teachers';

const loadingState = document.getElementById('loadingState');
const teachersList = document.getElementById('teachersList');
const errorState = document.getElementById('errorState');

async function loadTeachers() {

    try {

        const response = await fetch(API_URL);

        const result = await response.json();

        console.log(result);

        loadingState.style.display = 'none';

        // Ambil array data dari Laravel
        const teachers = result.data;

        if (!teachers || teachers.length === 0) {

            teachersList.innerHTML = `
                <p>No teachers found</p>
            `;

            return;
        }

        teachers.forEach((teacher) => {

            const firstLetter = teacher.name.charAt(0);

            const card = `
                <div class="teacher-card">

                    <div class="teacher-banner"></div>

                    <div class="teacher-avatar">
                        ${firstLetter}
                    </div>

                    <div class="teacher-content">

                        <h3>${teacher.name}</h3>

                        <p class="teacher-role">
                            Professional English Mentor
                        </p>

                        <div class="teacher-stats">

                            <div class="stat-box">
                                <span class="stat-number">
                                    ${teacher.courses_count}
                                </span>

                                <span class="stat-label">
                                    Courses
                                </span>
                            </div>

                            <div class="stat-box">
                                <span class="stat-number">
                                    ${teacher.total_students}
                                </span>

                                <span class="stat-label">
                                    Students
                                </span>
                            </div>

                        </div>

                        <button class="teacher-btn">
                            View Profile
                        </button>

                    </div>

                </div>
            `;

            teachersList.innerHTML += card;

        });

    } catch (error) {

        console.error(error);

        loadingState.style.display = 'none';

        errorState.style.display = 'block';
    }
}

loadTeachers();