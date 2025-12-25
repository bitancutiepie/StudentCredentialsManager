// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

// FIX: We use 'db' instead of 'supabase' to avoid conflict with the library name
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let user = null;
let isAdmin = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard loaded...");
    checkSession();
    startClock();
    
    // Default load
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    await loadSchedule(day);
    await loadAssignments();
    await loadEvents();
    await loadFiles();

    // ADD THIS LINE HERE:
    await initLiveClassChecker();
    await populateSubjectOptions(); // <--- Updates buttons based on your actual schedule
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
        document.querySelectorAll('.admin-controls').forEach(el => el.style.display = 'block');
    }
}

// FIX: Explicitly attach logout to window
window.logout = function() {
    localStorage.removeItem('wimpy_user');
    // Clear BOTH to be safe
    sessionStorage.removeItem('wimpy_user');
    window.location.href = 'index.html';
}

// --- TABS LOGIC ---
window.switchTab = function(tabId, event) {
    const targetBtn = event ? event.currentTarget : document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.remove('hidden');

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

    list.innerHTML = data.map(cls => {
        const start = cls.start_time.substring(0, 5); 
        const end = cls.end_time.substring(0, 5);
        const deleteBtn = isAdmin ? `<button onclick="deleteClass(${cls.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';

        return `
            <div class="class-card">
                ${deleteBtn}
                <div class="class-header">
                    <span class="subject-code">${cls.subject_code}</span>
                    <span class="time-badge">${start} - ${end}</span>
                </div>
                <h3>${cls.subject_name}</h3>
                <p><b>Prof:</b> ${cls.instructor || 'TBA'} | <b>Room:</b> ${cls.room || 'TBA'}</p>
                <div style="margin-top:10px;">
                    ${cls.meet_link ? `<a href="${cls.meet_link}" target="_blank" class="sketch-btn meet"><i class="fas fa-video"></i> Meet</a>` : ''}
                    ${cls.classroom_link ? `<a href="${cls.classroom_link}" target="_blank" class="sketch-btn classroom"><i class="fas fa-chalkboard"></i> Class</a>` : ''}
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

    list.innerHTML = data.map(task => {
        const date = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date';
        const deleteBtn = isAdmin ? `<button onclick="deleteAssignment(${task.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';
        
        return `
            <div class="class-card" style="border-left: 5px solid #d32f2f;">
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
    const list = document.getElementById('events-list');
    if (!list) return;

    const data = await fetchData('events', 'event_date');
    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center;">Calendar is empty.</p>';
        return;
    }

    list.innerHTML = data.map(evt => {
        const deleteBtn = isAdmin ? `<button onclick="deleteEvent(${evt.id})" class="sketch-btn danger" style="float:right;">X</button>` : '';
        return `
            <div class="class-card" style="border-left: 5px solid #1976d2;">
                ${deleteBtn}
                <h3>${evt.title}</h3>
                <p>${new Date(evt.event_date).toDateString()}</p>
                <p>${evt.description || ''}</p>
            </div>
        `;
    }).join('');
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
    if(!confirm('Delete this class?')) return;
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
    if(!confirm('Delete task?')) return;
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
    if(!confirm('Delete event?')) return;
    await db.from('events').delete().eq('id', id);
    loadEvents();
}

// --- CLOCK ---
function startClock() {
    setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('live-clock');
        if (clockEl) {
            clockEl.innerText = now.toLocaleTimeString('en-US', {hour12:false});
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
    let query = db.from('shared_files').select('*').order('created_at', { ascending: false });

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

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; width:100%;">No files found in this folder.</p>';
        return;
    }

    list.innerHTML = data.map(file => {
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
            <div class="class-card" style="text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:space-between;">
                ${deleteBtn}
                <div style="width:100%;">
                    <div style="font-size: 2.5rem; color: #57606f; margin-top:10px;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; margin: 10px 0; word-break: break-word;">${file.title}</h3>
                    ${subjectTag}
                </div>
                <a href="${file.file_url}" target="_blank" class="sketch-btn" style="width:80%; justify-content:center; margin-top:10px;">
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
    if(!confirm('Delete this file?')) return;
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

    // 🔴 REPLACE THIS WITH YOUR SERVICE ID FROM EMAILJS DASHBOARD
    const SERVICE_ID = 'service_crvq85j'; 
    const TEMPLATE_ID = 'template_jhu61sc'; // Your Template ID

    // Security Check
    if (!isAdmin) return showToast("Admins only!");

    const subjectInput = document.getElementById('email-subject');
    const bodyInput = document.getElementById('email-body');
    const btn = e.target.querySelector('button');

    // UI Loading State
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = "Gathering emails...";

    try {
        // 1. Get Emails from Supabase
        const { data, error } = await db
            .from('students')
            .select('email')
            .neq('sr_code', 'ADMIN')     // Don't email the Admin account
            .not('email', 'is', null)    // Ignore empty emails
            .neq('email', '');           // Ignore blank strings

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("No student emails found in database!");
        }

        // 2. Prepare the list (Comma separated for BCC)
        // This makes it count as 1 email request instead of 50!
        const emailList = data.map(s => s.email).join(',');

        btn.innerText = "Sending...";

        // 3. Send via EmailJS
        const templateParams = {
            subject: subjectInput.value,
            message: bodyInput.value,
            bcc: emailList,       // This hides students from each other
            from_name: user.name  // Shows "Admin Greg" (or whoever is logged in)
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);

        showToast("Success! Announcement sent.");
        e.target.reset();

    } catch (err) {
        console.error("Email Error:", err);
        showToast(err.message || "Failed to send email.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}