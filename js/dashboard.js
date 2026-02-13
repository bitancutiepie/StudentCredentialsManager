// --- CONFIGURATION ---
// SUPABASE_URL and SUPABASE_KEY are loaded from common.js
// window.db is initialized in common.js
const db = window.db;

// --- UTILITIES ---
function formatTime12h(time24) {
    if (!time24) return 'TBA';
    // Handle HH:MM:SS or HH:MM
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}
window.formatTime12h = formatTime12h;

// State
let user = null;
window.user = null;
let isAdmin = false;
let currentCalDate = new Date();
let globalEvents = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard loaded...");
    checkSession();
    startClock();
    await refreshUserProfile(); // NEW: Fetch fresh data immediately
    await initLiveTracking(); // ADDED: Initialize live tracking here
    await initMessaging(); // ADDED: Initialize messaging

    // Default load
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    await loadSchedule(day);
    await loadAssignments();
    await loadEvents();
    await loadFiles();
    await loadTodos();

    // ADD THIS LINE HERE:
    await initLiveClassChecker();
    await populateSubjectOptions(); // <--- Updates buttons based on your actual schedule

    // ADD THIS NEW LINE:
    // Show highlights (and combined admin info if admin)
    setTimeout(showHighlightsModal, 2000);

    // NEW: Show SSC Payment Modal after a bit more delay
    setTimeout(showSSCPaymentPopup, 3500);

    // NEW: Valentine's Day Surprise (Auto-check)
    checkValentinesDay();

    // Heartbeat: Update last_login every 5 minutes while page is open
    setInterval(() => {
        trackActivity();
    }, 300000); // 5 minutes
});

// --- AUTH CHECK ---
function checkSession() {
    // Check Local FIRST, then Session
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!storedUser) {
        // If not logged in, go back to login page
        window.location.href = 'index.html';
        return;
    }
    user = JSON.parse(storedUser);
    window.user = user;
    window.isAdmin = (user.sr_code === 'ADMIN' || (user.role && (user.role === 'admin' || user.role.startsWith('admin:'))));
    isAdmin = window.isAdmin; // Keep local var synced

    // Update last login for "Recently Spotted" tracker on session restore
    trackActivity();

    // Setup Avatar
    setupAvatarUpdate(user.name, user.avatar_url);

    const welcomeEl = document.getElementById('welcome-msg');
    if (welcomeEl) {
        welcomeEl.innerText = `Hey ${user.name}! 2nd Sem na, aral mabuti.`;
    }

    // Enrollment Status Badge
    updateEnrollmentBadge();

    // Check if Admin
    if (user.sr_code === 'ADMIN' || (user.role && (user.role === 'admin' || user.role.startsWith('admin:')))) {
        isAdmin = true;
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));

        // Show Revoke and Broadcast button only for Main Admin
        if (user.sr_code === 'ADMIN') {
            const revokeBtn = document.getElementById('btn-revoke-admin');
            if (revokeBtn) revokeBtn.classList.remove('hidden');
            const broadcastBtn = document.getElementById('btn-broadcast-tool');
            if (broadcastBtn) broadcastBtn.classList.remove('hidden');
            const forceUpdateBtn = document.getElementById('btn-force-update');
            if (forceUpdateBtn) forceUpdateBtn.classList.remove('hidden');
        }

        // Populate Admin Data
        populateEmailDropdown();
        fetchAdminGalleryList();
        populatePromoteDropdown();
        if (user.sr_code === 'ADMIN') populateRevokeDropdown();
    }
}

// --- NEW: REFRESH USER DATA & BADGE ANIMATION ---
async function refreshUserProfile() {
    if (!user) return;
    // Fetch fresh status from DB to ensure it's up to date
    const { data, error } = await db
        .from('students')
        .select('enrollment_status, role, avatar_url')
        .eq('id', user.id)
        .single();

    if (data && !error) {
        user.enrollment_status = data.enrollment_status || 'Not Enrolled';
        user.role = data.role;
        user.avatar_url = data.avatar_url;

        // Update Local variable and Window global
        isAdmin = (user.sr_code === 'ADMIN' || (user.role && (user.role === 'admin' || user.role.startsWith('admin:'))));
        window.isAdmin = isAdmin;

        // Update Storage
        localStorage.setItem('wimpy_user', JSON.stringify(user));

        // --- UI ADJUSTMENTS BASED ON ROLE ---
        if (isAdmin) {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));

            // Granular Tool Visibility (In Admin Tools Tab)
            const toolButtons = document.querySelectorAll('#admin-tools .filter-bar .sketch-btn');
            const toolMap = {
                'Class': 'schedule',
                'Homework': 'homework',
                'Event': 'event',
                'File': 'file',
                'To-Do': 'todo',
                'Email': 'email',
                'Messages': 'messages',
                'Gallery': 'gallery',
                'Storage': 'storage'
            };

            if (toolButtons.length > 0) {
                toolButtons.forEach(btn => {
                    const btnText = btn.innerText.trim();
                    const permKey = toolMap[btnText];
                    if (permKey && !hasPermission(permKey)) {
                        btn.style.display = 'none';
                    } else {
                        btn.style.display = 'inline-flex'; // Ensure shown if has permission
                    }
                });
            }

            // Revoke button is only for Main Admin
            const revokeBtn = document.getElementById('btn-revoke-admin');
            if (revokeBtn) {
                if (user.sr_code === 'ADMIN') revokeBtn.classList.remove('hidden');
                else revokeBtn.classList.add('hidden');
            }

            // Specific tool exclusions outside admin tab
            if (!hasPermission('schedule')) {
                document.querySelectorAll('.pdf-scanner-btn, .sketch-btn.danger.admin-only').forEach(el => el.classList.add('hidden'));
            } else {
                document.querySelectorAll('.pdf-scanner-btn, .sketch-btn.danger.admin-only').forEach(el => el.classList.remove('hidden'));
            }
        }
        // ------------------------------------

        updateEnrollmentBadge(); // Re-render badge with fresh data
    }
}

function updateEnrollmentBadge() {
    const statusEl = document.getElementById('enrollment-badge');
    if (!statusEl || !user) return;

    // Reset animation
    statusEl.classList.remove('rubber-stamp');
    void statusEl.offsetWidth; // Trigger reflow

    statusEl.style.display = 'block';
    statusEl.classList.add('rubber-stamp');

    // Stamp Styling (Ink Look)
    if (user.sr_code === 'ADMIN' || (user.role && (user.role === 'admin' || user.role.startsWith('admin:')))) {
        statusEl.style.color = '#2d3436';
        statusEl.style.borderColor = '#2d3436';
        statusEl.innerHTML = 'SYSTEM ADMIN';
    } else if (user.enrollment_status === 'Enrolled') {
        statusEl.style.color = '#00b894';
        statusEl.style.borderColor = '#00b894';
        statusEl.innerHTML = 'OFFICIALLY ENROLLED';
    } else if (user.enrollment_status === 'Pending') {
        statusEl.style.color = '#e67e22';
        statusEl.style.borderColor = '#e67e22';
        statusEl.innerHTML = 'ENROLLMENT PENDING';
    } else {
        statusEl.style.color = '#d63031';
        statusEl.style.borderColor = '#d63031';
        statusEl.innerHTML = 'NOT ENROLLED';
    }
}

// logout removed (in common.js)

window.toggleWideMode = function () {
    const binder = document.querySelector('.binder');
    binder.classList.toggle('wide-mode');
    showToast(binder.classList.contains('wide-mode') ? "Expanded View!" : "Normal View");
}

// --- TABS LOGIC ---
window.switchTab = function (tabId, event) {
    if (tabId === 'admin-tools' && !isAdmin) {
        return showToast("Access Denied: Admin Restricted Area.");
    }

    const targetBtn = event ? event.currentTarget : document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Global cleanup for games
    if (tabId !== 'games' && window.cleanupMinesweeper) {
        window.cleanupMinesweeper();
    }

    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (targetBtn) targetBtn.classList.add('active');
}

window.switchGame = function (game, btn) {
    const title = document.getElementById('game-title');
    const wordleSection = document.getElementById('wordle-game-section');
    const msSection = document.getElementById('minesweeper-game-section');

    // Update buttons
    btn.parentElement.querySelectorAll('.sketch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (game === 'wordle') {
        title.innerHTML = '<i class="fas fa-gamepad"></i> WORDLE';
        title.style.background = '#f1c40f';
        wordleSection.classList.remove('hidden');
        msSection.classList.add('hidden');
        if (window.initWimpyWordle) window.initWimpyWordle();
    } else if (game === 'minesweeper') {
        title.innerHTML = '<i class="fas fa-bomb"></i> MINESWEEPER';
        title.style.background = '#e74c3c';
        wordleSection.classList.add('hidden');
        msSection.classList.remove('hidden');
        if (window.initMinesweeper) window.initMinesweeper();
    }
}

// --- SCHEDULE LOGIC ---
window.filterSchedule = function (day) {
    loadSchedule(day);
}

async function fetchData(table, orderCol, ascending = true) {
    const { data, error } = await db.from(table).select('*').order(orderCol, { ascending });
    if (error) {
        console.error(`Error loading ${table}:`, error);
        return null;
    }
    return data;
}

