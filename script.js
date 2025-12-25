// script.js (Self-Healing Admin Menu Version + Email Auto-Fix)

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

if (typeof window.supabase === 'undefined') console.error('Error: Supabase not loaded. Check internet.');
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const authForm = document.getElementById('authForm');
const formTitle = document.getElementById('formTitle');
const nameInput = document.getElementById('name');
const srCodeInput = document.getElementById('srCode');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleAuth = document.getElementById('toggleAuth');
const keepLoggedInContainer = document.getElementById('keepLoggedInContainer');

const authSection = document.getElementById('authSection');
const adminDashboard = document.getElementById('adminDashboard');
const studentDashboard = document.getElementById('studentDashboard');

// -- DYNAMIC ELEMENT REFERENCES --
let adminChoiceModal = document.getElementById('adminChoiceModal');

const adminNameDisplay = document.getElementById('adminNameDisplay');
const studentListContainer = document.getElementById('studentListContainer'); // Renamed from studentTableBody
const studentNameDisplay = document.getElementById('studentNameDisplay');
const authModeMessage = document.getElementById('authModeMessage');
const studentCodeDisplay = document.getElementById('studentCodeDisplay');
const toastContainer = document.getElementById('toast-container');
const publicMemberList = document.getElementById('publicMemberList');
const noteLayer = document.getElementById('note-layer');
const noteInput = document.getElementById('noteInput');
const searchInput = document.getElementById('searchInput');
let currentStudentId = null;
let avatarInput; 

let isLoginMode = true;
let allStudents = [];

// --- UTILITIES ---

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    if(type === 'error') {
        toast.style.background = '#ffadad';
        toast.style.border = '1px solid #d15656';
    }
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied: ' + text, 'success');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

