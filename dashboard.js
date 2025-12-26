// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

// FIX: We use 'db' instead of 'supabase' to avoid conflict with the library name
window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); // Make 'db' a global variable

// State
let user = null;
let isAdmin = false;
let currentCalDate = new Date();
let globalEvents = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard loaded...");
    checkSession();
    startClock();
    await initLiveTracking(); // ADDED: Initialize live tracking here
    
    // Default load
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    await loadSchedule(day);
    await loadAssignments();
    await loadEvents();
    await loadFiles();

    // ADD THIS LINE HERE:
    await initLiveClassChecker();
    await populateSubjectOptions(); // <--- Updates buttons based on your actual schedule

    // ADD THIS NEW LINE:
    if (isAdmin) {
        await populateEmailDropdown();
        await fetchAdminGalleryList(); // Load gallery items for admin
    }
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
    
    // Setup Avatar
    setupAvatarUpdate(user.name, user.avatar_url);

    const welcomeEl = document.getElementById('welcome-msg');
    if (welcomeEl) {
        welcomeEl.innerText = `Hey ${user.name}! 2nd Sem na, aral mabuti.`;
    }
    
    // Check if Admin
    if (user.sr_code === 'ADMIN') {
        isAdmin = true;
        // document.querySelectorAll('.admin-controls').forEach(el => el.style.display = 'block'); // Removed to allow menu toggling
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

// FIX: Explicitly attach logout to window
window.logout = async function() {
    if (!await showWimpyConfirm("Pack up and leave?")) return;
    localStorage.removeItem('wimpy_user');
    // Clear BOTH to be safe
    sessionStorage.removeItem('wimpy_user');
    window.location.href = 'index.html';
}

window.toggleWideMode = function() {
    const binder = document.querySelector('.binder');
    binder.classList.toggle('wide-mode');
    showToast(binder.classList.contains('wide-mode') ? "Expanded View!" : "Normal View");
}

// --- TABS LOGIC ---
window.switchTab = function(tabId, event) {
    const targetBtn = event ? event.currentTarget : document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (targetBtn) targetBtn.classList.add('active');
}

// --- SCHEDULE LOGIC ---
window.filterSchedule = function(day) {
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
        const start = cls.start_time.substring(0, 5); 
        const end = cls.end_time.substring(0, 5);
        
        const deleteBtn = isAdmin ? `<button onclick="deleteClass(${cls.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';
        
        // Copy button for Meet link
        const copyBtn = cls.meet_link ? 
            `<button onclick="navigator.clipboard.writeText('${cls.meet_link}').then(()=>showToast('Link Copied!'))" 
             class="sketch-btn" style="border-color:#555; color:#555; padding: 8px 12px;" title="Copy Link">
             <i class="fas fa-copy"></i>
             </button>` 
            : '';

        return `
            <div class="class-card" style="animation-delay: ${index * 0.1}s">
                ${deleteBtn}
                <div class="class-header">
                    <span class="subject-code">${cls.subject_code}</span>
                    <span class="time-badge">${start} - ${end}</span>
                </div>
                <h3>${cls.subject_name}</h3>
                <p><b>Prof:</b> ${cls.instructor || 'TBA'} | <b>Room:</b> ${cls.room || 'TBA'}</p>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    ${cls.meet_link ? `<a href="${cls.meet_link}" target="_blank" class="sketch-btn meet"><i class="fas fa-video"></i> Meet</a>` : ''}
                    ${cls.classroom_link ? `<a href="${cls.classroom_link}" target="_blank" class="sketch-btn classroom"><i class="fas fa-chalkboard"></i> Class</a>` : ''}
                    ${copyBtn}
                </div>
                <small style="display:block; margin-top:5px; color:#666;">${cls.day_of_week}</small>
            </div>
        `;
    }).join('');
}

// --- ASSIGNMENTS LOGIC ---
async function loadAssignments() {
    const list = document.getElementById('assignment-list');
    if (!list) return;
    
    const data = await fetchData('assignments', 'due_date');
    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center;">No homework? Miracle!</p>';
        return;
    }

    list.innerHTML = data.map((task, index) => {
        const date = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date';
        const deleteBtn = isAdmin ? `<button onclick="deleteAssignment(${task.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';
        
        return `
            <div class="class-card" style="border-left: 5px solid #d32f2f; animation-delay: ${index * 0.1}s">
                ${deleteBtn}
                <h3>${task.title} <span style="font-size:0.8rem; background:#ddd; padding:2px 5px;">${task.subject}</span></h3>
                <p>${task.description || ''}</p>
                <p style="color:#d32f2f; font-weight:bold;">Due: ${date}</p>
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

window.renderCalendar = function() {
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
        const eventHtml = dayEvents.map(e => `<div class="cal-event-dot" title="${e.title}">${e.title}</div>`).join('');

        html += `<div class="cal-day ${isToday ? 'today' : ''}" onclick="showDayDetails('${dateStr}')">
                    <span style="font-weight:bold; font-size:0.9rem;">${day}</span>${eventHtml}
                 </div>`;
    }
    html += `</div></div><div id="day-details-view" style="margin-top:20px;"></div>`;
    container.innerHTML = html;
}

window.changeMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

window.showDayDetails = function(dateStr) {
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
                <h3>${evt.title}</h3>
                <p>${new Date(evt.event_date).toDateString()}</p>
                <p>${evt.description || ''}</p>
            </div>
        `;
        }).join('');
    }

    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- ADMIN FUNCTIONS ---