async function loadSchedule(dayFilter) {
    const list = document.getElementById('schedule-list');
    if (!list) return;

    document.getElementById('current-day-label').innerText = dayFilter === 'All' ? 'Weekly Schedule' : `${dayFilter} Classes`;
    list.innerHTML = '<div class="loader">Checking notebook...</div>';

    let query = db.from('schedule').select('*').order('start_time', { ascending: true });
    if (dayFilter !== 'All') query = query.eq('day_of_week', dayFilter);

    const { data, error } = await query;
    if (error) {
        console.error(error);
        list.innerHTML = '<p>Error loading schedule. Greg messed up.</p>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; font-style:italic;">No classes today. Sleep time!</p>';
        return;
    }

    list.innerHTML = data.map((cls, index) => {

        const start12h = formatTime12h(cls.start_time);
        const end12h = formatTime12h(cls.end_time);

        const deleteBtn = isAdmin ? `<button onclick="event.stopPropagation(); deleteClass(${cls.id})" class="sketch-btn danger" style="position:absolute; top:10px; right:10px; padding: 5px 10px; font-size:0.9rem; z-index:15;">X</button>` : '';

        // Copy button for Meet link
        const copyBtn = cls.meet_link ?
            `<button onclick="event.stopPropagation(); navigator.clipboard.writeText('${cls.meet_link}').then(()=>showToast('Link Copied!'))" 
             class="sketch-btn" style="border-color:#555; color:#555; padding: 8px 12px;" title="Copy Link">
             <i class="fas fa-copy"></i>
             </button>`
            : '';

        return `
            <div class="class-card" style="animation-delay: ${index * 0.1}s; ${isAdmin ? 'border-style: solid; border-width: 2px;' : ''}">
                ${deleteBtn}
                <div class="class-header">
                    <span class="subject-code">${escapeHTML(cls.subject_code)}</span>
                    <span class="time-badge">${start12h} - ${end12h}</span>
                </div>
                <h3>${escapeHTML(cls.subject_name)}</h3>
                <p><b>Teacher:</b> ${escapeHTML(cls.instructor || 'TBA')} | <b>Room:</b> ${escapeHTML(cls.room || 'TBA')}</p>
                <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
                    ${cls.meet_link ? `<a href="${cls.meet_link}" target="_blank" class="sketch-btn meet"><i class="fas fa-video"></i> Meet</a>` : ''}
                    ${cls.classroom_link ? `<a href="${cls.classroom_link}" target="_blank" class="sketch-btn classroom"><i class="fas fa-chalkboard"></i> Class</a>` : ''}
                    ${copyBtn}
                    ${isAdmin ? `
                        <button onclick="openEditClassModal(${cls.id})" class="sketch-btn" style="background:#0984e3; color:#fff; border-color:#0984e3;">
                            <i class="fas fa-edit"></i> Edit Details
                        </button>
                    ` : ''}
                </div>
                <small style="display:block; margin-top:5px; color:#666;">${cls.day_of_week}</small>
            </div>
        `;
    }).join('');
}

// --- ASSIGNMENTS LOGIC ---
window.toggleHomework = function (element) {
    const desc = element.querySelector('.assignment-description');
    const icon = element.querySelector('.hw-item-chevron');
    if (!desc || !icon) return;

    if (desc.style.display === 'none' || desc.style.display === '') {
        desc.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        desc.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}



// Global var for assignments to access data in modal
window.assignmentsData = [];

// NEW: Calendar Prompt Logic
window.openCalendarPrompt = function (index) {
    const task = window.assignmentsData[index];
    if (!task) return;

    // Populate Modal
    document.getElementById('cal-prompt-deadline').innerText = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No Deadline';
    document.getElementById('cal-prompt-task-json').value = index;

    // Default Start Date: Today
    const now = new Date();
    // Adjust to local ISO string for input[type=date] -> YYYY-MM-DD
    const toLocalDateISO = (d) => {
        const off = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - off).toISOString().slice(0, 10);
    };

    document.getElementById('cal-prompt-start').value = toLocalDateISO(now);

    document.getElementById('calendarPromptModal').classList.remove('hidden');
}

window.confirmAddToCalendar = function () {
    const index = document.getElementById('cal-prompt-task-json').value;
    const task = window.assignmentsData[index];
    if (!task) return;

    const startVal = document.getElementById('cal-prompt-start').value; // YYYY-MM-DD

    if (!startVal) return alert("Please select a start date.");

    // Google Calendar All-Day Event Logic:
    // Format: YYYYMMDD / YYYYMMDD
    // Start Date = Selected "Start Work" date
    // End Date = Deadline (Exclusive, so Deadline + 1 Day)

    const sStr = startVal.replace(/-/g, '');

    const deadlineObj = new Date(task.due_date);
    deadlineObj.setDate(deadlineObj.getDate() + 1); // Add 1 day for exclusive end date

    // Helper to format YYYYMMDD in Local Time
    const getYMD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    };

    const eStr = getYMD(deadlineObj);

    const dates = `${sStr}/${eStr}`;

    const base = "https://www.google.com/calendar/render?action=TEMPLATE";
    const params = new URLSearchParams();
    params.append('text', "Do HW: " + task.title);
    params.append('details', `Task: ${task.title}\nSubject: ${task.subject}\n\nDEADLINE: ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\nDetails: ${task.description || ''}`);
    params.append('dates', dates);

    window.open(`${base}&${params.toString()}`, '_blank');
    document.getElementById('calendarPromptModal').classList.add('hidden');
}

async function loadAssignments() {
    const list = document.getElementById('assignment-list');
    if (!list) return;

    const data = await fetchData('assignments', 'due_date');
    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center;">No homework? Miracle!</p>';
        return;
    }

    window.assignmentsData = data; // Store globally

    list.innerHTML = data.map((task, index) => {
        const date = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date';
        const deleteBtn = isAdmin ? `<button onclick="event.stopPropagation(); deleteAssignment(${task.id})" class="sketch-btn danger" style="position:absolute; top:10px; right:10px; width:auto; padding:5px 10px; font-size:0.8rem; z-index:5;">X</button>` : '';

        // Show button only if due date exists
        const calBtn = task.due_date ? `
            <button onclick="event.stopPropagation(); openCalendarPrompt(${index})" class="sketch-btn" style="width: auto; padding: 5px 10px; font-size: 0.9rem; margin: 0; background: #fff; color: #000; display: flex; align-items: center; gap: 5px;">
                <i class="fab fa-google" style="color: #4285F4;"></i> Add to Calendar
            </button>
        ` : '';

        return `
            <div class="class-card homework-card" style="animation-delay: ${index * 0.1}s; cursor: pointer; position: relative;" onclick="toggleHomework(this)">
                ${deleteBtn}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-right: 30px;">
                    <div>
                        <div class="assignment-subject-tag">${escapeHTML(task.subject)}</div>
                        <h3 style="margin-top: 5px;">${escapeHTML(task.title)}</h3>
                    </div>
                    <i class="fas fa-chevron-down hw-item-chevron" style="margin-top: 10px; color: #636e72; transition: transform 0.3s; font-size: 0.9rem;"></i>
                </div>
                <div class="assignment-description" style="display: none; margin: 15px 0;">${escapeHTML(task.description || '')}</div>
                <div class="assignment-due-date" style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fas fa-calendar-day"></i> Due: ${date}</span>
                    ${calBtn}
                </div>
            </div>
        `;
    }).join('');
}

// --- EVENTS LOGIC ---
async function loadEvents() {
    const data = await fetchData('events', 'event_date');
    globalEvents = data || [];
    renderCalendar();
}

window.renderCalendar = function () {
    const container = document.getElementById('calendar-root');
    if (!container) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let html = `
        <div class="calendar-wrapper">
            <div class="calendar-header">
                <button class="sketch-btn" onclick="changeMonth(-1)" style="width:auto;"><i class="fas fa-chevron-left"></i></button>
                <span>${monthNames[month]} ${year}</span>
                <button class="sketch-btn" onclick="changeMonth(1)" style="width:auto;"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="calendar-grid">
                <div class="cal-day-header">Sun</div><div class="cal-day-header">Mon</div><div class="cal-day-header">Tue</div>
                <div class="cal-day-header">Wed</div><div class="cal-day-header">Thu</div><div class="cal-day-header">Fri</div><div class="cal-day-header">Sat</div>
    `;

    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const dayEvents = globalEvents.filter(e => e.event_date === dateStr);
        const hasEvent = dayEvents.length > 0;

        let eventMarkers = '';
        let hoverPopup = '';

        if (hasEvent) {
            // Visual Marker (e.g., Red Circle or icon)
            eventMarkers = `<div class="cal-marker"><i class="fas fa-circle" style="color:#d63031; font-size:0.6rem;"></i> ${dayEvents.length > 1 ? '+' : ''}</div>`;

            // Hover Popup (Paper style)
            hoverPopup = `
                <div class="cal-hover-popup">
                    <div class="pin-tack"><i class="fas fa-thumbtack"></i></div>
                    <h4>${monthNames[month]} ${day}</h4>
                    <ul>
                        ${dayEvents.map(e => `<li>${escapeHTML(e.title)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}" onclick="showDayDetails('${dateStr}')">
                    <span class="cal-day-num">${day}</span>
                    ${eventMarkers}
                    ${hoverPopup}
                 </div>`;
    }
    html += `</div></div><div id="day-details-view" style="margin-top:20px;"></div>`;
    container.innerHTML = html;
}

window.changeMonth = function (offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

window.showDayDetails = function (dateStr) {
    const dayEvents = globalEvents.filter(e => e.event_date === dateStr);
    const container = document.getElementById('day-details-view');
    let html = '';

    // Admin Add Button
    if (isAdmin) {
        html += `
            <div style="text-align:center; margin-bottom:15px;">
                <button onclick="openAddEventModal('${dateStr}')" class="sketch-btn" style="font-size:1rem; padding:8px 15px; background:#fff; border:2px dashed #000; width:auto;">
                    <i class="fas fa-plus"></i> Add Event here
                </button>
            </div>
        `;
    }

    if (dayEvents.length === 0) {
        html += `<p style="text-align:center; color:#666; font-style:italic;">No events on ${dateStr}.</p>`;
    } else {
        html += dayEvents.map(evt => {
            const deleteBtn = isAdmin ? `<button onclick="deleteEvent(${evt.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';
            return `
            <div class="class-card" style="border-left: 5px solid #1976d2; margin-bottom:10px;">
                ${deleteBtn}
                <h3>${escapeHTML(evt.title)}</h3>
                <p>${new Date(evt.event_date).toDateString()}</p>
                <p>${escapeHTML(evt.description || '')}</p>
            </div>
        `;
        }).join('');
    }

    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- ADMIN FUNCTIONS ---

window.addClass = async function (e) {
    e.preventDefault();
    if (!isAdmin) return;

    const newClass = {
        day_of_week: document.getElementById('s-day').value,
        subject_code: document.getElementById('s-code').value,
        subject_name: document.getElementById('s-name').value,
        start_time: document.getElementById('s-start').value,
        end_time: document.getElementById('s-end').value,
        room: document.getElementById('s-room').value,
        instructor: document.getElementById('s-instructor').value,
        meet_link: document.getElementById('s-meet').value,
        classroom_link: document.getElementById('s-class').value
    };

    const { error } = await db.from('schedule').insert([newClass]);
    if (error) showToast('Error adding class: ' + error.message);
    else {
        showToast('Class added!');
        loadSchedule(newClass.day_of_week);
        populateSubjectOptions(); // <--- Refresh the dropdowns immediately
        e.target.reset();
    }
}