// --- INITIAL LOAD ---
const initApp = () => {
    // 1. Force Inject Admin Modal if missing (Fixes GitHub Pages Sync Issues)
    injectAdminModal();

    // 2. Check Session
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    
    if (storedUser) {
        const user = JSON.parse(storedUser);
        
        // IF ADMIN: Show the choice menu
        if (user.sr_code === 'ADMIN') {
            authSection.classList.add('hidden');
            if(adminChoiceModal) adminChoiceModal.classList.remove('hidden');
            return;
        }

        // IF STUDENT: Go to web2
        window.location.href = 'web2.html';
        return; 
    }

    // Inject Avatar Input
    const avatarLabel = document.createElement('div');
    avatarLabel.innerText = "Upload Profile Picture (Optional):";
    avatarLabel.id = 'avatarLabel';
    avatarLabel.className = 'hidden';
    avatarLabel.style.marginTop = '10px';
    avatarLabel.style.textAlign = 'left';
    avatarLabel.style.fontSize = '0.9rem';

    avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.id = 'avatarInput';
    avatarInput.accept = 'image/*';
    avatarInput.className = 'hidden';
    if(nameInput && nameInput.parentNode) {
        nameInput.parentNode.insertBefore(avatarLabel, nameInput.nextSibling);
        nameInput.parentNode.insertBefore(avatarInput, avatarLabel.nextSibling);
    }

    fetchMembers();
    fetchNotes(); 
    fetchRecentLogins();
    fetchNewUploads(); // <--- ADD THIS LINE HERE
    if (authModeMessage) {
        authModeMessage.innerText = 'Enter your credentials to log in.';
    }
    showWelcomeNote();

    // --- PASSWORD TOGGLE ---
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle icon
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'; 
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

// --- SELF-HEALING MODAL INJECTOR ---
function injectAdminModal() {
    if (document.getElementById('adminChoiceModal')) {
        adminChoiceModal = document.getElementById('adminChoiceModal');
        return;
    }

    const modalHTML = `
        <div id="adminChoiceModal" class="sketch-box hidden" style="text-align: center;">
            <h2><i class="fas fa-user-lock"></i> ADMIN ACCESS GRANTED</h2>
            <p>"Where do you want to go, Boss?"</p>
            <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                <button onclick="chooseAdminPath('manage')" style="background: #2d3436; color: white;">
                    <i class="fas fa-clipboard-list"></i> MANAGE USERS (Black List)
                </button>
                <button onclick="chooseAdminPath('dashboard')" style="background: #d63031; color: white;">
                    <i class="fas fa-book"></i> GO TO BINDER (As Admin)
                </button>
            </div>
            <p style="font-size: 0.9rem; margin-top: 15px;">(As Admin in Binder, you can add classes & events)</p>
        </div>
    `;
    
    // Insert after authSection
    if(authSection) {
        authSection.insertAdjacentHTML('afterend', modalHTML);
        adminChoiceModal = document.getElementById('adminChoiceModal'); // Re-assign global
    }
}

// --- AUTH LOGIC ---

toggleAuth.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authForm.reset();
    
    if (authModeMessage) authModeMessage.innerText = isLoginMode ? 'Enter your credentials to log in.' : 'Fill out the form to create a new account.';
    if (isLoginMode) {
        submitBtn.innerText = 'ENTER →';
        nameInput.classList.add('hidden');
        nameInput.required = false;
        
        if(avatarInput) avatarInput.classList.add('hidden');
        const lbl = document.getElementById('avatarLabel');
        if(lbl) lbl.classList.add('hidden');

        if(keepLoggedInContainer) {
            keepLoggedInContainer.classList.remove('hidden');
            keepLoggedInContainer.style.display = 'flex'; 
        }
        toggleAuth.innerHTML = "Magpapalista? <b>Come here mga kosa click this</b>";
    } else {
        submitBtn.innerText = 'SIGN UP';
        nameInput.classList.remove('hidden');
        nameInput.required = true;

        if(avatarInput) avatarInput.classList.remove('hidden');
        const lbl = document.getElementById('avatarLabel');
        if(lbl) lbl.classList.remove('hidden');

        if(keepLoggedInContainer) {
            keepLoggedInContainer.classList.add('hidden');
            keepLoggedInContainer.style.display = 'none'; 
        }
        toggleAuth.innerHTML = "Already a member? <b>Login</b>";
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const srCode = srCodeInput.value.toUpperCase().trim(); // Added trim for safety
    const password = passwordInput.value;
    const name = nameInput.value.trim();
    const avatarFile = avatarInput ? avatarInput.files[0] : null;

    // --- VALIDATION ---
    if (!srCode) return showToast('SR Code is required', 'error');
    if (!password) return showToast('Password is required', 'error');

    if (!isLoginMode) {
        if (name.length < 2) return showToast('Please enter a valid name', 'error');
        if (password.length < 6) return showToast('Password must be at least 6 characters', 'error');
        if (avatarFile) {
            if (avatarFile.size > 2 * 1024 * 1024) return showToast('Image too large (Max 2MB)', 'error');
            if (!avatarFile.type.startsWith('image/')) return showToast('File must be an image', 'error');
        }
    }
    // ------------------

    submitBtn.innerText = 'Thinking...';
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            await handleLogin(srCode, password);
        } else {
            await handleRegister(name, srCode, password, avatarFile);
        }
    } catch (err) {
        if (err.message && err.message.includes('duplicate key')) {
            showToast('SR Code already registered!', 'error');
        } else {
            showToast(err.message, 'error');
        }
    } finally {
        submitBtn.innerText = isLoginMode ? 'ENTER →' : 'SIGN UP';
        submitBtn.disabled = false;
    }
});

async function handleRegister(name, srCode, password, file) {
    let avatarUrl = null;
    
    // --- AUTO-GENERATE EMAIL ---
    const generatedEmail = `${srCode}@g.batstate-u.edu.ph`;

    if (file) {
        const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, file);
        if (!uploadError) {
            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
        }
    }
    const { error } = await supabaseClient
        .from('students')
        .insert([{ 
            name: name, 
            sr_code: srCode, 
            password: password, 
            avatar_url: avatarUrl,
            email: generatedEmail // Added email here
        }]);
    if (error) throw error;
    showToast('Success! You are in.');
    fetchMembers(); 
    toggleAuth.click(); 
}

