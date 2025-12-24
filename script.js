// script.js (Admin Choice Menu Added)

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

if (typeof window.supabase === 'undefined') alert('Error: Supabase not loaded. Check internet.');
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
const adminChoiceModal = document.getElementById('adminChoiceModal'); // NEW

const adminNameDisplay = document.getElementById('adminNameDisplay');
const studentTableBody = document.getElementById('studentTableBody');
const studentNameDisplay = document.getElementById('studentNameDisplay');
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

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied: ' + text, 'success');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

// --- INITIAL LOAD ---
document.addEventListener("DOMContentLoaded", () => {
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    
    if (storedUser) {
        const user = JSON.parse(storedUser);
        
        // IF ADMIN: Show the choice menu again
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
    showWelcomeNote();
});

// --- AUTH LOGIC ---

toggleAuth.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authForm.reset();
    
    if (isLoginMode) {
        // LOGIN
        formTitle.innerText = 'Ako na ang Bahala';
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
        // REGISTER
        formTitle.innerText = 'Palista na';
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
    const srCode = srCodeInput.value.toUpperCase();
    const password = passwordInput.value;
    const name = nameInput.value;
    const avatarFile = avatarInput ? avatarInput.files[0] : null;

    submitBtn.innerText = 'Thinking...';
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            await handleLogin(srCode, password);
        } else {
            await handleRegister(name, srCode, password, avatarFile);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.innerText = isLoginMode ? 'ENTER →' : 'SIGN UP';
        submitBtn.disabled = false;
    }
});

async function handleRegister(name, srCode, password, file) {
    let avatarUrl = null;
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
        .insert([{ name: name, sr_code: srCode, password: password, avatar_url: avatarUrl }]);

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

    const userPayload = JSON.stringify({
        id: data.id,
        name: data.name,
        sr_code: data.sr_code,
        avatar_url: data.avatar_url
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

    // === NEW ADMIN LOGIC ===
    if (data.sr_code === 'ADMIN') {
        // HIDE LOGIN, SHOW CHOICE MODAL
        authSection.classList.add('hidden');
        if(adminChoiceModal) adminChoiceModal.classList.remove('hidden');
    } else {
        window.location.href = 'web2.html';
    }
}

// --- NEW FUNCTION: Handle Admin Choice ---
function chooseAdminPath(path) {
    if(adminChoiceModal) adminChoiceModal.classList.add('hidden');
    
    if (path === 'manage') {
        // Show the Black List / User Management
        showAdminPanel('Greg (Admin)');
    } else if (path === 'dashboard') {
        // Go to Web2.html AS ADMIN (Enables editing)
        window.location.href = 'web2.html';
    }
}

function showAdminPanel(name) {
    authSection.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    adminNameDisplay.innerText = name;
    fetchStudents(); 
}

function showStudentPanel(name, code, avatarUrl, id) {
    currentStudentId = id;
    authSection.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.remove('hidden');
    studentNameDisplay.innerText = name;
    studentCodeDisplay.innerText = code;
    setupAvatarUpdate(name, avatarUrl);
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

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm) || 
        student.sr_code.toLowerCase().includes(searchTerm)
    );
    displayStudents(filtered);
});