window.deleteClass = async function (id) {
    if (!isAdmin) return showToast('Nice try, hacker.');
    if (!await showWimpyConfirm('Delete this class?')) return;
    await db.from('schedule').delete().eq('id', id);
    // Refresh current view (grab the day from the label or just reload 'All')
    loadSchedule('All');
}

window.addAssignment = async function (e) {
    e.preventDefault();
    if (!isAdmin) return showToast('Nice try, hacker.');
    const newTask = {
        title: document.getElementById('a-title').value,
        subject: document.getElementById('a-subject').value,
        due_date: document.getElementById('a-due').value,
        description: document.getElementById('a-desc').value
    };
    await db.from('assignments').insert([newTask]);
    showToast('Task added!');
    loadAssignments();
    e.target.reset();
}

window.deleteAssignment = async function (id) {
    if (!isAdmin) return showToast('Nice try, hacker.');
    if (!await showWimpyConfirm('Delete task?')) return;
    await db.from('assignments').delete().eq('id', id);
    loadAssignments();
}

window.addEvent = async function (e) {
    e.preventDefault();
    if (!isAdmin) return showToast('Nice try, hacker.');
    const newEvt = {
        title: document.getElementById('e-title').value,
        event_date: document.getElementById('e-date').value,
        description: document.getElementById('e-desc').value
    };
    await db.from('events').insert([newEvt]);
    showToast('Event added!');
    loadEvents();
    e.target.reset();
}

window.deleteEvent = async function (id) {
    if (!isAdmin) return showToast('Nice try, hacker.');
    if (!await showWimpyConfirm('Delete event?')) return;
    await db.from('events').delete().eq('id', id);
    loadEvents();
}

window.deleteClass = async function (id) {
    if (!isAdmin) return showToast('Nice try, hacker.');
    if (!await showWimpyConfirm('Delete this class?')) return;
    const { error } = await db.from('schedule').delete().eq('id', id);
    if (error) {
        showToast("Error deleting class: " + error.message, "error");
    } else {
        showToast("Class deleted.");
        loadSchedule('All');
    }
}

window.deleteAllSchedules = async function () {
    if (!isAdmin) return showToast('Nice try, hacker.');
    if (!await showWimpyConfirm('⚠️ DELETE ALL SCHEDULES? This cannot be undone!')) return;

    // Double confirmation for safety
    if (!await showWimpyConfirm('Are you ABSOLUTELY sure? All classes will be permanently deleted!')) return;

    const { error } = await db.from('schedule').delete().neq('id', 0); // Delete all rows
    if (error) {
        showToast("Error deleting schedules: " + error.message, "error");
    } else {
        showToast("All schedules deleted.");
        loadSchedule('All');
        populateSubjectOptions(); // Refresh subject dropdowns since all subjects are gone
    }
}


window.openEditClassModal = async function (id) {
    if (!isAdmin) return;

    const { data: cls, error } = await db.from('schedule').select('*').eq('id', id).single();
    if (error || !cls) return showToast("Error loading class data", "error");

    document.getElementById('edit-class-id').value = id;
    document.getElementById('edit-class-day').value = cls.day_of_week;
    document.getElementById('edit-class-code').value = cls.subject_code || '';
    document.getElementById('edit-class-name').value = cls.subject_name || '';
    document.getElementById('edit-class-start').value = cls.start_time || '';
    document.getElementById('edit-class-end').value = cls.end_time || '';
    document.getElementById('edit-class-room').value = cls.room || '';
    document.getElementById('edit-class-instructor').value = cls.instructor || '';
    document.getElementById('edit-class-meet').value = cls.meet_link || '';
    document.getElementById('edit-class-classroom').value = cls.classroom_link || '';

    const modal = document.getElementById('editClassModal');
    if (modal) modal.classList.remove('hidden');
}

window.saveClassEdit = async function () {
    const id = document.getElementById('edit-class-id').value;
    const subjectCode = document.getElementById('edit-class-code').value.trim();
    const syncLinks = document.getElementById('sync-subject-links') ? document.getElementById('sync-subject-links').checked : false;

    const updateData = {
        day_of_week: document.getElementById('edit-class-day').value,
        subject_code: subjectCode,
        subject_name: document.getElementById('edit-class-name').value.trim(),
        start_time: document.getElementById('edit-class-start').value,
        end_time: document.getElementById('edit-class-end').value,
        room: document.getElementById('edit-class-room').value.trim(),
        instructor: document.getElementById('edit-class-instructor').value.trim(),
        meet_link: document.getElementById('edit-class-meet').value.trim(),
        classroom_link: document.getElementById('edit-class-classroom').value.trim()
    };

    if (!id) return;

    try {
        if (syncLinks && subjectCode) {
            // Update all classes with the same subject code
            const { error: syncError } = await db.from('schedule')
                .update({
                    meet_link: updateData.meet_link,
                    classroom_link: updateData.classroom_link
                })
                .eq('subject_code', subjectCode);

            if (syncError) console.warn("Failed to sync links:", syncError);
        }

        const { error } = await db.from('schedule')
            .update(updateData)
            .eq('id', id);

        if (error) {
            showToast("Update failed: " + error.message, "error");
        } else {
            showToast(syncLinks ? "Class updated & links synced!" : "Class updated successfully!");
            const modal = document.getElementById('editClassModal');
            if (modal) modal.classList.add('hidden');
            // Reset sync checkbox
            const syncCheck = document.getElementById('sync-subject-links');
            if (syncCheck) syncCheck.checked = false;

            // Refresh schedule
            const labelEl = document.getElementById('current-day-label');
            const day = labelEl ? labelEl.innerText.replace(' Classes', '').replace('Weekly Schedule', 'All') : 'All';
            loadSchedule(day);
        }
    } catch (err) {
        showToast("An unexpected error occurred: " + err.message, "error");
    }
}

// --- CALENDAR ADD EVENT MODAL ---
window.openAddEventModal = function (dateStr) {
    const modal = document.getElementById('addEventModal');
    const dateLabel = document.getElementById('addEventDateLabel');
    const dateInput = document.getElementById('cal-e-date');

    if (modal && dateLabel && dateInput) {
        const [y, m, day] = dateStr.split('-').map(Number);
        const localDate = new Date(y, m - 1, day);
        dateLabel.innerText = "Date: " + localDate.toDateString();
        dateInput.value = dateStr;
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('cal-e-title').focus(), 100);
    }
}

window.addEventFromCalendar = async function (e) {
    e.preventDefault();
    if (!isAdmin) return showToast('Nice try, hacker.');
    const title = document.getElementById('cal-e-title').value;
    const date = document.getElementById('cal-e-date').value;
    const desc = document.getElementById('cal-e-desc').value;

    const { error } = await db.from('events').insert([{ title, event_date: date, description: desc }]);

    if (error) {
        showToast('Error adding event: ' + error.message);
    } else {
        showToast('Event added!');
        document.getElementById('addEventModal').classList.add('hidden');
        e.target.reset();
        await loadEvents(); // Reload calendar
        showDayDetails(date); // Re-open details for that day
    }
}

// --- CLOCK ---
function startClock() {
    setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('live-clock');
        if (clockEl) {
            clockEl.innerText = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        }
    }, 1000);
}

// --- LIVE CLASS LOGIC ---

// 1. We need to store today's classes globally so we don't fetch from DB every second
let todaysClasses = [];

// Call this once when the page loads
async function initLiveClassChecker() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = days[new Date().getDay()];

    // Fetch ONLY today's classes
    const { data, error } = await db
        .from('schedule')
        .select('*')
        .eq('day_of_week', todayName);

    if (data) {
        todaysClasses = data;
        checkLiveClass(); // Run immediately
        setInterval(checkLiveClass, 1000 * 60); // Then run every 60 seconds
    }
}

function checkLiveClass() {
    const container = document.getElementById('live-class-container');
    if (!container) return;

    const now = new Date();
    // Convert current time to "HH:MM" format (e.g., "14:30") for comparison
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    // Find a class that is happening RIGHT NOW
    const liveClass = todaysClasses.find(cls => {
        // Supabase time format is usually "HH:MM:SS"
        const start = cls.start_time.substring(0, 5);
        const end = cls.end_time.substring(0, 5);

        return currentTimeStr >= start && currentTimeStr < end;
    });

    if (liveClass) {
        // Use 12h for display
        const startDisp = formatTime12h(liveClass.start_time);
        const endDisp = formatTime12h(liveClass.end_time);

        container.innerHTML = `
            <div class="live-card">
                <div class="live-card-details">
                    <div>
                        <div class="subject-code" style="font-size:1.2rem; color:#2d3436;">${escapeHTML(liveClass.subject_code)}</div>
                        <h3>${escapeHTML(liveClass.subject_name)}</h3>
                        <p style="margin:0;">
                            <i class="fas fa-clock"></i> ${startDisp} - ${endDisp} | 
                            <i class="fas fa-chalkboard-teacher"></i> ${escapeHTML(liveClass.instructor || 'TBA')}
                        </p>
                    </div>
                    <div>
                        ${liveClass.meet_link ? `<a href="${liveClass.meet_link}" target="_blank" class="sketch-btn meet" style="font-size:1.1rem; border-width:3px; margin-bottom: 5px; display: flex; justify-content: center; align-items: center; gap: 8px;">
                            <i class="fas fa-video"></i> Open G-Meet
                        </a>` : ''}
                        ${liveClass.classroom_link ? `<a href="${liveClass.classroom_link}" target="_blank" class="sketch-btn classroom" style="font-size:1.1rem; border-width:3px; display: flex; justify-content: center; align-items: center; gap: 8px; border-color: #00b894; color: #00b894;">
                            <i class="fas fa-chalkboard"></i> Go to Classroom
                        </a>` : ''}
                        ${(!liveClass.meet_link && !liveClass.classroom_link) ? '<small style="color:#666; font-style:italic;">No links provided.</small>' : ''}
                    </div>
                </div>
            </div>
        `;
        container.style.display = 'block';
    } else {
        // No class right now? Hide the container.
        container.style.display = 'none';
    }
}

// Global variable for the channel
window.roomChannel = null;