async function handleLogin(srCode, password) {
    const { data, error } = await supabaseClient
        .from('students')
        .select('*')
        .eq('sr_code', srCode)
        .single();

    if (error || !data) {
        showToast('Who are you? Name not found.', 'error');
        return;
    }

    if (password !== data.password) {
        showToast('Wrong password! Try again.', 'error');
        return;
    }

    // --- SELF-HEALING: FIX MISSING EMAIL ---
    if (data.sr_code !== 'ADMIN' && (!data.email || data.email === '')) {
        const autoEmail = `${data.sr_code}@g.batstate-u.edu.ph`;
        
        // Update Supabase silently
        await supabaseClient
            .from('students')
            .update({ email: autoEmail })
            .eq('id', data.id);
            
        // Update local data variable so the session has it too
        data.email = autoEmail;
        console.log("System auto-corrected missing email.");
    }
    // ----------------------------------------

    const userPayload = JSON.stringify({
        id: data.id,
        name: data.name,
        sr_code: data.sr_code,
        avatar_url: data.avatar_url,
        email: data.email
    });

    const keepLoggedIn = document.getElementById('keepLoggedIn').checked;
    if (keepLoggedIn) {
        localStorage.setItem('wimpy_user', userPayload);
    } else {
        sessionStorage.setItem('wimpy_user', userPayload);
    }

    await supabaseClient
        .from('students')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.id);

    // === ADMIN CHECK ===
    if (data.sr_code === 'ADMIN') {
        // Ensure modal exists before showing
        injectAdminModal();
        authSection.classList.add('hidden');
        if(adminChoiceModal) adminChoiceModal.classList.remove('hidden');
    } else {
        window.location.href = 'web2.html';
    }
}

// --- ADMIN CHOICE HANDLING ---
window.chooseAdminPath = function(path) {
    if(adminChoiceModal) adminChoiceModal.classList.add('hidden');
    
    if (path === 'manage') {
        showAdminPanel('Bitancutiepie (Admin)');
    } else if (path === 'dashboard') {
        window.location.href = 'web2.html';
    }
}

function showAdminPanel(name) {
    authSection.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    adminNameDisplay.innerText = name;
    fetchStudents(); 
    fetchRequests(); // Load requests when admin panel opens
}

// --- ADMIN FEATURES (Black List) ---

async function fetchStudents() {
    const { data, error } = await supabaseClient
        .from('students')
        .select('id, name, sr_code, password, avatar_url');
    if (error) return console.error(error);
    allStudents = data;
    displayStudents(allStudents);
}

searchInput.addEventListener('input', debounce((e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm) || 
        student.sr_code.toLowerCase().includes(searchTerm)
    );
    displayStudents(filtered);
}, 300));

