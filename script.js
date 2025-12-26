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
const noteLayer = document.getElementById('freedom-wall-board');
const noteInput = document.getElementById('noteInput');
const searchInput = document.getElementById('searchInput');
let currentStudentId = null;
let avatarInput; 

let galleryItems = []; // Store gallery images for lightbox navigation
let galleryInterval;
let galleryAnimationFrame;
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
        if (user.sr_code === 'ADMIN' || user.role === 'admin') {
            // Switch to Admin Mode on Landing Page
            const loginUI = document.getElementById('loginUI');
            const adminControls = document.getElementById('adminLandingControls');
            if (loginUI) loginUI.classList.add('hidden');
            if (adminControls) adminControls.classList.remove('hidden');
            
            // FIX: Load landing page content for Admin too
            loadLandingPageContent();
            return;
        }

        // IF STUDENT: Go to web2
        window.location.href = 'web2.html';
        return; 
    }

    // IF GUEST: Load content
    loadLandingPageContent();
    
    if (authModeMessage) {
        authModeMessage.innerText = 'Enter your credentials to log in.';
    }
};

// --- HELPER: Load Public Content ---
function loadLandingPageContent() {
    // Inject Avatar Input
    if (document.getElementById('avatarInput')) return; // Prevent duplicate injection

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
    fetchLandingGallery(); // <--- AND THIS ONE
    setupRealtimeNotes(); // <--- Initialize Realtime Listener
    showWelcomeNote();

    // --- PASSWORD TOGGLE ---
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        // Clone to remove old listeners if re-initialized
        const newToggle = togglePassword.cloneNode(true);
        togglePassword.parentNode.replaceChild(newToggle, togglePassword);
        
        newToggle.addEventListener('click', function () {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle icon
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'; 
        });
    }
}

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
        try {
            await supabaseClient
                .from('students')
                .update({ email: autoEmail })
                .eq('id', data.id);
                
            // Update local data variable so the session has it too
            data.email = autoEmail;
            console.log("System auto-corrected missing email.");
        } catch (err) {
            console.warn("Auto-email fix failed:", err);
        }
    }
    // ----------------------------------------

    const userPayload = JSON.stringify({
        id: data.id,
        name: data.name,
        sr_code: data.sr_code,
        avatar_url: data.avatar_url,
        email: data.email,
        role: data.role,
        enrollment_status: data.enrollment_status || 'Not Enrolled'
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
    if (data.sr_code === 'ADMIN' || data.role === 'admin') {
        // Switch to Admin Mode on Landing Page
        const loginUI = document.getElementById('loginUI');
        const adminControls = document.getElementById('adminLandingControls');
        if (loginUI) loginUI.classList.add('hidden');
        if (adminControls) adminControls.classList.remove('hidden');
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
    fetchAdminFiles(); // Load files
}

// --- ADMIN FEATURES (Black List) ---

async function fetchStudents() {
    const { data, error } = await supabaseClient
        .from('students')
        .select('id, name, sr_code, password, avatar_url, enrollment_status');
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
    
    studentListContainer.innerHTML = '';
    const validStudents = students.filter(s => s.sr_code !== 'ADMIN');

    if (validStudents.length === 0) {
        studentListContainer.innerHTML = '<p style="text-align:center; color:#666;">No students found.</p>';
        return;
    }

    const batchSection = document.createElement('div');
    batchSection.style.marginBottom = '20px';
    
    const title = document.createElement('h4');
    title.style.cssText = 'margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #555; text-align: left;';
    title.innerText = `BSIT 2106`;
    batchSection.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px;';
    
    validStudents.forEach(student => {
        const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
        
        const chip = document.createElement('div');
        chip.className = 'member-tag';
        chip.style.cssText = 'cursor: pointer; padding: 5px 10px; font-size: 0.9rem; background: #fff; border: 2px solid #000; display: flex; align-items: center; gap: 8px; transition: transform 0.2s;';
        chip.onmouseover = () => chip.style.transform = 'scale(1.05)';
        chip.onmouseout = () => chip.style.transform = 'scale(1)';
        chip.onclick = () => openStudentDetails(student.id);

        chip.innerHTML = `
            <img src="${avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #000;">
            <span style="font-weight:bold; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${student.name}</span>
        `;
        grid.appendChild(chip);
    });

    batchSection.appendChild(grid);
    studentListContainer.appendChild(batchSection);
}

async function deleteStudent(id) {
    if(!await showWimpyConfirm('Scratch this person out specifically?')) return;
    const { error } = await supabaseClient.from('students').delete().eq('id', id);
    if (error) showToast('Could not delete.', 'error');
    else {
        showToast('Scratched out successfully.');
        closeStudentDetails();
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

// --- STUDENT DETAILS MODAL ---
window.openStudentDetails = function(id) {
    const student = allStudents.find(s => s.id == id);
    if(!student) return;

    const modal = document.getElementById('studentDetailsModal');
    const content = document.getElementById('studentDetailsContent');
    const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
    
    const safeName = student.name.replace(/'/g, "\\'");
    const safeCode = student.sr_code.replace(/'/g, "\\'");
    const safeAvatar = (student.avatar_url || '').replace(/'/g, "\\'");
    const currentStatus = student.enrollment_status || 'Not Enrolled';

    content.innerHTML = `
        <img src="${avatar}" style="width:100px; height:100px; border-radius:50%; border:3px solid #000; margin-bottom:15px; object-fit:cover;">
        <h2 style="margin:0;">${student.name}</h2>
        <p style="color:#666; margin-top:5px;">${student.email || 'No Email'}</p>
        
        <div style="background:#f1f2f6; padding:15px; border-radius:10px; border:2px dashed #ccc; margin:15px 0; text-align:left;">
            <div style="margin-bottom:10px;">
                <strong>SR Code:</strong> 
                <span style="font-family:monospace; font-size:1.2rem; background:#fff; padding:2px 5px; border:1px solid #999;">${student.sr_code}</span>
                <i class="fas fa-copy" onclick="copyToClipboard('${safeCode}')" style="cursor:pointer; color:#0984e3; margin-left:5px;" title="Copy"></i>
            </div>
            <div>
                <strong>Password:</strong> 
                <span style="font-family:monospace; font-size:1.2rem; background:#fff; padding:2px 5px; border:1px solid #999;">${student.password}</span>
                <i class="fas fa-copy" onclick="copyToClipboard('${student.password}')" style="cursor:pointer; color:#0984e3; margin-left:5px;" title="Copy"></i>
            </div>
        </div>

        <div style="margin-bottom:15px; text-align:left; border-top:1px dashed #ccc; padding-top:10px;">
            <strong><i class="fas fa-user-check"></i> Enrollment Status:</strong>
            <select onchange="updateStudentStatus('${student.id}', this.value)" style="width:100%; padding:8px; margin-top:5px; font-family:'Patrick Hand'; border:2px solid #000; background:#fff;">
                <option value="Not Enrolled" ${currentStatus === 'Not Enrolled' ? 'selected' : ''}>Not Enrolled</option>
                <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Enrolled" ${currentStatus === 'Enrolled' ? 'selected' : ''}>Enrolled</option>
                <option value="Irregular" ${currentStatus === 'Irregular' ? 'selected' : ''}>Irregular</option>
            </select>
        </div>

        <div style="display:flex; gap:10px; flex-direction:column;">
            <button onclick="loginAsUser('${safeName}', '${safeCode}', '${safeAvatar}', '${student.id}')" class="sketch-btn" style="background:#0984e3; color:#fff;">
                <i class="fas fa-rocket"></i> Login as User
            </button>
            <button onclick="deleteStudent('${student.id}')" class="sketch-btn danger">
                <i class="fas fa-trash"></i> Delete User
            </button>
        </div>
    `;
    modal.classList.remove('hidden');
}

window.updateStudentStatus = async function(id, status) {
    const { error } = await supabaseClient.from('students').update({ enrollment_status: status }).eq('id', id);
    if(error) showToast("Error updating status: " + error.message, "error");
    else {
        showToast("Status updated to " + status);
        const s = allStudents.find(st => st.id == id);
        if(s) s.enrollment_status = status;
    }
}

window.closeStudentDetails = function() {
    document.getElementById('studentDetailsModal').classList.add('hidden');
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
    const { data: students, error } = await supabaseClient.from('students').select('id, name, avatar_url, sr_code, role, enrollment_status');
    if (error) return;

    // 2. Fetch Statuses
    const { data: statuses } = await supabaseClient.from('user_statuses').select('user_id, status');
    
    // Create a lookup map for statuses
    const statusMap = {};
    if (statuses) statuses.forEach(s => statusMap[s.user_id] = s.status);

    // --- ADMIN SECTION ---
    const admins = students.filter(s => s.sr_code === 'ADMIN' || s.role === 'admin');
    const adminList = document.getElementById('adminList');
    const adminSection = document.getElementById('adminSection');

    if (adminList && adminSection) {
        adminList.innerHTML = '';
        if (admins.length > 0) {
            adminSection.classList.remove('hidden');
            admins.forEach(admin => {
                const tag = document.createElement('div');
                tag.className = 'member-tag';
                tag.style.cssText = 'cursor: pointer; border-color: #d63031; background: #fff0f0;';
                tag.onclick = () => showPublicProfile(admin.name, admin.avatar_url, "System Administrator");
                
                const safeAvatar = admin.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}&background=random`;
                
                tag.innerHTML = `
                    <img src="${safeAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #d63031; flex-shrink: 0;">
                    <span style="font-weight:bold; color: #d63031;">${admin.name}</span>
                `;
                adminList.appendChild(tag);
            });
        } else {
            adminSection.classList.add('hidden');
        }
    }

    publicMemberList.innerHTML = '';
    
    // Filter valid members first (Exclude Admin/Principal)
    const validMembers = students.filter(s => s.sr_code !== 'ADMIN' && s.role !== 'admin' && s.name !== 'Principal User' && !s.name.includes('Admin'));
    
    // Update Badge with Animation
    const badge = document.getElementById('memberCountBadge');
    if(badge) {
        badge.innerText = validMembers.length;
        badge.classList.remove('pop');
        void badge.offsetWidth; // Trigger reflow to restart animation
        badge.classList.add('pop');
    }

    if (validMembers.length === 0) {
        publicMemberList.innerHTML = '<span style="font-style:italic">No members yet...</span>';
        return;
    }
    validMembers.forEach(student => {
        const userStatus = statusMap[student.id] || 'Member';

        const tag = document.createElement('div');
        tag.className = 'member-tag';
        // Use flex row layout for the card content
        tag.style.cssText = 'cursor: pointer;';
        tag.onclick = () => showPublicProfile(student.name, student.avatar_url, userStatus);
        
        const safeAvatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
        
        tag.innerHTML = `
            <img src="${safeAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #333; flex-shrink: 0;">
            <span style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${student.name}</span>
        `;
        publicMemberList.appendChild(tag);
    });

    // --- POPULATE ENROLLMENT BOARD (Right Side) ---
    const enrolledList = document.getElementById('enrolled-list');
    const notEnrolledList = document.getElementById('not-enrolled-list');

    if (enrolledList && notEnrolledList) {
        const enrolled = students.filter(s => s.enrollment_status === 'Enrolled');
        const notEnrolled = students.filter(s => s.enrollment_status !== 'Enrolled' && s.sr_code !== 'ADMIN' && s.role !== 'admin');

        // Update Counts
        const countIn = document.getElementById('count-in');
        const countOut = document.getElementById('count-out');
        if(countIn) countIn.innerText = enrolled.length;
        if(countOut) countOut.innerText = notEnrolled.length;

        const generateTag = (s) => {
             const safeAvatar = s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`;
             return `
                <div class="member-tag" style="cursor: default;">
                    <img src="${safeAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #333; flex-shrink: 0;">
                    <span style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${s.name}</span>
                </div>
             `;
        };

        enrolledList.innerHTML = enrolled.length ? enrolled.map(generateTag).join('') : '<div style="width:100%; text-align:center; color:#666;">None yet</div>';
        notEnrolledList.innerHTML = notEnrolled.length ? notEnrolled.map(generateTag).join('') : '<div style="width:100%; text-align:center; color:#666;">Everyone is in!</div>';
    }
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
    
    // Add Contact Button if Admin
    const contactBtn = (status === 'System Administrator') 
        ? `<button onclick="openRequestModal()" style="margin-top:10px; background:#0984e3; color:#fff; border: 2px solid #000; font-size: 1rem;"><i class="fas fa-paper-plane"></i> Contact Admin</button>` 
        : '';

    const safeAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    modal.innerHTML = `
        <div class="sketch-box" style="width:90%; max-width:300px; margin:0; text-align:center; animation: slideUp 0.3s ease-out;">
            <h2 style="margin-bottom:15px;">${name}</h2>
            <div style="padding:10px; border:2px dashed #ccc; display:inline-block; border-radius:50%;">
                <img src="${safeAvatar}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:2px solid #000;">
            </div>
            <p style="margin-top:15px; font-style:italic;">"${status || 'Member'}"</p>
            ${contactBtn}
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
    const randomX = Math.floor(Math.random() * 80) + 10; // 10% to 90%
    const randomY = Math.floor(Math.random() * 90) + 5; 
    const rotation = Math.floor(Math.random() * 20) - 10;
    // Wimpy Theme: Use 'plain' or 'lined' instead of colors
    const styles = ['plain', 'lined'];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const { error } = await supabaseClient.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: randomStyle, likes: 0 }]);
    if (error) showToast('Failed to stick note.', 'error');
    else { showToast('Note posted!'); noteInput.value = ''; fetchNotes(); }
}
async function fetchNotes() {
    const { data, error } = await supabaseClient.from('notes').select('*');
    if (error) return;
    
    // Check if Admin (for delete capability)
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    let isAdmin = false;
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code === 'ADMIN') isAdmin = true;
    }

    noteLayer.innerHTML = '';
    data.forEach(note => {
        const div = document.createElement('div');
        div.className = 'sticky-note';
        
        // Content
        const p = document.createElement('p');
        p.innerText = note.content;
        p.style.margin = '0';
        p.style.pointerEvents = 'none'; // Let clicks pass to drag handler
        div.appendChild(p);

        div.id = `note-${note.id}`;
        div.style.left = note.x_pos + '%';
        div.style.top = note.y_pos + '%';
        div.style.transform = `rotate(${note.rotation}deg)`;
        
        // Apply Wimpy Style (Color or Lined)
        if (note.color) div.classList.add(note.color);
        
        // Delete Button (Only if Admin)
        if (isAdmin) {
            const btn = document.createElement('button');
            btn.className = 'delete-note-btn';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.title = "Delete Note";
            btn.style.width = '20px'; // Override global button styles
            btn.style.padding = '0';
            btn.style.marginTop = '0';
            // Prevent drag when clicking button
            btn.onmousedown = (e) => e.stopPropagation(); 
            btn.onclick = () => deleteNote(note.id);
            div.appendChild(btn);
        }

        // Like Sticker
        const likeBtn = document.createElement('div');
        likeBtn.className = 'like-sticker';
        // Check if user liked this locally
        let likedNotes = [];
        try {
            likedNotes = JSON.parse(localStorage.getItem('liked_notes') || '[]');
        } catch (e) {
            localStorage.removeItem('liked_notes'); // Reset if corrupted
        }
        if(likedNotes.includes(note.id)) likeBtn.classList.add('liked');
        
        likeBtn.innerHTML = `<i class="fas fa-heart"></i> <span class="like-count">${note.likes || 0}</span>`;
        // Stop propagation to prevent dragging when clicking like
        likeBtn.onmousedown = (e) => e.stopPropagation();
        likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(note.id); };
        div.appendChild(likeBtn);

        makeDraggable(div, note.id);
        noteLayer.appendChild(div);
    });
}

window.toggleLike = async function(id) {
    let likedNotes = [];
    try {
        likedNotes = JSON.parse(localStorage.getItem('liked_notes') || '[]');
    } catch (e) {
        localStorage.removeItem('liked_notes');
    }
    const isLiked = likedNotes.includes(id);
    const el = document.getElementById(`note-${id}`);
    
    // Optimistic UI Update (Immediate feedback)
    if(el) {
        const btn = el.querySelector('.like-sticker');
        const countSpan = el.querySelector('.like-count');
        let count = parseInt(countSpan.innerText) || 0;
        
        if(isLiked) {
            // Unlike
            const newLiked = likedNotes.filter(n => n !== id);
            try { localStorage.setItem('liked_notes', JSON.stringify(newLiked)); } catch(e) {}
            btn.classList.remove('liked');
            countSpan.innerText = Math.max(0, count - 1);
            
            // Update DB - Revert if failed
            const success = await updateLikesInDb(id, -1);
            if(!success) {
                // Revert UI
                try { localStorage.setItem('liked_notes', JSON.stringify(likedNotes)); } catch(e) {} // Put back
                btn.classList.add('liked');
                countSpan.innerText = count;
                showToast("Connection failed. Like not saved.", "error");
            }
        } else {
            // Like
            likedNotes.push(id);
            try { localStorage.setItem('liked_notes', JSON.stringify(likedNotes)); } catch(e) {}
            btn.classList.add('liked');
            countSpan.innerText = count + 1;
            
            // Update DB - Revert if failed
            const success = await updateLikesInDb(id, 1);
            if(!success) {
                // Revert UI
                const revertedLiked = likedNotes.filter(n => n !== id);
                try { localStorage.setItem('liked_notes', JSON.stringify(revertedLiked)); } catch(e) {}
                btn.classList.remove('liked');
                countSpan.innerText = count;
                showToast("Connection failed. Like not saved.", "error");
            }
        }
    }
}

async function updateLikesInDb(id, change) {
    try {
        // Fetch current count to ensure accuracy
        const { data, error: fetchError } = await supabaseClient.from('notes').select('likes').eq('id', id).single();
        
        if(fetchError) {
            console.error("Error fetching like count:", fetchError.message, fetchError.details || '');
            return false;
        }

        const newCount = Math.max(0, (data?.likes || 0) + change);
        const { error: updateError } = await supabaseClient.from('notes').update({ likes: newCount }).eq('id', id);
        
        if(updateError) {
            console.error("Error updating like count:", updateError.message, updateError.details || '');
            return false;
        }
        return true;
    } catch (err) {
        console.error("Unexpected error updating likes:", err);
        return false;
    }
}

// --- REALTIME LISTENER FOR NOTES ---
function setupRealtimeNotes() {
    supabaseClient
        .channel('public:notes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
            if(payload.eventType === 'INSERT') {
                fetchNotes(); // New note added, refresh board
            } else if (payload.eventType === 'DELETE') {
                const el = document.getElementById(`note-${payload.old.id}`);
                if(el) el.remove();
            } else if (payload.eventType === 'UPDATE') {
                const el = document.getElementById(`note-${payload.new.id}`);
                if(el) {
                    // Update Like Count
                    const countSpan = el.querySelector('.like-count');
                    if(countSpan) countSpan.innerText = payload.new.likes || 0;
                    
                    // Update Position (Only if changed significantly, to avoid jitter)
                    // We skip this if the user is currently dragging it (checked via class or state if needed)
                    // For now, we just update likes to be "responsive" as requested.
                }
            }
        })
        .subscribe();
}

window.deleteNote = async function(id) {
    if(!await showWimpyConfirm("Tear off this note?")) return;
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if(error) showToast("Could not delete note.", "error");
    else {
        showToast("Note removed.");
        fetchNotes();
    }
}

function makeDraggable(element, noteId) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;
    element.ontouchstart = dragMouseDown;
    
    function dragMouseDown(e) { 
        e = e || window.event; 
        
        // Bring to front
        element.style.zIndex = 1000;
        
        if (e.type !== 'touchstart') e.preventDefault(); 
        pos3 = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX; 
        pos4 = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY; 
        document.onmouseup = closeDragElement; 
        document.onmousemove = elementDrag; 
        document.ontouchend = closeDragElement; 
        document.ontouchmove = elementDrag; 
    }
    
    function elementDrag(e) { e = e || window.event; let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX; let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY; pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY; element.style.top = (element.offsetTop - pos2) + "px"; element.style.left = (element.offsetLeft - pos1) + "px"; }
    
    function closeDragElement() { 
        // Reset z-index slightly so it doesn't stay 'active' forever, or keep it high
        element.style.zIndex = 'auto'; 
        const parent = element.parentElement;
        
        document.onmouseup = null; 
        document.onmousemove = null; 
        document.ontouchend = null; 
        document.ontouchmove = null; 
        const xPercent = (element.offsetLeft / parent.offsetWidth) * 100; 
        const yPercent = (element.offsetTop / parent.offsetHeight) * 100; 
        updateNotePosition(noteId, xPercent, yPercent); 
    }
}
async function updateNotePosition(id, x, y) {
    x = Math.max(0, Math.min(x, 95));
    y = Math.max(0, Math.min(y, 95));
    await supabaseClient.from('notes').update({ x_pos: x, y_pos: y }).eq('id', id);
}

// --- FREEDOM WALL MODAL (Landing Page) ---
window.openFreedomWall = function() {
    document.getElementById('freedomWallModal').classList.remove('hidden');
    // Auto-focus the input for instant accessibility
    setTimeout(() => {
        const input = document.getElementById('fw-landing-input');
        if(input) input.focus();
    }, 100);
}
window.closeFreedomWall = function() {
    document.getElementById('freedomWallModal').classList.add('hidden');
}

// --- COLOR SELECTION ---
window.selectColor = function(el, color) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('fw-landing-color').value = color;
}

window.postLandingNote = async function() {
    const input = document.getElementById('fw-landing-input');
    const btn = document.getElementById('fw-landing-btn');
    const text = input.value.trim();
    
    if (!text) return showToast('Write something first!', 'error');

    if(btn) btn.disabled = true; // Prevent spam

    // Random Position & Style
    const randomX = Math.floor(Math.random() * 80) + 10; 
    const randomY = Math.floor(Math.random() * 80) + 10; 
    const rotation = Math.floor(Math.random() * 20) - 10;
    const selectedColor = document.getElementById('fw-landing-color').value || 'white';

    const { error } = await supabaseClient.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: selectedColor, likes: 0 }]);
    
    if(btn) btn.disabled = false;

    if (error) showToast('Failed to post.', 'error');
    else { showToast('Note posted!'); input.value = ''; fetchNotes(); }
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
    
    // Reset UI
    const loginUI = document.getElementById('loginUI');
    const adminControls = document.getElementById('adminLandingControls');
    if (loginUI) loginUI.classList.remove('hidden');
    if (adminControls) adminControls.classList.add('hidden');

    if(adminChoiceModal) adminChoiceModal.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    searchInput.value = '';
    fetchMembers(); fetchNotes(); fetchRecentLogins(); fetchNewUploads(); fetchLandingGallery();
}

// Function to return to the admin choice modal from the admin dashboard
function returnToAdminChoice() {
    adminDashboard.classList.add('hidden');
    // Show landing page again (which has admin controls)
    const authSection = document.getElementById('authSection');
    if(authSection) authSection.classList.remove('hidden');
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
        <p style="font-size:1.3rem; margin: 15px 0; color: #d32f2f; font-weight: bold;">"Login na kayo para makita niyo!"</p>
        <button onclick="showCongratsMessage(this.parentElement.parentElement)" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 5px; padding: 10px;">SHEESH!</button>
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

// --- CONGRATS MESSAGE ---
window.showCongratsMessage = function(prevModal) {
    if (prevModal) prevModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    
    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    
    box.innerHTML = `
        <h2 style="margin:0 0 15px 0; font-size:2rem;">🎉 CONGRATS!</h2>
        <p style="font-size:1.3rem; margin-bottom:20px;">Congrays Guys at naipasa natin ang First Sem, Goodluck sa Second Sem!<br><br>- Jv</p>
        <button onclick="this.closest('.wimpy-modal-overlay').remove()" style="background: #000; color: #fff; border: 2px solid #000; font-family: 'Patrick Hand'; font-size: 1.2rem; cursor: pointer; width: 100%; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; padding: 10px;">LET'S GO!</button>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // --- CONFETTI EFFECT ---
    const startConfetti = () => {
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10001 };
        var random = (min, max) => Math.random() * (max - min) + min;

        var interval = setInterval(function() {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            var particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };

    if (typeof confetti === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.onload = startConfetti;
        document.head.appendChild(script);
    } else {
        startConfetti();
    }
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
        .select('id, title, subject, created_at, file_url, file_type')
        .neq('subject', 'LandingGallery')
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

// --- FETCH LANDING PAGE GALLERY ---
async function fetchLandingGallery() {
    const container = document.getElementById('wimpyGalleryContainer');
    const section = document.getElementById('wimpyGallerySection');
    if(!container || !section) return;

    const { data, error } = await supabaseClient
        .from('shared_files')
        .select('*')
        .eq('subject', 'LandingGallery')
        .order('created_at', { ascending: false });

    if(error || !data || data.length === 0) {
        section.classList.add('hidden');
        return;
    }

    // Check for Admin
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    let isAdmin = false;
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code === 'ADMIN') isAdmin = true;
    }

    galleryItems = data; // Store for lightbox
    section.classList.remove('hidden');
    container.innerHTML = data.map((item, index) => {
        const deleteBtn = isAdmin ? `<button onclick="event.stopPropagation(); deleteAdminFile(${item.id})" class="sketch-btn danger" style="position:absolute; top:-10px; right:-10px; width:30px; height:30px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; z-index:20; font-size:0.9rem;">X</button>` : '';
        return `
        <div class="polaroid-card" onclick="openGalleryLightbox(${index})" 
             tabindex="0" role="button" aria-label="View photo: ${item.title}"
             onkeydown="if(event.key==='Enter'||event.key===' ') openGalleryLightbox(${index})">
            ${deleteBtn}
            <div class="tape-strip"></div>
            <img src="${item.file_url}" alt="${item.title}" loading="lazy">
            <div class="polaroid-caption">${item.title}</div>
        </div>
    `}).join('');

    startGallerySlideshow();
}

// --- GALLERY LIGHTBOX WITH NAVIGATION ---
window.openGalleryLightbox = function(startIndex) {
    if (!galleryItems || galleryItems.length === 0) return;
    let currentIndex = startIndex;

    const overlay = document.createElement('div');
    overlay.id = 'galleryLightbox';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:10000; display:flex; justify-content:center; align-items:center; flex-direction:column; animation: fadeIn 0.3s;';
    
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'position:relative; max-width:90%; max-height:80%; display:flex; justify-content:center; align-items:center;';
    
    const img = document.createElement('img');
    img.style.cssText = 'max-width:100%; max-height:80vh; border: 5px solid #fff; box-shadow: 0 0 30px rgba(0,0,0,0.5); object-fit: contain; transition: opacity 0.2s;';
    
    const caption = document.createElement('div');
    caption.style.cssText = 'color:#fff; font-family:"Patrick Hand"; font-size:1.5rem; margin-top:15px; text-align:center; text-shadow: 1px 1px 2px #000;';

    // Navigation Buttons
    const btnStyle = 'position:absolute; top:50%; transform:translateY(-50%) !important; background:rgba(255,255,255,0.1); color:#fff; border:2px solid #fff; width:50px; height:50px; border-radius:50%; font-size:1.5rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s; animation: none !important;';
    
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.style.cssText = btnStyle + 'left:20px;';
    prevBtn.onmouseover = () => { prevBtn.style.background = '#fff'; prevBtn.style.color = '#000'; prevBtn.style.setProperty('transform', 'translateY(-50%) scale(1.1)', 'important'); };
    prevBtn.onmouseout = () => { prevBtn.style.background = 'rgba(255,255,255,0.1)'; prevBtn.style.color = '#fff'; prevBtn.style.setProperty('transform', 'translateY(-50%)', 'important'); };
    
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.style.cssText = btnStyle + 'right:20px;';
    nextBtn.onmouseover = () => { nextBtn.style.background = '#fff'; nextBtn.style.color = '#000'; nextBtn.style.setProperty('transform', 'translateY(-50%) scale(1.1)', 'important'); };
    nextBtn.onmouseout = () => { nextBtn.style.background = 'rgba(255,255,255,0.1)'; nextBtn.style.color = '#fff'; nextBtn.style.setProperty('transform', 'translateY(-50%)', 'important'); };

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = 'position:absolute; top:20px; right:20px; background:transparent; color:#fff; border:none; font-size:2rem; cursor:pointer; animation: none !important; transform: none !important;';
    
    const updateImage = (idx) => {
        img.style.opacity = '0.5';
        setTimeout(() => {
            img.src = galleryItems[idx].file_url;
            caption.innerText = `${galleryItems[idx].title} (${idx + 1}/${galleryItems.length})`;
            img.onload = () => img.style.opacity = '1';
        }, 150);
    };

    // Event Listeners
    const next = (e) => { if(e) e.stopPropagation(); currentIndex = (currentIndex + 1) % galleryItems.length; updateImage(currentIndex); };
    const prev = (e) => { if(e) e.stopPropagation(); currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length; updateImage(currentIndex); };
    const close = () => { document.removeEventListener('keydown', keyHandler); overlay.remove(); };

    prevBtn.onclick = prev;
    nextBtn.onclick = next;
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if(e.target === overlay) close(); };

    const keyHandler = (e) => {
        if(e.key === 'ArrowLeft') prev();
        if(e.key === 'ArrowRight') next();
        if(e.key === 'Escape') close();
    };
    document.addEventListener('keydown', keyHandler);

    imgContainer.appendChild(img);
    overlay.append(closeBtn, prevBtn, imgContainer, nextBtn, caption);
    document.body.appendChild(overlay);
    updateImage(currentIndex);
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

// --- ADMIN FILE MANAGER (To delete memories/uploads) ---
async function fetchAdminFiles() {
    const container = document.getElementById('adminFileList');
    if(!container) return;
    
    container.innerHTML = '<p>Loading files...</p>';
    
    const { data, error } = await supabaseClient
        .from('shared_files')
        .select('*')
        .neq('subject', 'LandingGallery')
        .order('created_at', { ascending: false });
        
    if(error) return console.error(error);
    
    if(!data || data.length === 0) {
        container.innerHTML = '<h3 style="text-align:center; color:#666;">No files uploaded.</h3>';
        return;
    }
    
    container.innerHTML = '<h3 style="text-decoration:underline wavy #0984e3;"><i class="fas fa-folder-open"></i> Manage Files</h3>' + data.map(file => `
        <div class="student-strip" style="justify-content:space-between; align-items:center; background:#f0f8ff;">
            <div style="display:flex; flex-direction:column; gap:2px; overflow:hidden; text-align:left;">
                <strong>${file.title}</strong>
                <small style="color:#666;">${file.subject} | ${new Date(file.created_at).toLocaleDateString()}</small>
            </div>
            <div style="display:flex; gap:5px;">
                <a href="${file.file_url}" target="_blank" class="btn-icon" style="background:#0984e3; color:#fff; text-decoration:none; display:flex; align-items:center;"><i class="fas fa-eye"></i></a>
                <button onclick="deleteAdminFile(${file.id})" class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.deleteAdminFile = async function(id) {
    if(!await showWimpyConfirm('Delete this file permanently?')) return;
    const { error } = await supabaseClient.from('shared_files').delete().eq('id', id);
    if(error) showToast('Error deleting file.', 'error');
    else {
        showToast('File deleted.');
        fetchAdminFiles();
        fetchNewUploads(); // Refresh the public list too
        fetchLandingGallery(); // Refresh gallery if applicable
    }
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
    
    // Icon Logic
    let icon = 'fa-file-alt';
    if (file.file_type) {
        if (file.file_type.includes('pdf')) icon = 'fa-file-pdf';
        else if (file.file_type.includes('image')) icon = 'fa-file-image';
        else if (file.file_type.includes('word') || file.file_type.includes('doc')) icon = 'fa-file-word';
        else if (file.file_type.includes('sheet') || file.file_type.includes('csv')) icon = 'fa-file-excel';
        else if (file.file_type.includes('presentation') || file.file_type.includes('ppt')) icon = 'fa-file-powerpoint';
    }

    // Check for Admin to add Delete Button
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    let deleteBtn = '';
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code === 'ADMIN') {
            deleteBtn = `<button onclick="event.stopPropagation(); deleteAdminFile(${file.id})" class="sketch-btn danger" style="position:absolute; top:5px; right:5px; padding: 2px 8px; font-size: 0.8rem; width:auto; margin:0; z-index:10;">X</button>`;
        }
    }

    return `
        <div style="width: 95%; background: #fff; border: 2px solid #000; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; padding: 10px; display: flex; align-items: center; gap: 10px; box-shadow: 3px 3px 0 rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer; position: relative;" 
             onclick="openFilePreview('${safeUrl}', '${safeTitle}')"
             tabindex="0" role="button" aria-label="Preview file: ${safeTitle}"
             onkeydown="if(event.key==='Enter'||event.key===' ') openFilePreview('${safeUrl}', '${safeTitle}')"
             onmouseover="this.style.transform='scale(1.02) rotate(-1deg)'" 
             onmouseout="this.style.transform='scale(1) rotate(0deg)'">
            ${deleteBtn}
            <div style="font-size: 1.5rem; color: #000;"><i class="fas ${icon}"></i></div>
            <div style="text-align: left; flex: 1;">
                <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: bold; color: #666;">${subject}</div>
                <div style="font-size: 1.1rem; line-height: 1.1; font-weight: bold;">${safeTitle}</div>
                <div style="font-size: 0.8rem; color: #2980b9; margin-top: 2px;"><i class="fas fa-eye"></i> Click to Preview</div>
            </div>
            ${badgeHtml}
        </div>
    `;
}

// --- GALLERY SCROLL LOGIC ---
window.scrollGallery = function(direction) {
    const container = document.getElementById('wimpyGalleryContainer');
    if(container) {
        const scrollAmount = 300;
        container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
}

// --- AUTO SCROLL SLIDESHOW ---
function startGallerySlideshow() {
    const container = document.getElementById('wimpyGalleryContainer');
    if (!container) return;
    
    if (galleryInterval) clearInterval(galleryInterval);
    if (galleryAnimationFrame) cancelAnimationFrame(galleryAnimationFrame);
    
    let scrollPos = container.scrollLeft;
    const speed = 0.5; // Pixels per frame (adjust for speed)

    function animate() {
        // Pause if user is hovering or if the lightbox is open
        if (!container.matches(':hover') && !document.getElementById('galleryLightbox')) {
            scrollPos += speed;
            
            // Loop back to start if we reach the end
            if (scrollPos >= container.scrollWidth - container.clientWidth) {
                scrollPos = 0;
            }
            container.scrollLeft = scrollPos;
        } else {
            // Sync scrollPos with manual scroll position
            scrollPos = container.scrollLeft;
        }
        galleryAnimationFrame = requestAnimationFrame(animate);
    }
    
    galleryAnimationFrame = requestAnimationFrame(animate);
}

// --- ADMIN GALLERY UPLOAD (INDEX PAGE) ---
window.uploadGalleryItemIndex = async function(e) {
    e.preventDefault();
    const captionInput = document.getElementById('idx-g-caption');
    const fileInput = document.getElementById('idx-g-file');
    const btn = document.getElementById('idx-upload-btn');
    const file = fileInput.files[0];

    if (!file) return showToast('Select an image.', 'error');

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = 'Uploading...';

    try {
        const fileName = `gallery_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('class-resources')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseClient.storage
            .from('class-resources')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabaseClient.from('shared_files').insert([{
            title: captionInput.value || 'Untitled',
            subject: 'LandingGallery',
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbError) throw dbError;

        showToast('Posted to Gallery!');
        e.target.reset();
        fetchLandingGallery(); // Refresh gallery on login page
    } catch (err) {
        console.error(err);
        showToast('Upload failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- MEMBER LIST TOGGLE ---
window.toggleMemberList = function() {
    const list = document.getElementById('publicMemberList');
    const icon = document.getElementById('memberToggleIcon');
    
    if (list) list.classList.toggle('hidden');
    if (icon) {
        icon.style.transform = list.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

// --- CLASS LIST MODAL ---
window.openClassList = function() {
    document.getElementById('classListModal').classList.remove('hidden');
    fetchMembers(); // Refresh data when opening
}
window.closeClassList = function() {
    document.getElementById('classListModal').classList.add('hidden');
}

// --- PUBLIC REQUEST MODAL ---
window.openRequestModal = function() {
    // Close profile modal if open
    const profileModal = document.getElementById('publicProfileModal');
    if(profileModal) profileModal.style.display = 'none';
    
    document.getElementById('requestModal').classList.remove('hidden');
}

window.closeRequestModal = function() {
    document.getElementById('requestModal').classList.add('hidden');
    document.getElementById('req-content').value = '';
}

window.submitRequest = async function() {
    const content = document.getElementById('req-content').value;
    if(!content) return showToast('Write something first!', 'error');
    
    const { error } = await supabaseClient.from('requests').insert([{
        content: content,
        sender: 'Anonymous (Public)'
    }]);
    
    if(error) showToast('Error sending: ' + error.message, 'error');
    else {
        showToast('Request sent to Admin!');
        closeRequestModal();
    }
}

// --- ADMIN LIST TOGGLE ---
window.toggleAdminList = function() {
    const list = document.getElementById('adminList');
    const icon = document.getElementById('adminToggleIcon');
    
    if (list) list.classList.toggle('hidden');
    if (icon) {
        icon.style.transform = list.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}