async function initLiveTracking() {
    if (!user) return;

    const userPayload = {
        user_id: user.id,
        name: user.name,
        avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
        online_at: new Date().toISOString()
    };

    try {
        // 1. Create a channel for 'room-1' (Everyone connects here)
        window.roomChannel = db.channel('room-1', {
            config: {
                presence: {
                    key: user.id, // Use User ID as key so duplicates (2 tabs) update the same entry
                },
            },
        });

        // REALTIME ANNOUNCEMENT LISTENER (Connect to room-1)
        if (window.roomChannel) {
            window.roomChannel
                .on('broadcast', { event: 'announcement' }, (payload) => {
                    console.log("Announcement received:", payload);
                    if (window.showAnnouncementPopup) {
                        window.showAnnouncementPopup(payload.payload);
                    }
                    // Refresh Sidebar List
                    if (window.loadRecentAnnouncementsSidebar) {
                        window.loadRecentAnnouncementsSidebar();
                    }
                })
                .on('broadcast', { event: 'comment' }, (payload) => {
                    if (window.handleIncomingComment) {
                        window.handleIncomingComment(payload.payload);
                    }
                })
                .on('broadcast', { event: 'delete_announcement' }, (payload) => {
                    console.log("Announcement deletion detected:", payload);
                    if (window.loadRecentAnnouncementsSidebar) {
                        window.loadRecentAnnouncementsSidebar();
                    }
                })
                .on('broadcast', { event: 'hamilaw' }, (payload) => {
                    const { target_id, sender_name } = payload.payload;
                    if (window.user && target_id === window.user.id && window.user.sr_code !== 'ADMIN') {
                        if (window.triggerGlobalShock) window.triggerGlobalShock(sender_name);
                    }
                })
                .on('broadcast', { event: 'system_reload' }, () => {
                    showToast("📦 System Update: Refreshing in 3s...", "info");
                    setTimeout(() => location.reload(true), 3000);
                });
        }

        // 2. Subscribe to Presence Events (Sync)
        window.roomChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = window.roomChannel.presenceState();
                renderActiveUsers(newState);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // 3. Track (announce) ourselves to the room
                    await window.roomChannel.track(userPayload);
                }
            });
    } catch (error) {
        console.error("Error setting up Supabase Realtime channel:", error);
        showToast("Failed to connect to live features. Please refresh.", "error");
    }


    // Check for any active global announcement
    if (window.checkActiveAnnouncements) {
        window.checkActiveAnnouncements();
    }

    // Load sidebar announcements
    loadRecentAnnouncementsSidebar();
}

/**
 * Robust Name/Avatar Change: Re-announce to the room immediately
 */
window.refreshPresence = async function () {
    if (!window.roomChannel || !window.user) return;

    // Update local user reference in dashboard.js if it drifted
    user = window.user;

    const userPayload = {
        user_id: user.id,
        name: user.name,
        avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
        online_at: new Date().toISOString()
    };

    console.log("Re-tracking presence for:", user.name);
    await window.roomChannel.track(userPayload);
}

function renderActiveUsers(presenceState) {
    const list = document.getElementById('active-users-list');
    if (!list) return;

    list.innerHTML = '';

    const users = [];
    for (const key in presenceState) {
        if (presenceState[key].length > 0) {
            users.push(presenceState[key][0]);
        }
    }

    if (users.length === 0) {
        list.innerHTML = '<small style="color:#bdc3c7;">Just you...</small>';
        return;
    }

    users.forEach(u => {
        const isMe = (u.user_id === user.id);
        const borderStyle = isMe ? 'border-color: #f1c40f;' : ''; // Gold border for self

        const div = document.createElement('div');
        div.className = 'live-user-bubble';
        div.setAttribute('data-name', isMe ? `${escapeHTML(u.name)} (You)` : escapeHTML(u.name));
        div.style.cssText = borderStyle;

        div.innerHTML = `<img src="${u.avatar}" alt="${u.name}">`;
        // Change: Show Action Menu instead of instant chat
        div.onclick = () => window.showUserActionMenu(u.user_id, u.name);

        list.appendChild(div);
    });
}

// --- AVATAR UPDATE LOGIC ---
function setupAvatarUpdate(name, avatarUrl) {
    const avatarImg = document.getElementById('userAvatarDisplay');
    if (!avatarImg) return;

    avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    let updateInput = document.getElementById('updateAvatarInput');
    if (!updateInput) {
        updateInput = document.createElement('input');
        updateInput.type = 'file';
        updateInput.id = 'updateAvatarInput';
        updateInput.accept = 'image/*';
        updateInput.style.display = 'none';
        avatarImg.parentNode.appendChild(updateInput);

        avatarImg.onclick = () => updateInput.click();
        updateInput.onchange = async (e) => {
            if (e.target.files[0] && user.id) {
                await updateProfilePic(user.id, e.target.files[0]);
            }
        };
    }
}

async function updateProfilePic(id, file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${id}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

    if (uploadError) return showToast(`Upload failed: ${uploadError.message}`);

    const { data } = db.storage.from('avatars').getPublicUrl(fileName);

    const { error: dbError } = await db
        .from('students')
        .update({ avatar_url: data.publicUrl })
        .eq('id', id);

    if (dbError) {
        showToast('Update failed. Try again.');
        return;
    }

    // Update UI and LocalStorage
    document.getElementById('userAvatarDisplay').src = data.publicUrl;
    user.avatar_url = data.publicUrl;
    // UPDATE WHICHEVER STORAGE IS BEING USED
    if (localStorage.getItem('wimpy_user')) {
        localStorage.setItem('wimpy_user', JSON.stringify(user));
    } else {
        sessionStorage.setItem('wimpy_user', JSON.stringify(user));
    }
    showToast('Nice! New picture saved.');

    // --- REFRESH PRESENCE ---
    if (window.refreshPresence) window.refreshPresence();
}

// showToast removed (in common.js)
// showToast removed (in common.js)

// --- DYNAMIC SUBJECTS LOGIC ---
async function populateSubjectOptions() {
    // 1. Fetch all subjects from the Schedule table (including names)
    const { data, error } = await db.from('schedule').select('subject_code, subject_name');

    if (error || !data) {
        console.error("Error fetching subjects for dropdown:", error);
        return;
    }

    // 2. Create a Map of Code -> Name and Get Unique Codes
    const subjectMap = {};
    data.forEach(item => {
        if (!subjectMap[item.subject_code]) {
            subjectMap[item.subject_code] = item.subject_name || item.subject_code;
        }
    });
    window.subjectMapping = subjectMap; // Store globally for other scripts
    const subjects = Object.keys(subjectMap).sort();

    // 3. Populate Filter Bar (In Files Tab)
    const filterContainer = document.getElementById('link-filters');
    if (filterContainer) {
        // Start with All and General
        let html = `
            <button class="sketch-btn" onclick="filterFiles('All')">All</button>
            <button class="sketch-btn" onclick="filterFiles('General')">General</button>
        `;

        // Add a button for each subject using its Name, but filter by Code
        subjects.forEach(code => {
            const displayName = subjectMap[code];
            html += `<button class="sketch-btn" onclick="filterFiles('${code}')">${displayName}</button>`;
        });

        filterContainer.innerHTML = html;
    }

    // 4. Populate Upload Dropdown (In Admin Form)
    const select = document.getElementById('f-subject');
    if (select) {
        // Start with default options
        let html = `
            <option value="" disabled selected>Select Subject</option>
            <option value="General">General / Other</option>
        `;

        // Add an option for each subject
        subjects.forEach(code => {
            const displayName = subjectMap[code];
            html += `<option value="${code}">${displayName} (${code})</option>`;
        });

        select.innerHTML = html;
    }
}

// --- EMAIL DROPDOWN POPULATION ---
// populateEmailDropdown removed (in admin.js)

// --- FILE UPLOAD & FILTERING LOGIC ---

// New Function: Filter the files when button is clicked
window.filterFiles = function (subject) {
    loadFiles(subject);
}

async function loadFiles(subjectFilter = 'All') {
    const list = document.getElementById('file-list');
    const label = document.getElementById('file-filter-label');
    if (!list) return;

    if (label) label.innerText = subjectFilter === 'All' ? 'Showing: All Files' : `Showing: ${subjectFilter}`;
    list.innerHTML = '<div class="loader">Rummaging through files...</div>';

    // Start Query
    let query = db.from('shared_files')
        .select('*')
        .neq('subject', 'LandingGallery')
        .not('subject', 'like', 'Receipt-%')
        .order('created_at', { ascending: false });

    // Apply Filter if not 'All'
    if (subjectFilter !== 'All') {
        query = query.eq('subject', subjectFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        list.innerHTML = '<p>Error loading files.</p>';
        return;
    }

    // FIX: Use the superior renderer from web2.html if available (supports Previews)
    if (typeof window.renderFileList === 'function') {
        window.renderFileList(data);
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; width:100%;">No files found in this folder.</p>';
        return;
    }

    list.innerHTML = data.map((file, index) => {
        const deleteBtn = isAdmin ? `<button onclick="deleteFile(${file.id})" class="sketch-btn danger" style="position:absolute; top:5px; right:5px; padding: 2px 8px; font-size: 0.8rem;">X</button>` : '';

        // Choose icon
        let icon = 'fa-file';
        if (file.file_type.includes('pdf')) icon = 'fa-file-pdf';
        else if (file.file_type.includes('image')) icon = 'fa-file-image';
        else if (file.file_type.includes('word') || file.file_type.includes('doc')) icon = 'fa-file-word';
        else if (file.file_type.includes('sheet') || file.file_type.includes('csv')) icon = 'fa-file-excel';
        else if (file.file_type.includes('presentation') || file.file_type.includes('ppt')) icon = 'fa-file-powerpoint';

        const subjectTag = file.subject ? `<span style="background:#dfe6e9; font-size:0.8rem; padding:2px 6px; border-radius:4px;">${file.subject}</span>` : '';

        return `
            <div class="class-card" style="text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:space-between; animation-delay: ${index * 0.1}s">
                ${deleteBtn}
                <div style="width:100%;">
                    <div style="font-size: 2.5rem; color: #57606f; margin-top:10px;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; margin: 10px 0; word-break: break-word;">${escapeHTML(file.title)}</h3>
                    ${subjectTag}
                </div>
                <a href="${file.file_url}" download class="sketch-btn" style="width:80%; justify-content:center; margin-top:10px;">
                    Download <i class="fas fa-download"></i>
                </a>
            </div>
        `;
    }).join('');
}

// File & Gallery Uploads moved to admin.js

// Add this function anywhere in dashboard.js
window.searchFiles = function () {
    const input = document.getElementById('file-search');
    const filter = input.value.toLowerCase();
    const container = document.getElementById('file-list');
    const cards = container.getElementsByClassName('class-card');

    for (let i = 0; i < cards.length; i++) {
        // We look for the h3 tag inside the card which contains the title
        let title = cards[i].getElementsByTagName("h3")[0];
        if (title) {
            let txtValue = title.textContent || title.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                cards[i].style.display = "";
            } else {
                cards[i].style.display = "none";
            }
        }
    }
}