function displayStudents(students) {
    if (!studentListContainer) return;
    
    studentListContainer.innerHTML = students
        .filter(s => s.sr_code !== 'ADMIN')
        .map(student => {
            const safeName = student.name.replace(/'/g, "\\'");
            const safeCode = student.sr_code.replace(/'/g, "\\'");
            const safeAvatar = (student.avatar_url || '').replace(/'/g, "\\'");
            const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;

            return `
                <div class="student-strip">
                    <div class="student-info">
                        <img src="${avatar}" class="student-avatar">
                        <div class="student-text">
                            <h4>${student.name}</h4>
                            <p onclick="copyToClipboard('${safeCode}')" style="cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Click to Copy Code">
                                <i class="fas fa-id-card"></i> ${student.sr_code}
                            </p>
                        </div>
                    </div>

                    <div class="student-creds">
                        <span>${student.password}</span>
                        <button class="btn-icon btn-copy" onclick="copyToClipboard('${student.password}')" title="Copy Password"><i class="fas fa-key"></i></button>
                    </div>

                    <div class="student-actions">
                        <button class="btn-icon btn-delete" onclick="deleteStudent('${student.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                        <button class="btn-icon" style="background:#2196F3; color:white; border-color:#0b7dda;" onclick="loginAsUser('${safeName}', '${safeCode}', '${safeAvatar}', '${student.id}')" title="Switch View to ${safeName}"><i class="fas fa-rocket"></i></button>
                    </div>
                </div>
            `;
        }).join('');
}

async function deleteStudent(id) {
    if(!await showWimpyConfirm('Scratch this person out specifically?')) return;
    const { error } = await supabaseClient.from('students').delete().eq('id', id);
    if (error) showToast('Could not delete.', 'error');
    else {
        showToast('Scratched out successfully.');
        fetchStudents();
        fetchMembers(); 
    }
}

// IMPERSONATION LOGIC
async function loginAsUser(name, code, avatarUrl, id) {
    if(!await showWimpyConfirm('Switch view to ' + name + '?')) return;
    const targetUserPayload = JSON.stringify({
        id: id,
        name: name,
        sr_code: code,
        avatar_url: avatarUrl
    });
    localStorage.removeItem('wimpy_user');
    sessionStorage.setItem('wimpy_user', targetUserPayload);
    showToast('Switching to ' + name + '...');
    setTimeout(() => {
        window.location.href = 'web2.html';
    }, 500);
}

// --- PORTAL POP-UP LOGIC ---
function openPortalWindow() {
    const width = Math.min(1000, window.screen.width);
    const height = Math.min(800, window.screen.height);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
        "https://dione.batstate-u.edu.ph/student/#/", 
        "BatStatePortal", 
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );
}

// --- OTHER FEATURES ---
async function fetchMembers() {
    // 1. Fetch Students
    const { data: students, error } = await supabaseClient.from('students').select('id, name, avatar_url');
    if (error) return;

    // 2. Fetch Statuses
    const { data: statuses } = await supabaseClient.from('user_statuses').select('user_id, status');
    
    // Create a lookup map for statuses
    const statusMap = {};
    if (statuses) statuses.forEach(s => statusMap[s.user_id] = s.status);

    publicMemberList.innerHTML = '';
    if (students.length === 0) {
        publicMemberList.innerHTML = '<span style="font-style:italic">No members yet...</span>';
        return;
    }
    students.forEach(student => {
        if(student.name === 'Principal User' || student.name.includes('Admin')) return;
        
        const userStatus = statusMap[student.id] || 'Member';

        const tag = document.createElement('div');
        tag.className = 'member-tag';
        // Use flex row layout for the card content
        tag.style.cssText = 'cursor: pointer; display: flex; align-items: center; gap: 10px; overflow: hidden;';
        tag.onclick = () => showPublicProfile(student.name, student.avatar_url, userStatus);
        
        const safeAvatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
        
        tag.innerHTML = `
            <img src="${safeAvatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #333; flex-shrink: 0;">
            <span style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${student.name}</span>
        `;
        publicMemberList.appendChild(tag);
    });
}

function showPublicProfile(name, avatarUrl, status) {
    let modal = document.getElementById('publicProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'publicProfileModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:3000; display:flex; justify-content:center; align-items:center;';
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
        document.body.appendChild(modal);
    }
    const safeAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    modal.innerHTML = `
        <div class="sketch-box" style="width:90%; max-width:300px; margin:0; text-align:center; animation: slideUp 0.3s ease-out;">
            <h2 style="margin-bottom:15px;">${name}</h2>
            <div style="padding:10px; border:2px dashed #ccc; display:inline-block; border-radius:50%;">
                <img src="${safeAvatar}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:2px solid #000;">
            </div>
            <p style="margin-top:15px; font-style:italic;">"${status || 'Member'}"</p>
            <button onclick="document.getElementById('publicProfileModal').style.display='none'">CLOSE</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function fetchRecentLogins() {
    const container = document.getElementById('recentLoginsList');
    if(!container) return;
    const { data, error } = await supabaseClient.from('students').select('name, avatar_url, last_login').neq('sr_code', 'ADMIN').not('last_login', 'is', null).order('last_login', { ascending: false }).limit(5);
    if (error) return;
    if (!data || data.length === 0) return;
    container.innerHTML = '';
    data.forEach(student => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; width:100%; max-width:350px; justify-content:space-between; border-bottom:1px dashed #ccc; padding:5px 0;';
        const safeAvatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <img src="${safeAvatar}" style="width:25px; height:25px; border-radius:50%; object-fit:cover; border:1px solid #333;">
                <span>${student.name}</span>
            </div>
            <small style="color:#666; font-family:sans-serif; font-size:0.8rem;">${timeAgo(student.last_login)}</small>
        `;
        container.appendChild(row);
    });
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
}