window.addClass = async function(e) {
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

window.deleteClass = async function(id) {
    if(!await showWimpyConfirm('Delete this class?')) return;
    await db.from('schedule').delete().eq('id', id);
    // Refresh current view (grab the day from the label or just reload 'All')
    loadSchedule('All');
}

window.addAssignment = async function(e) {
    e.preventDefault();
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

window.deleteAssignment = async function(id) {
    if(!await showWimpyConfirm('Delete task?')) return;
    await db.from('assignments').delete().eq('id', id);
    loadAssignments();
}

window.addEvent = async function(e) {
    e.preventDefault();
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

window.deleteEvent = async function(id) {
    if(!await showWimpyConfirm('Delete event?')) return;
    await db.from('events').delete().eq('id', id);
    loadEvents();
}

// --- CALENDAR ADD EVENT MODAL ---
window.openAddEventModal = function(dateStr) {
    const modal = document.getElementById('addEventModal');
    const dateLabel = document.getElementById('addEventDateLabel');
    const dateInput = document.getElementById('cal-e-date');
    
    if(modal && dateLabel && dateInput) {
        const [y, m, day] = dateStr.split('-').map(Number);
        const localDate = new Date(y, m - 1, day);
        dateLabel.innerText = "Date: " + localDate.toDateString();
        dateInput.value = dateStr;
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('cal-e-title').focus(), 100);
    }
}

window.addEventFromCalendar = async function(e) {
    e.preventDefault();
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
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // Find a class that is happening RIGHT NOW
    const liveClass = todaysClasses.find(cls => {
        // Supabase time format is usually "HH:MM:SS"
        const start = cls.start_time.substring(0, 5); 
        const end = cls.end_time.substring(0, 5);
        
        return currentTimeStr >= start && currentTimeStr < end;
    });

    if (liveClass) {
        // Render the Live Card
        const start = liveClass.start_time.substring(0, 5);
        const end = liveClass.end_time.substring(0, 5);
        
        container.innerHTML = `
            <div class="live-card">
                <div class="live-card-details">
                    <div>
                        <div class="subject-code" style="font-size:1.2rem; color:#2d3436;">${liveClass.subject_code}</div>
                        <h3>${liveClass.subject_name}</h3>
                        <p style="margin:0;">
                            <i class="fas fa-clock"></i> ${start} - ${end} | 
                            <i class="fas fa-chalkboard-teacher"></i> ${liveClass.instructor || 'TBA'}
                        </p>
                    </div>
                    <div>
                        ${liveClass.meet_link ? `<a href="${liveClass.meet_link}" target="_blank" class="sketch-btn meet" style="font-size:1.2rem; border-width:3px;">Join Now <i class="fas fa-arrow-right"></i></a>` : ''}
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
let roomChannel;

async function initLiveTracking() {
    if (!user) return;

    const userPayload = {
        user_id: user.id,
        name: user.name,
        avatar: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
        online_at: new Date().toISOString()
    };

    // 1. Create a channel for 'room-1' (Everyone connects here)
    roomChannel = db.channel('room-1', {
        config: {
            presence: {
                key: user.id, // Use User ID as key so duplicates (2 tabs) update the same entry
            },
        },
    });

    // 2. Subscribe to Presence Events (Sync)
    roomChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = roomChannel.presenceState();
            renderActiveUsers(newState);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // 3. Track (announce) ourselves to the room
                await roomChannel.track(userPayload);
            }
        });
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
        div.setAttribute('data-name', isMe ? `${u.name} (You)` : u.name);
        div.style.cssText = borderStyle;

        div.innerHTML = `<img src="${u.avatar}" alt="${u.name}">`;
        
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
}

// --- TOAST NOTIFICATION FUNCTION ---
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// --- DYNAMIC SUBJECTS LOGIC ---
async function populateSubjectOptions() {
    // 1. Fetch all subjects from the Schedule table
    const { data, error } = await db.from('schedule').select('subject_code');
    
    if (error || !data) {
        console.error("Error fetching subjects for dropdown:", error);
        return;
    }

    // 2. Get Unique Codes (Remove duplicates) and Sort them
    // This looks at your schedule and lists each subject only once
    const subjects = [...new Set(data.map(item => item.subject_code))].sort();

    // 3. Populate Filter Bar (In Links Tab)
    const filterContainer = document.getElementById('link-filters');
    if (filterContainer) {
        // Start with All and General
        let html = `
            <button class="sketch-btn" onclick="filterFiles('All')">All</button>
            <button class="sketch-btn" onclick="filterFiles('General')">General</button>
        `;
        
        // Add a button for each subject in your schedule
        subjects.forEach(code => {
             html += `<button class="sketch-btn" onclick="filterFiles('${code}')">${code}</button>`;
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
             html += `<option value="${code}">${code}</option>`;
        });
        
        select.innerHTML = html;
    }
}

// --- EMAIL DROPDOWN POPULATION ---
async function populateEmailDropdown() {
    const dropdown = document.getElementById('email-recipient');
    if (!dropdown) return;

    // Fetch Name, SR Code, and Email of all students
    const { data, error } = await db
        .from('students')
        .select('name, sr_code, email')
        .neq('sr_code', 'ADMIN') // Don't list the admin
        .order('name', { ascending: true });

    if (error) return console.error("Error loading recipients:", error);

    // Keep the "Everyone" option, remove others to avoid duplicates if reloaded
    dropdown.innerHTML = '<option value="ALL">Send to Everyone (Blast)</option>';

    data.forEach(student => {
        // Only add if they have an email
        if (student.email) {
            const option = document.createElement('option');
            option.value = student.email; // The value is the email address
            option.innerText = `${student.name} (${student.sr_code})`;
            dropdown.appendChild(option);
        }
    });
}

// --- FILE UPLOAD & FILTERING LOGIC ---

// New Function: Filter the files when button is clicked
window.filterFiles = function(subject) {
    loadFiles(subject);
}

async function loadFiles(subjectFilter = 'All') {
    const list = document.getElementById('file-list');
    const label = document.getElementById('file-filter-label');
    if (!list) return;

    if(label) label.innerText = subjectFilter === 'All' ? 'Showing: All Files' : `Showing: ${subjectFilter}`;
    list.innerHTML = '<div class="loader">Rummaging through files...</div>';

    // Start Query
    let query = db.from('shared_files').select('*').neq('subject', 'LandingGallery').order('created_at', { ascending: false });

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
                    <h3 style="font-size: 1.1rem; margin: 10px 0; word-break: break-word;">${file.title}</h3>
                    ${subjectTag}
                </div>
                <a href="${file.file_url}" download class="sketch-btn" style="width:80%; justify-content:center; margin-top:10px;">
                    Download <i class="fas fa-download"></i>
                </a>
            </div>
        `;
    }).join('');
}

window.uploadFile = async function(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const fileInput = document.getElementById('f-file');
    const titleInput = document.getElementById('f-title');
    const subjectInput = document.getElementById('f-subject'); // New input
    const btn = document.getElementById('upload-btn');
    const file = fileInput.files[0];

    if (!file) return showToast('Please select a file.');
    if (!subjectInput.value) return showToast('Please select a subject.');

    btn.disabled = true;
    btn.innerHTML = 'Uploading...';

    try {
        const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        
        // 1. Upload
        const { error: uploadError } = await db.storage
            .from('class-resources')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. Get URL
        const { data: urlData } = db.storage
            .from('class-resources')
            .getPublicUrl(fileName);

        // 3. Save to DB with Subject
        const { error: dbError } = await db.from('shared_files').insert([{
            title: titleInput.value,
            subject: subjectInput.value, // Saving the subject
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbError) throw dbError;

        showToast('File added to ' + subjectInput.value + ' folder!');
        loadFiles(subjectInput.value); // Reload showing the category you just uploaded to
        e.target.reset();

    } catch (error) {
        console.error(error);
        showToast('Upload failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paperclip"></i> Upload to Cabinet';
    }
}

window.deleteFile = async function(id) {
    if(!await showWimpyConfirm('Delete this file?')) return;
    const { error } = await db.from('shared_files').delete().eq('id', id);
    if (error) showToast('Error deleting file.');
    else {
        showToast('File removed.');
        loadFiles(); // Refresh
    }
}

// --- EMAIL BLAST LOGIC (EmailJS) ---

window.sendEmailService = async function(e) {
    e.preventDefault();

    // 🔴 YOUR SERVICE ID (Make sure this is correct)
    const SERVICE_ID = 'service_crvq85j'; 
    const TEMPLATE_ID = 'template_jhu61sc'; 

    if (!isAdmin) return showToast("Admins only!");

    const recipientSelect = document.getElementById('email-recipient');
    const subjectInput = document.getElementById('email-subject');
    const bodyInput = document.getElementById('email-body');
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;

    // CHECK: Who are we sending to?
    const selectedValue = recipientSelect.value; // This is either 'ALL' or a specific email
    const selectedName = recipientSelect.options[recipientSelect.selectedIndex].text;

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        let emailList = "";

        // SCENARIO 1: SEND TO EVERYONE
        if (selectedValue === 'ALL') {
            btn.innerText = "Gathering all emails...";
            const { data, error } = await db
                .from('students')
                .select('email')
                .neq('sr_code', 'ADMIN')
                .not('email', 'is', null)
                .neq('email', '');

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("No emails found!");

            // Join all emails with commas
            emailList = data.map(s => s.email).join(',');
        } 
        // SCENARIO 2: SEND TO SPECIFIC PERSON
        else {
            // The value of the option is already the email address
            emailList = selectedValue;
        }

        console.log("Sending to:", emailList);

        // Send via EmailJS
        const templateParams = {
            subject: subjectInput.value,
            message: bodyInput.value,
            bcc: emailList, // We still use BCC field (works for 1 person too)
            from_name: user.name
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);

        if (selectedValue === 'ALL') {
            showToast("Blast sent to everyone!");
        } else {
            showToast(`Sent to ${selectedName}!`);
        }
        
        e.target.reset();
        // Reset dropdown to ALL
        recipientSelect.value = "ALL";

    } catch (err) {
        console.error("Email Error:", err);
        showToast(err.message || "Failed to send.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- LANDING PAGE GALLERY MANAGER (ADMIN) ---
window.uploadGalleryItem = async function(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const fileInput = document.getElementById('g-file');
    const captionInput = document.getElementById('g-caption');
    const btn = document.getElementById('upload-gallery-btn');
    const file = fileInput.files[0];

    if (!file) return showToast('Please select an image.');

    btn.disabled = true;
    btn.innerHTML = 'Posting...';

    try {
        const fileName = `gallery_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        
        // Reuse class-resources bucket
        const { error: uploadError } = await db.storage
            .from('class-resources')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = db.storage
            .from('class-resources')
            .getPublicUrl(fileName);

        const { error: dbError } = await db.from('shared_files').insert([{
            title: captionInput.value || 'Untitled',
            subject: 'LandingGallery', // Special tag for landing page
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbError) throw dbError;

        showToast('Posted to Landing Page!');
        fetchAdminGalleryList(); 
        e.target.reset();

    } catch (error) {
        console.error(error);
        showToast('Upload failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-camera"></i> Post to Gallery';
    }
}

window.fetchAdminGalleryList = async function() {
    const list = document.getElementById('admin-gallery-list');
    if(!list) return;
    
    const { data, error } = await db.from('shared_files').select('*').eq('subject', 'LandingGallery').order('created_at', { ascending: false });
    if(error || !data || data.length === 0) { list.innerHTML = '<p style="font-size:0.9rem; color:#666; text-align:center;">Gallery is empty.</p>'; return; }

    list.innerHTML = data.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #ccc; padding:5px 0;">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${item.file_url}" style="width:30px; height:30px; object-fit:cover; border:1px solid #000;">
                <small style="font-family:'Patrick Hand';">${item.title}</small>
            </div>
            <button onclick="deleteFile(${item.id}); setTimeout(fetchAdminGalleryList, 500);" class="sketch-btn danger" style="padding:2px 6px; font-size:0.8rem; width:auto; margin:0;">X</button>
        </div>
    `).join('');
}

// Add this function anywhere in dashboard.js
window.searchFiles = function() {
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
function showWimpyConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'wimpy-modal-overlay';
        
        const box = document.createElement('div');
        box.className = 'wimpy-modal-box';
        
        box.innerHTML = `
            <h2 style="margin:0 0 10px 0; font-size:2rem;">WAIT!</h2>
            <p style="font-size:1.3rem; margin-bottom:20px;">${message}</p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="wimpy-no" class="sketch-btn" style="flex:1;">NAH</button>
                <button id="wimpy-yes" class="sketch-btn danger" style="flex:1; background:#000; color:#fff;">YEAH</button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        document.getElementById('wimpy-no').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        
        document.getElementById('wimpy-yes').onclick = () => {
            overlay.remove();
            resolve(true);
        };
    });
}

// --- REQUEST / SECRET BOX LOGIC ---
window.openRequestModal = function() {
    document.getElementById('requestModal').classList.remove('hidden');
}

window.closeRequestModal = function() {
    document.getElementById('requestModal').classList.add('hidden');
    document.getElementById('req-content').value = '';
}

window.submitRequest = async function() {
    const content = document.getElementById('req-content').value;
    if(!content) return showToast('Write something first!');
    
    const { error } = await db.from('requests').insert([{
        content: content,
        sender: user ? user.name : 'Anonymous'
    }]);
    
    if(error) showToast('Error sending: ' + error.message);
    else {
        showToast('Request sent to Admin!');
        closeRequestModal();
    }
}

// --- FREEDOM WALL LOGIC (Binder Side) ---
window.openFreedomWallModal = function() {
    document.getElementById('freedomWallModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('fw-content').focus(), 100);
}

// --- COLOR SELECTION (Binder) ---
window.selectColor = function(el, color) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('fw-binder-color').value = color;
}

window.postFreedomWallNote = async function() {
    const text = document.getElementById('fw-content').value.trim();
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
    }
}

// --- SYSTEM UPDATE MODAL (Ported for Binder) ---
window.showWelcomeNote = function() {
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
            <div class="update-img-container" onclick="viewFullImage('Beforeimg.png')">
                <div style="font-weight: bold; background: #bdc3c7; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(-3deg); border: 2px solid #000; position: absolute; top: -12px; left: -5px; z-index: 2; font-size: 0.8rem;">BEFORE:</div>
                <img src="Beforeimg.png" alt="Old Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff;">
            </div>
            <div class="update-arrow">→</div>
            <div class="update-img-container" onclick="viewFullImage('Afterimg.png')">
                <div style="font-weight: bold; background: #ffee58; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(3deg); border: 2px solid #000; position: absolute; top: -12px; right: -5px; z-index: 2; font-size: 0.8rem;">NOW:</div>
                <img src="Afterimg.png" alt="New Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff;">
            </div>
        </div>
        <div style="text-align: left; background: #f9f9f9; border: 2px dashed #bbb; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <p style="font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;"><i class="fas fa-edit"></i> What's New in this Update:</p>
            <ul style="padding-left: 20px; margin: 0; list-style-type: none; font-size: 1rem; line-height: 1.6;">
                <li><i class="fas fa-camera-retro"></i> <b>Memories Gallery:</b> New photo gallery added to the login page!</li>
                <li><i class="fas fa-question-circle"></i> <b>Help Guide:</b> Added a user guide tab inside the binder.</li>
                <li><i class="fas fa-filter"></i> <b>Smart Filters:</b> Gallery photos no longer clutter your reviewer files.</li>
                <li><i class="fas fa-magic"></i> <b>Wallpaper Generator V2:</b> Create wallpapers with <i>Glassmorphism</i> effects or upload your own background image!</li>
                <li><i class="fas fa-tools"></i> <b>Admin Tools Tab:</b> (For Admin) All management tools are now in a dedicated binder tab.</li>
                <li><i class="fas fa-sticky-note"></i> <b>Better Sticky Notes:</b> Improved tape visuals and smoother dragging.</li>
                <li><i class="fas fa-eye"></i> <b>File Previewer:</b> Preview PDFs and images instantly before downloading.</li>
                <li><i class="fas fa-clock"></i> <b>Live Class Tracker:</b> See exactly which class is happening right now.</li>
                <li><i class="fas fa-folder"></i> <b>Subject Cabinet:</b> Files are now organized by subject folders.</li>
                <li><i class="fas fa-paint-brush"></i> <b>New Look:</b> Added doodles, coffee stains, and a credits section to the login page.</li>
            </ul>
        </div>
        <button onclick="showCongratsMessage(this.closest('.wimpy-modal-overlay'))" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 5px; padding: 10px;">SHEESH!</button>
    `;
    
    modal.appendChild(note);
    modal.onclick = (e) => { if(e.target === modal) modal.remove(); }
    document.body.appendChild(modal);
}

window.viewFullImage = function(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; cursor: zoom-out; animation: fadeIn 0.3s;';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:90%; max-height:90%; border: 5px solid #fff; box-shadow: 0 0 30px rgba(0,0,0,0.5); object-fit: contain;';
    overlay.appendChild(img);
    overlay.onclick = function() { overlay.remove(); };
    document.body.appendChild(overlay);
}

window.showCongratsMessage = function(prevModal) {
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

// --- ADMIN TOOL TOGGLE ---
window.showAdminTool = function(toolId, btnElement) {
    // 1. Reset all buttons
    document.querySelectorAll('.filter-bar .sketch-btn').forEach(b => b.classList.remove('active-tool'));

    // Hide all admin forms
    const forms = ['admin-schedule-form', 'admin-assignment-form', 'admin-event-form', 'admin-file-form', 'admin-email-form', 'admin-gallery-form', 'admin-storage-view'];
    let isAlreadyOpen = false;
    
    forms.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.id === toolId && el.style.display === 'block') isAlreadyOpen = true;
            el.style.display = 'none';
        }
    });

    const hint = document.getElementById('admin-tool-hint');
    
    // 2. Show selected if not already open (Toggle logic)
    if (toolId && !isAlreadyOpen) {
        const selected = document.getElementById(toolId);
        if (selected) selected.style.display = 'block';
        if (hint) hint.style.display = 'none';
        if (btnElement) btnElement.classList.add('active-tool');
    } else {
        // If closing or clicking active, show hint
        if (hint) hint.style.display = 'block';
    }
}

// --- STORAGE MONITOR ---
window.fetchStorageStats = async function() {
    const display = document.getElementById('storage-stats-display');
    if(!display) return;
    
    display.innerHTML = '<div class="loader">Scanning crates...</div>';
    
    const buckets = ['class-resources', 'avatars']; 
    let bucketHtml = '';
    let grandTotalBytes = 0;
    
    for (const bucket of buckets) {
        // Fetch list of files (limit 1000 to get a good count)
        const { data, error } = await db.storage.from(bucket).list('', { limit: 1000 });
        
        if (error) {
            bucketHtml += `<div class="class-card" style="border-left: 5px solid #d63031; margin-bottom: 10px;"><p>Error scanning <b>${bucket}</b>: ${error.message}</p></div>`;
            continue;
        }

        const count = data.length;
        let totalSize = 0;
        data.forEach(f => totalSize += (f.metadata ? f.metadata.size : 0));
        grandTotalBytes += totalSize;

        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        bucketHtml += `
            <div class="class-card" style="margin-bottom: 10px; border-left: 5px solid #6c5ce7;">
                <h3 style="margin-top:0;">Bucket: ${bucket}</h3>
                <div style="display:flex; justify-content:space-between; font-size:1.1rem;">
                    <span><b>Files:</b> ${count}</span>
                    <span><b>Size:</b> ${sizeMB} MB</span>
                </div>
            </div>
        `;
    }

    // Calculate Totals
    const totalMB = (grandTotalBytes / (1024 * 1024)).toFixed(2);
    const limitGB = 1; // 1GB Limit
    const limitBytes = limitGB * 1024 * 1024 * 1024;
    const percent = Math.min(100, ((grandTotalBytes / limitBytes) * 100)).toFixed(1);
    
    const summaryHtml = `
        <div class="class-card" style="margin-bottom: 20px; border: 2px solid #000; background: #fff740; transform: rotate(-1deg);">
            <h3 style="margin-top:0; text-align:center; border-bottom: 2px dashed #000; padding-bottom: 10px;">
                <i class="fas fa-chart-pie"></i> TOTAL CONSUMPTION
            </h3>
            <div style="text-align: center; margin: 15px 0;">
                <span style="font-size: 2.5rem; font-family: 'Permanent Marker'; line-height: 1;">${totalMB} MB</span>
                <span style="font-size: 1.2rem; color: #555;"> / ${limitGB} GB</span>
            </div>
            <div style="width: 100%; background: #fff; border: 2px solid #000; height: 25px; border-radius: 15px; overflow: hidden; position: relative;">
                <div style="width: ${percent}%; background: ${percent > 80 ? '#d63031' : '#00b894'}; height: 100%; transition: width 0.5s ease;"></div>
                <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.8rem; font-weight: bold; color: #000;">${percent}%</span>
            </div>
        </div>
    `;

    display.innerHTML = summaryHtml + bucketHtml;
}