// --- CUSTOM WIMPY POP-UP ---
// showWimpyConfirm removed (in common.js)

// --- REQUEST / SECRET BOX LOGIC ---
window.openRequestModal = function () {
    document.getElementById('requestModal').classList.remove('hidden');
}

window.closeRequestModal = function () {
    document.getElementById('requestModal').classList.add('hidden');
    document.getElementById('req-content').value = '';
}

window.submitRequest = async function () {
    const content = document.getElementById('req-content').value;
    if (!content) return showToast('Write something first!');

    const { error } = await db.from('requests').insert([{
        content: content,
        sender: user ? user.name : 'Anonymous'
    }]);

    if (error) showToast('Error sending: ' + error.message);
    else {
        showToast('Request sent to Admin!');
        closeRequestModal();
    }
}

// --- FREEDOM WALL LOGIC (Binder Side) ---
window.openFreedomWallModal = function () {
    document.getElementById('freedomWallModal').classList.remove('hidden');
    if (isAdmin) {
        const controls = document.getElementById('fw-admin-controls');
        if (controls) controls.classList.remove('hidden');
    }

    fetchNotes();
    setTimeout(() => {
        resolveCollisions();
        const input = document.getElementById('fw-content');
        if (input) input.focus();
    }, 100);
}

async function fetchNotes() {
    const noteLayer = document.getElementById('freedom-wall-board');
    if (!noteLayer) return;

    const { data, error } = await db.from('notes').select('*').not('color', 'in', '("CHAT_HIDDEN", "FILE_VIEW")');
    if (error) return;

    noteLayer.innerHTML = '';
    data.forEach(note => {
        const div = document.createElement('div');
        div.className = 'sticky-note';
        div.id = `note-${note.id}`;
        div.style.left = (note.x_pos || 0) + '%';
        div.style.top = (note.y_pos || 0) + '%';
        div.style.transform = `rotate(${note.rotation}deg)`;
        if (note.color) div.classList.add(note.color);

        const p = document.createElement('p');
        p.innerText = note.content;
        p.style.margin = '0';
        p.style.pointerEvents = 'none';
        div.appendChild(p);

        if (isAdmin) {
            const btn = document.createElement('button');
            btn.className = 'delete-note-btn';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.onmousedown = (e) => e.stopPropagation();
            btn.onclick = () => deleteNote(note.id);
            div.appendChild(btn);
        }

        const likeBtn = document.createElement('div');
        likeBtn.className = 'like-sticker';
        likeBtn.innerHTML = `<i class="fas fa-heart"></i> <span class="like-count">${note.likes || 0}</span>`;
        likeBtn.onmousedown = (e) => e.stopPropagation();
        div.appendChild(likeBtn);

        makeDraggable(div, note.id);
        noteLayer.appendChild(div);
    });

    setTimeout(resolveCollisions, 200);
}

function resolveCollisions() {
    const notes = Array.from(document.querySelectorAll('.sticky-note'));
    const board = document.getElementById('freedom-wall-board');
    if (!board || notes.length < 2) return;

    const boardRect = board.getBoundingClientRect();
    const padding = 10;

    for (let iter = 0; iter < 10; iter++) {
        let movedInThisPass = false;
        for (let i = 0; i < notes.length; i++) {
            for (let j = i + 1; j < notes.length; j++) {
                const n1 = notes[i];
                const n2 = notes[j];
                const r1 = n1.getBoundingClientRect();
                const r2 = n2.getBoundingClientRect();

                const overlapX = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left) + padding;
                const overlapY = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top) + padding;

                if (overlapX > 0 && overlapY > 0) {
                    movedInThisPass = true;
                    let dx = (r1.left + r1.width / 2) - (r2.left + r2.width / 2);
                    let dy = (r1.top + r1.height / 2) - (r2.top + r2.height / 2);

                    if (dx === 0 && dy === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; }

                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const force = 5;
                    const moveX = (dx / distance) * force;
                    const moveY = (dy / distance) * force;

                    const applyMove = (el, mx, my) => {
                        let lVal = parseFloat(el.style.left) || 0;
                        let tVal = parseFloat(el.style.top) || 0;
                        if (el.style.left.includes('px')) lVal = (lVal / boardRect.width) * 100;
                        if (el.style.top.includes('px')) tVal = (tVal / boardRect.height) * 100;

                        el.style.left = Math.max(0, Math.min(90, lVal + (mx / boardRect.width) * 100)) + '%';
                        el.style.top = Math.max(0, Math.min(90, tVal + (my / boardRect.height) * 100)) + '%';
                    };
                    applyMove(n1, moveX, moveY);
                    applyMove(n2, -moveX, -moveY);
                }
            }
        }
        if (!movedInThisPass) break;
    }
}

window.deleteNote = async function (id) {
    if (!await showWimpyConfirm("Tear off this note?")) return;
    const { error } = await db.from('notes').delete().eq('id', id);
    if (error) showToast("Could not delete note.");
    else {
        showToast("Note removed.");
        fetchNotes();
    }
}

function makeDraggable(element, noteId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let startLeft = 0, startTop = 0; // Track starting position

    element.onmousedown = dragMouseDown;
    element.ontouchstart = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        element.style.zIndex = 1000;
        startLeft = element.offsetLeft; // Capture start position
        startTop = element.offsetTop;

        if (e.type !== 'touchstart') e.preventDefault();
        pos3 = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        pos4 = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        element.style.zIndex = 'auto';
        document.onmouseup = null; document.onmousemove = null;
        document.ontouchend = null; document.ontouchmove = null;
        const parent = element.parentElement;

        if (!parent || parent.offsetWidth <= 0 || parent.offsetHeight <= 0) return;

        // FIX: Only update if actually moved (prevents 400 errors on simple clicks)
        if (Math.abs(element.offsetLeft - startLeft) < 2 && Math.abs(element.offsetTop - startTop) < 2) return;

        const xPercent = (element.offsetLeft / parent.offsetWidth) * 100;
        const yPercent = (element.offsetTop / parent.offsetHeight) * 100;

        if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent)) return;

        resolveCollisions();

        const finalX = parseFloat(Math.max(0, Math.min(xPercent, 95)).toFixed(2));
        const finalY = parseFloat(Math.max(0, Math.min(yPercent, 95)).toFixed(2));
        db.from('notes').update({ x_pos: finalX, y_pos: finalY }).eq('id', noteId);
    }
}

// --- ADMIN FREEDOM WALL TOOLS ---
window.autoArrangeNotes = async function () {
    const { data, error } = await db.from('notes').select('id');
    if (error || !data) return;

    showToast("Arranging...");
    const cols = 5;
    const spacingX = 18;
    const spacingY = 25;

    await Promise.all(data.map((note, i) =>
        db.from('notes').update({
            x_pos: (i % cols) * spacingX + 5,
            y_pos: Math.floor(i / cols) * spacingY + 5,
            rotation: 0
        }).eq('id', note.id)
    ));

    fetchNotes();
    showToast("Notes aligned!");
}

window.scatterNotes = async function () {
    const { data, error } = await db.from('notes').select('id');
    if (error || !data) return;

    showToast("Scattering...");
    await Promise.all(data.map(note =>
        db.from('notes').update({
            x_pos: Math.floor(Math.random() * 80) + 5,
            y_pos: Math.floor(Math.random() * 80) + 5,
            rotation: Math.floor(Math.random() * 40) - 20
        }).eq('id', note.id)
    ));

    fetchNotes();
    showToast("Notes scattered!");
}

// --- COLOR SELECTION (Binder) ---
window.selectColor = function (el, color) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('fw-binder-color').value = color;
}

window.postFreedomWallNote = async function () {
    const text = document.getElementById('fw-content').value;
    if (!text) return showToast('Write something first!');

    // Random Position & Style
    const randomX = Math.floor(Math.random() * 80) + 10;
    const randomY = Math.floor(Math.random() * 80) + 10;
    const rotation = Math.floor(Math.random() * 20) - 10;
    const selectedColor = document.getElementById('fw-binder-color').value || 'white';

    const { error } = await db.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: selectedColor, likes: 0 }]);

    if (error) showToast('Failed to post: ' + error.message);
    else {
        showToast('Note stuck to the wall!');
        document.getElementById('freedomWallModal').classList.add('hidden');
        document.getElementById('fw-content').value = '';
        fetchNotes();
    }
}