// --- DRAGGABLE NOTES ---
async function postNote() {
    const text = noteInput.value.trim();
    if (!text) return showToast('Please write something!', 'error');
    let randomX;
    if (window.innerWidth < 600) randomX = Math.floor(Math.random() * 80) + 5; 
    else if (Math.random() > 0.5) randomX = Math.floor(Math.random() * 20) + 2; 
    else randomX = Math.floor(Math.random() * 20) + 75; 
    const randomY = Math.floor(Math.random() * 90) + 5; 
    const rotation = Math.floor(Math.random() * 20) - 10;
    const colors = ['#fff740', '#ff7eb9', '#7afcff', '#98ff98'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const { error } = await supabaseClient.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: randomColor }]);
    if (error) showToast('Failed to stick note.', 'error');
    else { showToast('Note posted!'); noteInput.value = ''; fetchNotes(); }
}
async function fetchNotes() {
    const { data, error } = await supabaseClient.from('notes').select('*');
    if (error) return;
    noteLayer.innerHTML = '';
    data.forEach(note => {
        const div = document.createElement('div');
        div.className = 'sticky-note';
        div.innerText = note.content;
        div.id = `note-${note.id}`;
        div.style.left = note.x_pos + '%';
        div.style.top = note.y_pos + '%';
        div.style.transform = `rotate(${note.rotation}deg)`;
        div.style.backgroundColor = note.color;
        makeDraggable(div, note.id);
        noteLayer.appendChild(div);
    });
}
function makeDraggable(element, noteId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;
    element.ontouchstart = dragMouseDown;
    function dragMouseDown(e) { e = e || window.event; if (e.type !== 'touchstart') e.preventDefault(); pos3 = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX; pos4 = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; document.ontouchend = closeDragElement; document.ontouchmove = elementDrag; }
    function elementDrag(e) { e = e || window.event; let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX; let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY; pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY; element.style.top = (element.offsetTop - pos2) + "px"; element.style.left = (element.offsetLeft - pos1) + "px"; }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; document.ontouchend = null; document.ontouchmove = null; const xPercent = (element.offsetLeft / window.innerWidth) * 100; const yPercent = (element.offsetTop / window.innerHeight) * 100; updateNotePosition(noteId, xPercent, yPercent); }
}
async function updateNotePosition(id, x, y) {
    x = Math.max(0, Math.min(x, 95));
    y = Math.max(0, Math.min(y, 95));
    await supabaseClient.from('notes').update({ x_pos: x, y_pos: y }).eq('id', id);
}

// LOGOUT
async function logout() {
    if (!await showWimpyConfirm("Pack up and leave?")) return;
    currentStudentId = null;
    localStorage.removeItem('wimpy_user');
    sessionStorage.removeItem('wimpy_user');
    authSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    if(adminChoiceModal) adminChoiceModal.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    searchInput.value = '';
    fetchMembers(); fetchNotes(); fetchRecentLogins();
}

// Function to return to the admin choice modal from the admin dashboard
function returnToAdminChoice() {
    adminDashboard.classList.add('hidden');
    if(adminChoiceModal) adminChoiceModal.classList.remove('hidden');
}