function displayStudents(students) {
    studentTableBody.innerHTML = students
        .filter(s => s.sr_code !== 'ADMIN')
        .map(student => {
            const safeName = student.name.replace(/'/g, "\\'");
            const safeCode = student.sr_code.replace(/'/g, "\\'");
            const safeAvatar = (student.avatar_url || '').replace(/'/g, "\\'");
            const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;

            return `
                <tr>
                    <td>
                        <div class="flex-cell">
                            <img src="${avatar}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #333;">
                            <span style="font-weight:bold;">${student.name}</span>
                        </div>
                    </td>
                    <td>
                        <div class="flex-cell">
                            <span style="font-family:monospace; font-size:1.1rem;">${student.sr_code}</span>
                            <button class="btn-icon btn-copy" onclick="copyToClipboard('${safeCode}')" title="Copy Code">📋</button>
                        </div>
                    </td>
                    <td>
                        <div class="flex-cell">
                            <span style="font-family:monospace; font-size:1.1rem;">${student.password}</span>
                            <button class="btn-icon btn-copy" onclick="copyToClipboard('${student.password}')" title="Copy Password">🔑</button>
                        </div>
                    </td>
                    <td>
                        <div class="flex-cell">
                            <button class="btn-icon btn-delete" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
                            <button class="btn-icon" style="background:#2196F3; color:white; border-color:#0b7dda;" onclick="loginAsUser('${safeName}', '${safeCode}', '${safeAvatar}', '${student.id}')" title="Switch View to ${safeName}">🚀</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
}

async function deleteStudent(id) {
    if(!confirm('Scratch this person out specifically?')) return;
    const { error } = await supabaseClient.from('students').delete().eq('id', id);
    if (error) showToast('Could not delete.', 'error');
    else {
        showToast('Scratched out successfully.');
        fetchStudents();
        fetchMembers(); 
    }
}

// IMPERSONATION LOGIC (Rocket Button)
function loginAsUser(name, code, avatarUrl, id) {
    if(!confirm('Switch view to ' + name + '?')) return;
    
    // Create payload for the TARGET user
    const targetUserPayload = JSON.stringify({
        id: id,
        name: name,
        sr_code: code,
        avatar_url: avatarUrl
    });

    // Clear Admin session
    localStorage.removeItem('wimpy_user');
    
    // Set Student session
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

// --- PUBLIC LIST ---
async function fetchMembers() {
    const { data, error } = await supabaseClient
        .from('students')
        .select('name, avatar_url');

    if (error) return;

    publicMemberList.innerHTML = '';
    if (data.length === 0) {
        publicMemberList.innerHTML = '<span style="font-style:italic">No members yet...</span>';
        return;
    }

    data.forEach(student => {
        if(student.name === 'Principal User' || student.name.includes('Admin')) return;
        const tag = document.createElement('div');
        tag.className = 'member-tag';
        tag.style.display = 'inline-flex';
        tag.style.alignItems = 'center';
        tag.style.gap = '5px';
        tag.style.cursor = 'pointer';
        tag.onclick = () => showPublicProfile(student.name, student.avatar_url);
        
        const img = document.createElement('img');
        img.src = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
        img.style.width = '20px';
        img.style.height = '20px';
        img.style.borderRadius = '50%';
        tag.appendChild(img);
        tag.appendChild(document.createTextNode(student.name));
        publicMemberList.appendChild(tag);
    });
}

function showPublicProfile(name, avatarUrl) {
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
            <p style="margin-top:15px; font-style:italic;">"Certified Member"</p>
            <button onclick="document.getElementById('publicProfileModal').style.display='none'">CLOSE</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function fetchRecentLogins() {
    const container = document.getElementById('recentLoginsList');
    if(!container) return;

    const { data, error } = await supabaseClient
        .from('students')
        .select('name, avatar_url, last_login')
        .neq('sr_code', 'ADMIN')
        .not('last_login', 'is', null)
        .order('last_login', { ascending: false })
        .limit(5);

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

// --- DRAGGABLE STICKY NOTES ---
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

    const { error } = await supabaseClient
        .from('notes')
        .insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: randomColor }]);

    if (error) showToast('Failed to stick note.', 'error');
    else {
        showToast('Note posted!');
        noteInput.value = '';
        fetchNotes();
    }
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

    function dragMouseDown(e) {
        e = e || window.event;
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
        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        const xPercent = (element.offsetLeft / window.innerWidth) * 100;
        const yPercent = (element.offsetTop / window.innerHeight) * 100;
        updateNotePosition(noteId, xPercent, yPercent);
    }
}

async function updateNotePosition(id, x, y) {
    x = Math.max(0, Math.min(x, 95));
    y = Math.max(0, Math.min(y, 95));
    await supabaseClient.from('notes').update({ x_pos: x, y_pos: y }).eq('id', id);
}

// LOGOUT
function logout() {
    currentStudentId = null;
    localStorage.removeItem('wimpy_user');
    sessionStorage.removeItem('wimpy_user');
    
    // Reset UI
    authSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    if(adminChoiceModal) adminChoiceModal.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    searchInput.value = '';
    
    fetchMembers(); 
    fetchNotes();
    fetchRecentLogins();
}

function setupAvatarUpdate(name, avatarUrl) {
    const avatarImg = document.getElementById('userAvatarDisplay');
    if (!avatarImg) return;
    avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
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

function showWelcomeNote() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; justify-content:center; align-items:center; overflow-y: auto; padding: 20px;';
    const note = document.createElement('div');
    note.className = 'sketch-box';
    note.style.width = '100%';
    note.style.maxWidth = '550px';
    note.style.margin = 'auto'; 
    note.style.textAlign = 'center';
    note.style.transform = 'rotate(-1deg)';
    note.innerHTML = `
        <h2 style="margin-top:0; text-decoration: underline wavy #000;">✨ SYSTEM UPDATE</h2>
        <p style="font-size:1.1rem; margin: 10px 0;">"Look at the upgrade guys! (Click pics to zoom)"</p>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: center; margin: 25px 0 15px 0; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 180px; position: relative; cursor: zoom-in;" onclick="viewFullImage('Beforeimg.png')">
                <div style="font-weight: bold; background: #bdc3c7; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(-3deg); border: 2px solid #000; position: absolute; top: -12px; left: -5px; z-index: 2;">BEFORE:</div>
                <img src="Beforeimg.png" alt="Old Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
            </div>
            <div style="font-size: 2rem; font-weight: bold;">→</div>
            <div style="flex: 1; min-width: 180px; position: relative; cursor: zoom-in;" onclick="viewFullImage('Afterimg.png')">
                <div style="font-weight: bold; background: #ffee58; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(3deg); border: 2px solid #000; position: absolute; top: -12px; right: -5px; z-index: 2;">NOW:</div>
                <img src="Afterimg.png" alt="New Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
            </div>
        </div>
        <div style="text-align: left; background: #f9f9f9; border: 2px dashed #bbb; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <p style="font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;">📝 New Features Added:</p>
            <ul style="padding-left: 20px; margin: 0; list-style-type: '✅ '; font-size: 1rem;">
                <li><b>Live Tracker:</b> See exactly which class is happening right now.</li>
                <li><b>Subject Cabinet:</b> Organized folders for reviewers & PDFs.</li>
                <li><b>Custom Avatars:</b> Upload your own profile picture.</li>
                <li><b>Binder UI:</b> New "notebook" design for better vibes.</li>
                <li><b>Auto-Schedule:</b> Classes automatically update daily.</li>
            </ul>
        </div>
        <p style="font-size:1.3rem; margin: 15px 0; color: #d32f2f; font-weight: bold;">"Login na kayo para makita niyo!"</p>
        <button onclick="this.parentElement.parentElement.remove()" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 5px; padding: 10px;">SHEESH!</button>
    `;
    modal.appendChild(note);
    document.body.appendChild(modal);
}