// --- SYSTEM UPDATE MODAL (Ported for Binder) ---
window.showWelcomeNote = function () {
    const modal = document.createElement('div');
    modal.className = 'wimpy-modal-overlay';
    // Override alignment for scrolling large content
    modal.style.alignItems = 'flex-start';
    modal.style.overflowY = 'auto';
    modal.style.padding = '20px';

    const note = document.createElement('div');
    note.className = 'wimpy-modal-box';
    // Override size for this specific modal
    note.style.maxWidth = '600px';
    note.style.width = '100%';
    note.style.margin = '40px auto';
    note.style.background = '#fdfbf7';

    note.innerHTML = `
        <style>
            .update-flex { display: flex; gap: 20px; justify-content: center; align-items: center; margin: 25px 0 15px 0; flex-wrap: wrap; }
            .update-arrow { font-size: 2rem; font-weight: bold; transition: transform 0.3s; }
            .update-img-container { flex: 1; min-width: 200px; position: relative; cursor: zoom-in; }
            @media (max-width: 600px) { .update-flex { flex-direction: column; gap: 30px; } .update-arrow { transform: rotate(90deg); } }
        </style>
        <h2 style="margin-top:0; text-decoration: underline wavy #000;"><i class="fas fa-star"></i> SYSTEM UPDATE</h2>
        <p style="font-size:1.1rem; margin: 10px 0;">"Look at the upgrade guys! (Click pics to zoom)"</p>
        <div class="update-flex">
            <div class="update-img-container" onclick="viewFullImage('assets/images/Beforeimg.png')">
                <div style="font-weight: bold; background: #bdc3c7; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(-3deg); border: 2px solid #000; position: absolute; top: -12px; left: -5px; z-index: 2; font-size: 0.8rem;">BEFORE:</div>
                <img src="assets/images/Beforeimg.png" alt="Old Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff;">
            </div>
            <div class="update-arrow">→</div>
            <div class="update-img-container" onclick="viewFullImage('assets/images/Afterimg.png')">
                <div style="font-weight: bold; background: #ffee58; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(3deg); border: 2px solid #000; position: absolute; top: -12px; right: -5px; z-index: 2; font-size: 0.8rem;">NOW:</div>
                <img src="assets/images/Afterimg.png" alt="New Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff;">
            </div>
        </div>
        <div style="text-align: left; background: #f9f9f9; border: 2px dashed #bbb; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <p style="font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;"><i class="fas fa-edit"></i> What's New in this Update:</p>
            <ul style="padding-left: 20px; margin: 0; list-style-type: none; font-size: 1rem; line-height: 1.6;">
                <li><i class="fas fa-shield-alt"></i> <b>Security Patch:</b> Strengthened admin protocols and fixed navigation loopholes.</li>
                <li><i class="fas fa-user-lock"></i> <b>Session Integrity:</b> Added validation to prevent unauthorized access via storage modification.</li>
                <li><i class="fas fa-folder-open"></i> <b>System Cleanup:</b> Organized file structure (CSS/JS/Assets) for better performance.</li>
                <li><i class="fas fa-code"></i> <b>Optimized Codebase:</b> Extracted inline styles and scripts to improve load times.</li>
                <li><i class="fas fa-check-circle"></i> <b>Data Ethics:</b> Reinforced authorized access controls for all users.</li>
            </ul>
        </div>
        
        <div style="text-align: left; background: #fffde7; border: 2px dashed #f1c40f; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
             <p style="font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #f39c12; padding-bottom: 5px;"><i class="fas fa-star"></i> Key Features:</p>
             <ul style="padding-left: 20px; margin: 0; list-style-type: none; font-size: 1rem; line-height: 1.6;">
                <li><i class="fas fa-paper-plane"></i> <b>Message Anyone:</b> New floating notepad button to chat with any classmate!</li>
                <li><i class="fas fa-mobile-alt"></i> <b>Mobile Optimization:</b> Reorganized header layout to prevent overlapping on phone screens.</li>
                <li><i class="fas fa-camera-retro"></i> <b>Memories Gallery:</b> New photo gallery added to the login page!</li>
                <li><i class="fas fa-question-circle"></i> <b>Help Guide:</b> Added a user guide tab inside the binder.</li>
                <li><i class="fas fa-filter"></i> <b>Smart Filters:</b> Gallery photos no longer clutter your reviewer files.</li>
                <li><i class="fas fa-magic"></i> <b>Wallpaper Generator V2:</b> Create wallpapers with <i>Glassmorphism</i> effects or upload your own background image!</li>
                <li><i class="fas fa-tools"></i> <b>Admin Tools Tab:</b> (For Admin) All management tools are now in a dedicated binder tab.</li>
                <li><i class="fas fa-sticky-note"></i> <b>Better Sticky Notes:</b> Improved tape visuals and smoother dragging.</li>
                <li><i class="fas fa-eye"></i> <b>File Previewer:</b> Preview PDFs and images instantly before downloading.</li>
                <li><i class="fas fa-clock"></i> <b>Live Class Tracker:</b> See exactly which class is happening right now.</li>
                <li><i class="fas fa-folder"></i> <b>Subject Cabinet:</b> Files are now organized by subject folders.</li>
             </ul>
        </div>
        <button onclick="showCongratsMessage(this.closest('.wimpy-modal-overlay'))" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 5px; padding: 10px;">SHEESH!</button>
    `;

    modal.appendChild(note);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); }
    document.body.appendChild(modal);
}

window.viewFullImage = function (src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; cursor: zoom-out; animation: fadeIn 0.3s;';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:90%; max-height:90%; border: 5px solid #fff; box-shadow: 0 0 30px rgba(0,0,0,0.5); object-fit: contain;';
    overlay.appendChild(img);
    overlay.onclick = function () { overlay.remove(); };
    document.body.appendChild(overlay);
}