function showWelcomeNote() {
    // Check removed so it shows every time
    // if (localStorage.getItem('wimpy_update_seen_v2')) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:flex-start; overflow-y: auto; padding: 20px; box-sizing: border-box;';
    const note = document.createElement('div');
    note.className = 'sketch-box';
    note.style.cssText = 'width:100%; max-width:600px; margin: 40px auto; text-align:center; transform:rotate(-1deg); background:#fdfbf7; border:3px solid #000; padding:20px; box-shadow:10px 10px 0 rgba(0,0,0,0.2); position:relative;';
    note.innerHTML = `
        <style>
            .update-flex {
                display: flex;
                gap: 20px;
                justify-content: center;
                align-items: center;
                margin: 25px 0 15px 0;
                flex-wrap: wrap;
            }
            .update-arrow {
                font-size: 2rem;
                font-weight: bold;
                transition: transform 0.3s;
            }
            .update-img-container {
                flex: 1;
                min-width: 200px;
                position: relative;
                cursor: zoom-in;
            }
            @media (max-width: 600px) {
                .update-flex {
                    flex-direction: column;
                    gap: 30px;
                }
                .update-arrow {
                    transform: rotate(90deg);
                }
                .update-img-container {
                    width: 100%;
                    min-width: unset;
                }
            }
        </style>
        <h2 style="margin-top:0; text-decoration: underline wavy #000;"><i class="fas fa-star"></i> SYSTEM UPDATE</h2>
        <p style="font-size:1.1rem; margin: 10px 0;">"Look at the upgrade guys! (Click pics to zoom)"</p>
        <div class="update-flex">
            <div class="update-img-container" onclick="viewFullImage('Beforeimg.png')">
                <div style="font-weight: bold; background: #bdc3c7; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(-3deg); border: 2px solid #000; position: absolute; top: -12px; left: -5px; z-index: 2; font-size: 0.8rem;">BEFORE:</div>
                <img src="Beforeimg.png" alt="Old Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
            </div>
            <div class="update-arrow">→</div>
            <div class="update-img-container" onclick="viewFullImage('Afterimg.png')">
                <div style="font-weight: bold; background: #ffee58; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(3deg); border: 2px solid #000; position: absolute; top: -12px; right: -5px; z-index: 2; font-size: 0.8rem;">NOW:</div>
                <img src="Afterimg.png" alt="New Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
            </div>
        </div>
        <div style="text-align: left; background: #f9f9f9; border: 2px dashed #bbb; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <p style="font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;"><i class="fas fa-edit"></i> New Features Added:</p>
            <ul style="padding-left: 20px; margin: 0; list-style-type: none; font-size: 1rem;">
                <li><i class="fas fa-check-circle"></i> <b>Live Tracker:</b> See exactly which class is happening right now.</li>
                <li><i class="fas fa-check-circle"></i> <b>Subject Cabinet:</b> Organized folders for reviewers & PDFs.</li>
                <li><i class="fas fa-check-circle"></i> <b>Custom Avatars:</b> Upload your own profile picture.</li>
                <li><i class="fas fa-check-circle"></i> <b>Binder UI:</b> New "notebook" design for better vibes.</li>
                <li><i class="fas fa-check-circle"></i> <b>Auto-Schedule:</b> Classes automatically update daily.</li>
                <li><i class="fas fa-check-circle"></i> <b>File Previewer:</b> Click to preview files directly in the browser.</li>
                <li><i class="fas fa-check-circle"></i> <b>Secret Request Box:</b> Send anonymous requests/suggestions to the admin.</li>
                <li><i class="fas fa-check-circle"></i> <b>Recent Uploads:</b> See the latest shared files directly on the login page.</li>
            </ul>
        </div>
        <p style="font-size:1.3rem; margin: 15px 0; color: #d32f2f; font-weight: bold;">"Login na kayo para makita niyo!"</p>
        <button onclick="this.parentElement.parentElement.remove()" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 5px; padding: 10px;">SHEESH!</button>
    `;
    modal.appendChild(note);
    document.body.appendChild(modal);
}
// Click to Zoom
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