window.showCongratsMessage = function (prevModal) {
    if (prevModal) prevModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';

    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    box.innerHTML = `
        <h2 style="margin:0 0 15px 0; font-size:2rem;">🎉 CONGRATS!</h2>
        <p style="font-size:1.3rem; margin-bottom:20px;">Congrays Guys at naipasa natin ang First Sem, Goodluck sa Second Sem!<br><br>- Jv</p>
        <button onclick="this.closest('.wimpy-modal-overlay').remove()" class="sketch-btn" style="background: #000; color: #fff; width: 100%;">LET'S GO!</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Confetti
    if (typeof confetti === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.onload = () => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        document.head.appendChild(script);
    } else {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

// Admin Tool Toggle and Storage Stats moved to admin.js

// --- PROMOTE USER LOGIC ---
// Promote/Revoke Admin Logic moved to admin.js

// --- MESSAGING SYSTEM ---
// Moved to js/messaging.js


// --- GLOBAL PASTE LISTENER (Binder Uploads) ---
document.addEventListener('paste', function (e) {
    // 1. Admin Tools
    const adminTools = document.getElementById('admin-tools');
    if (adminTools && !adminTools.classList.contains('hidden')) {
        // Check which form is open
        const fileForm = document.getElementById('admin-file-form');
        if (fileForm && fileForm.style.display === 'block') {
            const input = document.getElementById('f-file');
            if (input) handleImagePaste(e, input);
            return;
        }

        const galleryForm = document.getElementById('admin-gallery-form');
        if (galleryForm && galleryForm.style.display === 'block') {
            const input = document.getElementById('g-file');
            if (input) handleImagePaste(e, input);
            return;
        }
    }

    // 2. Wallpaper Modal
    const wpModal = document.getElementById('wallpaperModal');
    if (wpModal && !wpModal.classList.contains('hidden')) {
        const input = document.getElementById('wp-custom-bg');
        // Only if custom is selected (input is not hidden)
        if (input && !input.classList.contains('hidden')) {
            handleImagePaste(e, input);
            return;
        }
    }
});

function handleImagePaste(e, inputElement) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
            const blob = item.getAsFile();
            const file = new File([blob], "pasted_image_" + Date.now() + ".png", { type: blob.type });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            inputElement.files = dataTransfer.files;

            showToast("Image pasted from clipboard!");
            e.preventDefault();
            return;
        }
    }
}

// --- GLOBAL TO-DO LOGIC ---
window.loadTodos = async function () {
    const list = document.getElementById('todo-list');
    if (!list) return;

    list.innerHTML = '<div class="loader">Unrolling tasks...</div>';

    // 1. Fetch Todos
    const { data: todos, error: todoErr } = await db.from('global_todos').select('*').order('created_at', { ascending: false });
    if (todoErr) {
        list.innerHTML = '<p>Error loading tasks.</p>';
        return;
    }

    if (!todos || todos.length === 0) {
        list.innerHTML = '<p style="text-align:center; font-style:italic;">No global tasks yet. Check back later!</p>';
        return;
    }

    // 2. Fetch Completions
    const { data: completions, error: compErr } = await db.from('todo_completions').select('todo_id, user_id, students(name, avatar_url)');
    if (compErr) console.error("Error fetching completions:", compErr);

    // 3. Render
    list.innerHTML = todos.map(todo => {
        const itemCompletions = (completions || []).filter(c => c.todo_id === todo.id);
        const isDoneByMe = itemCompletions.some(c => c.user_id === user.id);

        const deleteBtn = isAdmin ? `<button onclick="deleteGlobalTodo(${todo.id})" class="sketch-btn danger" style="padding:2px 8px; font-size:0.8rem; height:auto; width:auto; margin:0;"><i class="fas fa-trash"></i></button>` : '';

        // Generate avatars for completed users
        const completionAvatars = itemCompletions.slice(0, 10).map(c => {
            const student = c.students;
            if (!student) return '';
            const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
            return `<img src="${avatar}" class="completion-avatar" title="${escapeHTML(student.name)} done this!">`;
        }).join('');

        const othersCount = itemCompletions.length > 10 ? `<small style="font-size:0.7rem; color:#666;">+${itemCompletions.length - 10} more</small>` : '';

        return `
            <div class="todo-item">
                <div class="todo-main">
                    <div class="todo-checkbox ${isDoneByMe ? 'checked' : ''}" onclick="toggleTodoCompletion(${todo.id}, ${isDoneByMe})">
                        <div class="charcoal-x">
                            <svg viewBox="0 0 100 100" style="width:100%; height:100%;">
                                <path d="M 20,20 L 80,80" fill="none" stroke="#000" stroke-width="12" stroke-linecap="round" />
                                <path d="M 80,20 L 20,80" fill="none" stroke="#000" stroke-width="12" stroke-linecap="round" />
                            </svg>
                        </div>
                    </div>
                    <span class="todo-task-text" style="white-space: pre-wrap; line-height: 1.4;">${escapeHTML(todo.task_name)}</span>
                    ${deleteBtn}
                </div>
                <div class="completions-area">
                    <span class="completions-label">${itemCompletions.length} Finished:</span>
                    <div class="completion-avatars">
                        ${completionAvatars}
                        ${othersCount}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleTodoCompletion = async function (todoId, currentlyDone) {
    if (!user) return;

    try {
        if (currentlyDone) {
            // Unmark
            await db.from('todo_completions').delete().eq('todo_id', todoId).eq('user_id', user.id);
            showToast("Marked as Not Done.");
        } else {
            // Mark as done
            await db.from('todo_completions').insert([{ todo_id: todoId, user_id: user.id }]);
            // Play sound
            const snd = document.getElementById('notif-sound');
            if (snd) { snd.currentTime = 0; snd.play().catch(() => { }); }
            showToast("Task Finished! Charcoal 'X' added.");
        }
        loadTodos(); // Refresh list
    } catch (err) {
        showToast("Error updating task: " + err.message, "error");
    }
}

// Admin Tools: Add Todo
window.addGlobalTodo = async function (e) {
    e.preventDefault();
    if (!isAdmin) return;

    const task = document.getElementById('todo-task').value.trim();
    if (!task) return;

    const { error } = await db.from('global_todos').insert([{ task_name: task, created_by: user.id }]);

    if (error) {
        showToast("Failed to post task: " + error.message, "error");
    } else {
        showToast("Global Task Posted!");
        document.getElementById('todo-task').value = '';
        loadTodos();
        showAdminTool(null); // Close tool
    }
}

window.deleteGlobalTodo = async function (id) {
    if (!isAdmin) return;
    if (!await showWimpyConfirm("Delete this global task? All completions will be lost!")) return;

    const { error } = await db.from('global_todos').delete().eq('id', id);
    if (error) {
        showToast("Error deleting task: " + error.message, "error");
    } else {
        showToast("Task deleted.");
        loadTodos();
    }
}

/**
 * Shows a robust admin privileges pop-up when an admin enters the binder.
 */

// --- HIGHLIGHTS MODAL (QUICK UPDATES) ---
async function showHighlightsModal() {
    // 1. Ensure user and db are ready
    const currentUser = window.user || user;
    if (!currentUser || !db) {
        console.warn("Highlights: User or DB not ready. Retrying...");
        setTimeout(showHighlightsModal, 1000);
        return;
    }

    console.log("Fetching quick highlights for:", currentUser.name);

    try {
        // 2. Prevent duplicates
        if (document.getElementById('highlights-popup')) return;

        // 3. Fetch Latest Homework (Limit 3)
        const { data: homework, error: hError } = await db
            .from('assignments')
            .select('*')
            .order('due_date', { ascending: true })
            .limit(3);

        // 3. Fetch New Files (Limit 3)
        const { data: files, error: fError } = await db
            .from('shared_files')
            .select('*')
            .neq('subject', 'LandingGallery')
            .not('subject', 'like', 'Receipt-%')
            .order('created_at', { ascending: false })
            .limit(3);

        if (hError || fError) throw new Error("Could not fetch highlights");

        // 4. Create Modal Structure
        const overlay = document.createElement('div');
        overlay.className = 'highlights-overlay';
        overlay.id = 'highlights-popup';

        const box = document.createElement('div');
        box.className = 'highlights-box';

        // Helper for subject name
        const getSubjectName = (code) => (window.subjectMapping && window.subjectMapping[code]) ? window.subjectMapping[code] : code;

        const hwHtml = homework.length > 0 ? homework.map(h => `
            <div class="highlight-item interactive" onclick="
                window.switchTab('assignments', event); 
                document.getElementById('highlights-popup').remove(); 
                console.log('User clicked homework:', '${h.id}')">
                <i class="fas fa-thumbtack" style="color:#d63031;"></i>
                <div class="highlight-details">
                    <span class="highlight-title">${escapeHTML(h.title)}</span>
                    <span class="highlight-sub">${getSubjectName(h.subject)} • <span style="color:#d63031; font-weight:bold;">Due ${window.timeAgo ? window.timeAgo(h.due_date) : new Date(h.due_date).toLocaleDateString()}</span></span>
                </div>
            </div>
        `).join('') : '<p style="text-align:center; padding:20px; color:#666; font-style:italic;">No pending homework. Chill mode! 😎</p>';

        const filesHtml = files.length > 0 ? files.map(f => {
            const safeUrl = (f.file_url || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const safeTitle = (f.title || 'File').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");

            // Icon logic to match the mini-cards
            let iconClass = 'fa-file';
            let iconColor = '#2f3542';
            const fType = (f.file_type || '').toLowerCase();
            if (fType.includes('pdf')) { iconClass = 'fa-file-pdf'; iconColor = '#d63031'; }
            else if (fType.includes('image')) { iconClass = 'fa-file-image'; iconColor = '#00b894'; }
            else if (fType.includes('word')) { iconClass = 'fa-file-word'; iconColor = '#0984e3'; }

            return `
                <div class="highlight-item interactive" onclick="openFilePreview('${safeUrl}', '${safeTitle}', ${f.id}); document.getElementById('highlights-popup').remove();">
                    <i class="fas ${iconClass}" style="color:${iconColor};"></i>
                    <div class="highlight-details">
                        <span class="highlight-title">${escapeHTML(f.title)}</span>
                        <span class="highlight-sub">${getSubjectName(f.subject)} • ${window.timeAgo ? window.timeAgo(f.created_at) : 'Just uploaded'}</span>
                    </div>
                </div>
            `;
        }).join('') : '<p style="text-align:center; padding:20px; color:#666; font-style:italic;">No new files uploaded yet. 📂</p>';

        // 4. Admin-Specific Section
        let adminHtml = '';
        if (window.isAdmin) {
            const toolDefinitions = [
                { id: 'schedule', label: 'Class Schedule Management', icon: 'fa-clock' },
                { id: 'homework', label: 'Homework & Planner Control', icon: 'fa-thumbtack' },
                { id: 'event', label: 'Event Calendar Editor', icon: 'fa-calendar-alt' },
                { id: 'file', label: 'File Cabinet & Resources', icon: 'fa-paperclip' },
                { id: 'todo', label: 'Global To-Do List Power', icon: 'fa-check-double' },
                { id: 'email', label: 'System Email Blast (Carrier Pigeon)', icon: 'fa-envelope' },
                { id: 'messages', label: 'Message & Chat Monitor', icon: 'fa-comments' },
                { id: 'gallery', label: 'Landing Page Gallery Control', icon: 'fa-images' },
                { id: 'storage', label: 'Bucket Storage Monitor', icon: 'fa-hdd' },
                { id: 'promote', label: 'Admin Privilege Management', icon: 'fa-crown' },
                { id: 'revoke', label: 'Admin Access Revocation', icon: 'fa-user-slash' },
                { id: 'blacklist', label: 'Student Black List (VIP)', icon: 'fa-user-shield' }
            ];

            const accessibleTools = [];
            toolDefinitions.forEach(tool => {
                if (tool.id === 'promote' || tool.id === 'revoke') {
                    if (currentUser.sr_code === 'ADMIN') accessibleTools.push(tool);
                } else if (window.hasPermission && window.hasPermission(tool.id)) {
                    accessibleTools.push(tool);
                }
            });

            if (accessibleTools.length > 0) {
                const toolsListHtml = accessibleTools.map(t => `
                    <div style="display:flex; align-items:center; gap:10px; padding:5px 0; font-family:'Patrick Hand';">
                        <i class="fas ${t.icon}" style="width:20px; text-align:center;"></i>
                        <span style="font-size:0.95rem;">${t.label}</span>
                    </div>
                `).join('');

                adminHtml = `
                    <div class="highlights-section" style="background:#fdfbf7; border:2px dashed #000; padding:10px; border-radius:3px; margin-bottom:15px;">
                        <div class="highlights-section-title" style="color:#6c5ce7; border-bottom-color:#6c5ce7;">
                            <i class="fas fa-crown"></i> Admin Access
                        </div>
                        <div style="max-height:120px; overflow-y:auto; padding-right:5px;" class="custom-scroll">
                            ${toolsListHtml}
                        </div>
                    </div>
                `;
            }
        }

        // 5. Create HTML content
        const headerTitle = window.isAdmin ? 'Hoy admin ka!' : 'WHAT\'S NEW?';
        const headerIcon = window.isAdmin ? 'fa-crown' : 'fa-bolt';
        const headerColor = window.isAdmin ? '#6c5ce7' : '#f1c40f';
        const headerSub = window.isAdmin ? 'Eto ang may access ka, Boss:' : 'Here\'s your quick recap, ';

        box.innerHTML = `
            <div class="highlights-header" style="${window.isAdmin ? 'background:#fffdf0; border-bottom:3px solid #000;' : ''}">
                <h2 style="${window.isAdmin ? 'color:#000; font-family:\'Patrick Hand\'; font-size:2.5rem;' : ''}">
                    <i class="fas ${headerIcon}" style="color:${headerColor};"></i> ${headerTitle}
                </h2>
                <p style="margin:5px 0 0 0; font-family:'Patrick Hand'; font-size:1.1rem;">
                    ${headerSub}${window.isAdmin ? '' : `<b>${currentUser.name.split(' ')[0]}</b>!`}
                </p>
            </div>
            <div class="highlights-content">
                ${adminHtml}
                <div class="highlights-section">
                    <div class="highlights-section-title"><i class="fas fa-thumbtack"></i> Homework Alert</div>
                    ${hwHtml}
                </div>
                <div class="highlights-section">
                    <div class="highlights-section-title"><i class="fas fa-folder-open"></i> New Resources</div>
                    ${filesHtml}
                </div>
            </div>
            <div class="highlights-footer">
                <button class="sketch-btn" id="close-highlights" style="background:#000; color:#fff; width:100%; font-size:1.2rem; transform:rotate(-1deg);">
                    OKAY, BACK TO WORK!
                </button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // 5. Track the Visit (Record in Supabase) - DISABLED UNTIL SCHEMA UPDATED
        /*
        try {
            const visitTime = new Date().toISOString();
            const updatePayload = { last_login: visitTime };

            await db.from('students')
                .update(updatePayload)
                .eq('id', currentUser.id);

            console.log(`Visit recorded for ${currentUser.name} at ${visitTime}`);
        } catch (trackErr) {
            console.warn("Activity tracking failed (probably missing columns):", trackErr);
        }
        */

        // 6. Set Session Flag & Handle Close
        sessionStorage.setItem('highlights_shown', 'true');

        document.getElementById('close-highlights').onclick = () => {
            box.style.transform = 'scale(0.8) rotate(3deg)';
            box.style.opacity = '0';
            box.style.transition = 'all 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        };

    } catch (err) {
        console.warn("Highlights popup failed:", err);
    }
}
/**
 * --- SIDEBAR ANNOUNCEMENT LIST ---
 */
window.loadRecentAnnouncementsSidebar = async function () {
    const list = document.getElementById('announcements-list');
    if (!list || !window.db) return;

    try {
        // 1. Fetch last 10 global messages (to ensure we have enough even if some expired)
        const { data: announcements, error: annError } = await window.db
            .from('notes')
            .select('*')
            .eq('color', 'GLOBAL_MSG')
            .order('created_at', { ascending: false })
            .limit(10);

        if (annError) throw annError;

        // 2. Filter for valid (non-expired)
        const now = Date.now();
        const validAnnouncements = (announcements || []).filter(ann => {
            const createdAt = new Date(ann.created_at).getTime();
            const durationMins = parseInt(ann.x_pos) || 10;
            const expiresAt = createdAt + (durationMins * 60 * 1000);
            return now < expiresAt;
        }).slice(0, 5); // Take top 5 valid

        if (validAnnouncements.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; font-size: 0.9rem;">No recent announcements.</p>';
            return;
        }

        // 3. Fetch comments for these announcements
        const annIds = validAnnouncements.map(a => 'COMMENT:' + a.id);
        const { data: comments, error: commError } = await window.db
            .from('notes')
            .select('*')
            .in('color', annIds)
            .order('created_at', { ascending: false });

        // Map comments to their announcements
        const commentMap = {};
        if (comments) {
            comments.forEach(c => {
                const annId = c.color.split(':')[1];
                if (!commentMap[annId]) commentMap[annId] = [];
                commentMap[annId].push(c);
            });
        }

        const isAdmin = window.user && window.user.sr_code === 'ADMIN';

        list.innerHTML = validAnnouncements.map(ann => {
            const timeStr = window.timeAgo ? window.timeAgo(ann.created_at) : new Date(ann.created_at).toLocaleTimeString();
            const annComments = commentMap[ann.id] || [];

            // Build Peek HTML
            let peekHtml = '';
            if (annComments.length > 0) {
                const previews = annComments.slice(0, 2).map(c => {
                    let sender = "Someone", msg = c.content;
                    if (msg.includes(':::')) [sender, msg] = msg.split(':::');
                    return `<div class="peek-line"><b>${escapeHTML(sender)}:</b> ${escapeHTML(msg)}</div>`;
                }).join('');

                const moreCount = annComments.length > 2 ? `<div style="font-size:0.7rem; opacity:0.6; margin-top:3px;">+ ${annComments.length - 2} more...</div>` : '';

                peekHtml = `
                    <div class="ann-peek">
                        <div class="peek-title"><i class="fas fa-comments"></i> Reactions (${annComments.length})</div>
                        ${previews}
                        ${moreCount}
                    </div>
                `;
            }

            const deleteBtn = isAdmin ? `
                <button onclick="event.stopPropagation(); deleteAnnouncementSidebar('${ann.id}')" 
                        style="position: absolute; top: -5px; right: -5px; background: #d63031; color: #fff; border: 2px solid #000; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.7rem; z-index: 10; box-shadow: 2px 2px 0 rgba(0,0,0,0.1);">
                    <i class="fas fa-times"></i>
                </button>
            ` : '';

            return `
                <div class="ann-mini-card" style="position: relative;" onclick="window.showAnnouncementPopup({id: '${ann.id}', message: \`${ann.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, admin_name: 'Admin'})">
                    ${deleteBtn}
                    <div class="ann-mini-content" style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${escapeHTML(ann.content)}
                    </div>
                    <small><i class="fas fa-clock"></i> ${timeStr} ${annComments.length > 0 ? `<span style="margin-left:auto;"><i class="fas fa-comment"></i> ${annComments.length}</span>` : ''}</small>
                    ${peekHtml}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Bulletin announcements load failed:", err);
    }
};

window.deleteAnnouncementSidebar = async function (id) {
    if (!window.user || window.user.sr_code !== 'ADMIN') return;

    const confirmMsg = "Do you want to delete this announcement and all its comments?";
    if (window.showWimpyConfirm) {
        if (!await window.showWimpyConfirm(confirmMsg)) return;
    } else {
        if (!confirm(confirmMsg)) return;
    }

    try {
        // 1. Delete main announcement
        const { error: annError } = await window.db
            .from('notes')
            .delete()
            .eq('id', id);

        if (annError) throw annError;

        // 2. Delete linked comments
        await window.db
            .from('notes')
            .delete()
            .eq('color', 'COMMENT:' + id);

        // 3. Broadcast Deletion
        if (window.roomChannel) {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'delete_announcement',
                payload: { id: id }
            });
        }

        showToast("Announcement deleted!");
        loadRecentAnnouncementsSidebar();
    } catch (err) {
        console.error("Failed to delete announcement:", err);
        showToast("Error deleting announcement", "error");
    }
};
// --- HAMILAW (SHOCK) FEATURE ---
window.showUserActionMenu = function (targetId, targetName) {
    if (targetId === window.user.id) return; // Can't shock self

    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    overlay.style.zIndex = '10007';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    box.style.textAlign = 'center';
    box.style.maxWidth = '300px';
    box.style.padding = '30px';
    box.style.background = '#fff';
    box.style.transform = 'rotate(-1deg)';

    box.innerHTML = `
        <h3 style="margin:0 0 15px 0; font-family:'Permanent Marker'; font-size:1.5rem;">Choose Action</h3>
        <p style="font-family:'Patrick Hand'; color:#666; font-size:1.1rem; margin-bottom:20px;">What do you want to do with <b>${targetName}</b>?</p>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
            <button id="action-msg" class="sketch-btn" style="background:#6c5ce7; color:#fff;">
                <i class="fas fa-comment"></i> SEND MESSAGE
            </button>
            <button id="action-shock" class="sketch-btn danger" style="background:#d63031; color:#fff;">
                 👻 "HAMILAW" (SHOCK)
            </button>
            <button id="action-cancel" class="sketch-btn" style="border:none; text-decoration:underline; width:auto; margin:0 auto;">CANCEL</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('action-msg').onclick = () => {
        overlay.remove();
        if (window.openChatModal) window.openChatModal(targetId, targetName);
    };

    document.getElementById('action-shock').onclick = () => {
        overlay.remove();
        window.hamilawUser(targetId, targetName);
    };

    document.getElementById('action-cancel').onclick = () => overlay.remove();
};

// Anti-spam cooldown storage
window.hamilawCooldowns = {};

window.hamilawUser = async function (targetId, targetName) {
    if (!window.roomChannel) return;

    // Check Cooldown (5 seconds per target)
    const now = Date.now();
    const lastShock = window.hamilawCooldowns[targetId] || 0;
    const waitTime = Math.ceil((5000 - (now - lastShock)) / 1000);

    if (now - lastShock < 5000) {
        showToast(`👻 Chill! You can shock ${targetName.split(' ')[0]} again in ${waitTime}s.`, "error");
        return;
    }

    try {
        const resp = await window.roomChannel.send({
            type: 'broadcast',
            event: 'hamilaw',
            payload: {
                target_id: targetId,
                sender_name: window.user.name
            }
        });

        if (resp === 'ok') {
            window.hamilawCooldowns[targetId] = now;
            showToast(`👻 Hamilaw sent to ${targetName.split(' ')[0]}!`, "success");
        }
    } catch (err) {
        console.error("Hamilaw failed:", err);
    }
};

// --- SSC PAYMENT MODAL LOGIC ---
window.showSSCPaymentPopup = function () {
    // 1. Check if user is already paid (stored in localStorage)
    const isPaid = localStorage.getItem('ssc_paid');
    if (isPaid === 'true') {
        console.log("SSC: User already marked as paid. Skipping popup.");
        return;
    }

    // 2. Show the modal
    const modal = document.getElementById('sscPaymentModal');
    if (modal) {
        modal.classList.remove('hidden');
        console.log("SSC: Showing payment popup.");
    }
}

window.closeSSCPaymentModal = function () {
    // 1. Check if user marked the "Already Paid" checkbox
    const isChecked = document.getElementById('ssc-paid-checkbox').checked;
    if (isChecked) {
        localStorage.setItem('ssc_paid', 'true');
        if (window.showToast) showToast("Payment status saved! You won't see this again.", "info");
    }

    // 2. Hide the modal
    const modal = document.getElementById('sscPaymentModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// --- VALENTINE'S DAY SURPRISE ---
function checkValentinesDay() {
    const now = new Date();
    // Check if Feb 14 (Month is 0-indexed: Jan=0, Feb=1)
    if (now.getMonth() === 1 && now.getDate() === 14) {
        console.log("It's Valentine's Day! <3");

        // Inject Font if not present
        if (!document.querySelector('link[href*="Pacifico"]')) {
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'valentines-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.9)', // Dark transparent background
            zIndex: '99999',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            opacity: '0',
            transition: 'opacity 0.6s ease',
            backdropFilter: 'blur(5px)' // Nice blur effect
        });

        // HTML Content & Styles
        overlay.innerHTML = `
            <style>
                @keyframes heartbeat {
                    0% { transform: scale(1); }
                    15% { transform: scale(1.3); }
                    30% { transform: scale(1); }
                    45% { transform: scale(1.15); }
                    60% { transform: scale(1); }
                }
                @keyframes floatUp {
                    0% { transform: translateY(110vh) scale(0.5); opacity: 0; }
                    20% { opacity: 0.8; }
                    80% { opacity: 0.8; }
                    100% { transform: translateY(-10vh) scale(1.2); opacity: 0; }
                }
                .heart-particle {
                    position: absolute;
                    color: #e84393;
                    top: 100vh;
                    font-size: 2rem;
                    pointer-events: none;
                    animation: floatUp 5s linear infinite;
                    text-shadow: 0 0 10px rgba(232, 67, 147, 0.5);
                }
                .v-text {
                     text-shadow: 5px 5px 0 #c0392b, 8px 8px 0 #000;
                }
            </style>
            
            <div style="text-align: center; animation: heartbeat 2s infinite; z-index: 10; position: relative;">
                <h1 class="v-text" style="font-family: 'Pacifico', cursive; font-size: clamp(3rem, 10vw, 7rem); line-height: 1.1; color: #ff7675; margin: 0; transform: rotate(-5deg);">
                    Happy<br>Valentine's<br>Day!
                </h1>
                <p style="font-family: 'Permanent Marker', cursive; font-size: clamp(1.2rem, 4vw, 2rem); color: #fff; margin-top: 20px; letter-spacing: 2px;">
                    from: <span style="color: #fdcb6e; text-decoration: underline wavy #ff7675; text-underline-offset: 5px;">ADMIN-JV</span>
                </p>
            </div>
        `;

        // Add Floating Hearts (More of them!)
        for (let i = 0; i < 40; i++) {
            const heart = document.createElement('div');
            const hearts = ['❤', '💖', '💘', '💝', '💓'];
            heart.innerText = hearts[Math.floor(Math.random() * hearts.length)];
            heart.className = 'heart-particle';

            // Randomize Props
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.fontSize = (Math.random() * 2 + 1.5) + 'rem';
            heart.style.animationDuration = (Math.random() * 4 + 3) + 's'; // 3-7s duration
            heart.style.animationDelay = (Math.random() * 5) + 's'; // Stagger start

            overlay.appendChild(heart);
        }

        // Close on click
        overlay.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 600);
        };

        document.body.appendChild(overlay);

        // Fade In
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 100);

        // Auto dismiss after 10 seconds (enough time to read)
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 600);
            }
        }, 10000);
    }
}