// --- NEW FEATURE: CHECK RECENT UPLOADS ---
async function fetchNewUploads() {
    const container = document.getElementById('newUpdatesSection');
    const list = document.getElementById('newUpdatesList');
    
    // Safety check: if elements don't exist, stop (prevents errors)
    if (!container || !list) return;

    // Calculate date 3 days ago
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 3); 

    // Use 'supabaseClient' (which is defined in script.js)
    const { data, error } = await supabaseClient
        .from('shared_files')
        .select('title, subject, created_at, file_url')
        .gte('created_at', dateLimit.toISOString())
        .order('created_at', { ascending: false })
        .limit(3); // Only show top 3

    if (error) {
        console.error("Error fetching updates:", error);
        return;
    }

    // Only show the section if we actually have data
    if (data && data.length > 0) {
        container.classList.remove('hidden'); // Show the container
        
        list.innerHTML = data.map(file => window.generateFileCard(file, true)).join('');
    } else {
        container.classList.add('hidden'); // Keep hidden if empty
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
                <button id="wimpy-no" style="flex:1; background:#fff; color:#000;">NAH</button>
                <button id="wimpy-yes" style="flex:1; background:#000; color:#fff;">YEAH</button>
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

// --- WIDE MODE TOGGLE ---
function toggleWideMode() {
    const boxes = document.querySelectorAll('.sketch-box');
    boxes.forEach(box => {
        box.classList.toggle('wide-mode');
    });
}

// --- ADMIN REQUESTS LOGIC ---
async function fetchRequests() {
    const container = document.getElementById('adminRequestsList');
    if(!container) return;
    
    container.innerHTML = '<p>Checking suggestion box...</p>';
    
    const { data, error } = await supabaseClient
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });
        
    if(error) return console.error(error);
    
    if(!data || data.length === 0) {
        container.innerHTML = '<h3 style="text-align:center; color:#666;">No new requests.</h3>';
        return;
    }
    
    container.innerHTML = '<h3 style="text-decoration:underline wavy #d63031;"><i class="fas fa-envelope-open-text"></i> Inbox / Requests</h3>' + data.map(req => `
        <div class="student-strip" style="flex-direction:column; align-items:flex-start; gap:5px; background:#fffde7;">
            <div style="width:100%; display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px;">
                <strong><i class="fas fa-user"></i> ${req.sender || 'Anonymous'}</strong>
                <small>${new Date(req.created_at).toLocaleDateString()} ${new Date(req.created_at).toLocaleTimeString()}</small>
            </div>
            <p style="margin:10px 0; font-family:'Patrick Hand'; font-size:1.2rem; white-space: pre-wrap;">${req.content}</p>
            <button onclick="deleteRequest(${req.id})" class="btn-icon btn-delete" style="align-self:flex-end; font-size:0.9rem;"><i class="fas fa-trash"></i> Dismiss</button>
        </div>
    `).join('');
}

window.deleteRequest = async function(id) {
    if(!await showWimpyConfirm('Burn this note?')) return;
    await supabaseClient.from('requests').delete().eq('id', id);
    fetchRequests();
}

// --- FILE PREVIEWER MODAL ---
window.openFilePreview = function(url, title) {
    if (!url) return showToast('No file link available.', 'error');

    // Remove existing modal if any
    const existing = document.getElementById('filePreviewModal');
    if (existing) existing.remove();

    const isPdf = url.toLowerCase().includes('.pdf');
    const isImg = url.match(/\.(jpeg|jpg|gif|png|webp)$/i);

    const loaderHtml = `
        <div id="previewLoader" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#555;">
            <i class="fas fa-spinner fa-spin" style="font-size:3rem;"></i>
            <p style="font-family:'Patrick Hand'; font-size:1.5rem; margin-top:10px;">Unfolding paper...</p>
        </div>
    `;

    let contentHtml = '';
    if (isPdf) {
        contentHtml = `${loaderHtml}<iframe src="${url}" style="width:100%; height:100%; border:none; display:none;" onload="this.style.display='block'; document.getElementById('previewLoader').style.display='none';" title="${title}"></iframe>`;
    } else if (isImg) {
        contentHtml = `${loaderHtml}<div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
            <img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain; display:none;" onload="this.style.display='block'; document.getElementById('previewLoader').style.display='none';">
        </div>`;
    } else {
        contentHtml = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center;">
                <i class="fas fa-file-download" style="font-size:4rem; margin-bottom:20px;"></i>
                <p>Preview not available for this file type.</p>
                <a href="${url}" target="_blank" download class="preview-modal-btn" style="background:#000; color:#fff; padding:10px 20px; text-decoration:none; border: 2px solid #000; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; font-family: 'Patrick Hand';">Download File</a>
            </div>
        `;
    }

    const modalHtml = `
        <style>
            .preview-modal-btn { transition: all 0.2s !important; cursor: pointer !important; }
            .preview-modal-btn:hover { 
                transform: rotate(-3deg) scale(1.1) !important; 
                animation: previewWiggle 0.4s ease-in-out infinite !important;
            }
            @keyframes previewWiggle {
                0% { transform: rotate(0deg); }
                25% { transform: rotate(-3deg); }
                50% { transform: rotate(3deg); }
                75% { transform: rotate(-1deg); }
                100% { transform: rotate(0deg); }
            }
        </style>
        <div id="filePreviewModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;">
            <div class="sketch-box" style="width:90%; max-width:900px; height:85%; display:flex; flex-direction:column; padding:15px; background:#fff; position:relative; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px dashed #000; padding-bottom:10px; margin-bottom:10px;">
                    <h3 style="margin:0; font-size:1.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%;"><i class="fas fa-eye"></i> ${title}</h3>
                    <div style="display:flex; gap:5px;">
                        <a href="${url}" target="_blank" download style="text-decoration:none;">
                            <button class="preview-modal-btn" style="width:auto; margin:0; padding:5px 15px; font-size:1rem; background:#0984e3; color:#fff; border: 2px solid #000; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; font-family: 'Patrick Hand';" title="Download"><i class="fas fa-download"></i></button>
                        </a>
                        <button class="preview-modal-btn" onclick="document.getElementById('filePreviewModal').remove()" style="width:auto; margin:0; padding:5px 15px; font-size:1rem; background:#d63031; color:#fff; border: 2px solid #000; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; font-family: 'Patrick Hand';">CLOSE</button>
                    </div>
                </div>
                <div style="flex:1; overflow:hidden; background:#fff; border:none; position:relative;">
                    ${contentHtml}
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- REUSABLE FILE CARD GENERATOR (For Web2.html) ---
window.generateFileCard = function(file, isNew = false) {
    const safeUrl = (file.file_url || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const safeTitle = (file.title || 'File').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const subject = file.subject || 'General';
    const badgeHtml = isNew ? `<div style="font-size: 0.8rem; background: #d63031; color: white; padding: 2px 6px; border-radius: 4px; transform: rotate(5deg);">NEW!</div>` : '';

    return `
        <div style="width: 95%; background: #fff; border: 2px solid #000; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; padding: 10px; display: flex; align-items: center; gap: 10px; box-shadow: 3px 3px 0 rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer;" 
             onclick="openFilePreview('${safeUrl}', '${safeTitle}')"
             onmouseover="this.style.transform='scale(1.02) rotate(-1deg)'" 
             onmouseout="this.style.transform='scale(1) rotate(0deg)'">
            <div style="font-size: 1.5rem; color: #000;"><i class="fas fa-file-alt"></i></div>
            <div style="text-align: left; flex: 1;">
                <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: bold; color: #666;">${subject}</div>
                <div style="font-size: 1.1rem; line-height: 1.1; font-weight: bold;">${safeTitle}</div>
                <div style="font-size: 0.8rem; color: #2980b9; margin-top: 2px;"><i class="fas fa-eye"></i> Click to Preview</div>
            </div>
            ${badgeHtml}
        </div>
    `;
}