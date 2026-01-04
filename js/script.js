// script.js (Self-Healing Admin Menu Version + Email Auto-Fix)

// --- CONFIGURATION ---
// SUPABASE_URL and SUPABASE_KEY are loaded from common.js
// window.db is initialized in common.js
const supabaseClient = window.db;

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
// escapeHTML, showToast, debounce, copyToClipboard are loaded from common.js

// --- INITIAL LOAD ---
const initApp = async () => {
    // 1. Force Inject Admin Modal if missing (Fixes GitHub Pages Sync Issues)
    injectAdminModal();

    // 2. Check Session
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');

    if (storedUser) {
        const user = JSON.parse(storedUser);

        // Update last login for "Recently Spotted" tracker on session restore
        await supabaseClient.from('students')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // IF ADMIN: Check if they should see the choice menu or go straight to binder
        const isMain = (user.sr_code === 'ADMIN');
        const isLegacy = (user.role === 'admin');
        const isGranular = (user.role && user.role.startsWith('admin:tools:'));
        const hasBlacklist = (isGranular && user.role.split(':')[2].split(',').includes('blacklist'));

        // DIFFERENT APPROACH: Only show Admin Landing (Black List Option) if they actually have permission.
        // Legacy Admins ('admin') go straight to binder.
        if (isMain || hasBlacklist) {
            // Show Admin Choice for Blacklist Users
            const loginUI = document.getElementById('loginUI');
            const adminControls = document.getElementById('adminLandingControls');
            if (loginUI) loginUI.classList.add('hidden');
            if (adminControls) adminControls.classList.remove('hidden');

            // FIX: Load landing page content for Admin too
            loadLandingPageContent();
            return;
        } else if (isLegacy || isGranular) {
            // Legacy Admin or Granular (without blacklist) -> Binder
            window.location.href = 'web2.html';
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

    // Start Jumpscare Timer
    startJumpscareTimer();
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
    if (nameInput && nameInput.parentNode) {
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

    // Set initial text for toggleAuth based on isLoginMode
    if (toggleAuth && isLoginMode) {
        toggleAuth.innerHTML = "Magpapalista? <b>Come here mga kosa click this</b> (Register Here)";
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
    if (authSection) {
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

        if (avatarInput) avatarInput.classList.add('hidden');
        const lbl = document.getElementById('avatarLabel');
        if (lbl) lbl.classList.add('hidden');

        if (keepLoggedInContainer) {
            keepLoggedInContainer.classList.remove('hidden');
            keepLoggedInContainer.style.display = 'flex';
        }
        toggleAuth.innerHTML = "Magpapalista? <b>Come here mga kosa click this</b> (Register Here)";
    } else {
        submitBtn.innerText = 'SIGN UP';
        nameInput.classList.remove('hidden');
        nameInput.required = true;

        if (avatarInput) avatarInput.classList.remove('hidden');
        const lbl = document.getElementById('avatarLabel');
        if (lbl) lbl.classList.remove('hidden');

        if (keepLoggedInContainer) {
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

    // Check Permissions
    const isMain = (data.sr_code === 'ADMIN');
    const isLegacy = (data.role === 'admin');
    const isGranular = (data.role && data.role.startsWith('admin:tools:'));
    const hasBlacklist = (isGranular && data.role.split(':')[2].split(',').includes('blacklist'));

    // DIFFERENT APPROACH: Legacy Admins do NOT get the Landing Page anymore.
    if (isMain || hasBlacklist) {
        // Switch to Admin Mode on Landing Page
        const loginUI = document.getElementById('loginUI');
        const adminControls = document.getElementById('adminLandingControls');
        if (loginUI) loginUI.classList.add('hidden');
        if (adminControls) adminControls.classList.remove('hidden');
    } else {
        // Students OR Admins without blacklist access go to binder
        window.location.href = 'web2.html';
    }
}

// --- ADMIN CHOICE HANDLING ---
window.chooseAdminPath = function (path) {
    if (adminChoiceModal) adminChoiceModal.classList.add('hidden');

    if (path === 'manage') {
        showAdminPanel('Bitancutiepie (Admin)');
    } else if (path === 'dashboard') {
        window.location.href = 'web2.html';
    }
}

async function showAdminPanel(name) {
    // SECURITY: Double check against DB before showing sensitive panel
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);

    // Verify against DB (Client-side barrier)
    const { data } = await supabaseClient.from('students').select('role, sr_code').eq('id', u.id).single();

    // Check Permissions
    const isMainAdmin = (data && data.sr_code === 'ADMIN');
    const isLegacyAdmin = (data && data.role === 'admin');
    const hasBlacklistPerm = (data && data.role && data.role.startsWith('admin:tools:') && data.role.split(':')[2].split(',').includes('blacklist'));

    // STRICT CHECK: Only Main Admin or Explicit Blacklist Permission
    // We removed isLegacyAdmin from this check to "different approach" the access.
    if (!data || (!isMainAdmin && !hasBlacklistPerm)) {
        showToast("Nice try. Access Denied (Blacklist Restricted).", "error");
        setTimeout(() => window.location.reload(), 1000);
        return;
    }

    authSection.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    adminNameDisplay.innerText = name;
    fetchStudents();
    fetchRequests(); // Load requests when admin panel opens
    fetchAdminFiles(); // Load files

    // Toggle Mobile Navs
    const fixedNav = document.getElementById('fixed-action-buttons');
    const adminNav = document.getElementById('admin-mobile-nav');
    if (fixedNav) fixedNav.classList.add('hidden');
    if (adminNav) adminNav.classList.remove('hidden');
}

// --- ADMIN FEATURES (Black List) ---

async function fetchStudents() {
    allStudents = await getStudentsWithDetails();
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

    // Filter groups
    const notEnrolled = validStudents.filter(s => !s.enrollment_status || s.enrollment_status === 'Not Enrolled');
    const enrolled = validStudents.filter(s => s.enrollment_status === 'Enrolled');

    // Helper function to render a section
    const renderSection = (title, list, color) => {
        if (list.length === 0) return;

        const section = document.createElement('div');
        section.style.marginBottom = '20px';

        const header = document.createElement('h4');
        header.style.cssText = `margin: 0 0 10px 0; border-bottom: 2px solid ${color}; padding-bottom: 5px; color: ${color}; text-align: left; text-transform: uppercase;`;
        header.innerText = `${title} (${list.length})`;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px;';

        list.forEach(student => {
            const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;

            const chip = document.createElement('div');
            chip.className = 'member-tag';
            chip.style.cssText = `cursor: pointer; padding: 5px 10px; font-size: 0.9rem; background: #fff; border: 2px solid ${color}; display: flex; align-items: center; gap: 8px; transition: transform 0.2s;`;
            chip.onmouseover = () => chip.style.transform = 'scale(1.05)';
            chip.onmouseout = () => chip.style.transform = 'scale(1)';
            chip.onclick = () => openStudentDetails(student.id);

            chip.innerHTML = `
                <img src="${avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid ${color};">
                <span style="font-weight:bold; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(student.name)}</span>
                <i class="fas fa-sign-in-alt" style="color:${color}; margin-left: auto; padding: 5px; cursor: pointer; font-size: 1rem;" 
                   onclick="event.stopPropagation(); openPortalWithHelper('${student.sr_code}', '${student.password}', '${student.name}')" 
                   title="Auto-Login to Portal"></i>
            `;
            grid.appendChild(chip);
        });
        section.appendChild(grid);
        studentListContainer.appendChild(section);
    };

    renderSection('Not Enrolled', notEnrolled, '#d63031');
    renderSection('Enrolled', enrolled, '#00b894');

    if (notEnrolled.length === 0 && enrolled.length === 0) {
        studentListContainer.innerHTML = '<p style="text-align:center; color:#666;">No students found (Filtered by Enrolled/Not Enrolled).</p>';
    }
}

async function deleteStudent(id) {
    // Check if user is admin
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);

    // Check ADMIN, Legacy admin, OR Granular Admin (admin:tools:...)
    // This allows anyone with ANY admin tool to delete students (Restoring access)
    // Ideally use hasPermission('blacklist'), but we are allowing all granular admins for now.
    const isAuthorized = (u.sr_code === 'ADMIN') || (u.role === 'admin') || (u.role && u.role.startsWith('admin:tools:'));

    if (!isAuthorized) return showToast('You are not authorized.', 'error');

    if (!await showWimpyConfirm('Scratch this person out specifically?')) return;
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
    // SECURITY CHECK: Only Admins can IMPERSONATE
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!storedUser) return;
    const u = JSON.parse(storedUser);

    // Check ADMIN, Legacy admin, OR Granular Admin
    const isAuthorized = (u.sr_code === 'ADMIN') || (u.role === 'admin') || (u.role && u.role.startsWith('admin:tools:'));

    if (!isAuthorized) {
        return showToast('Nice try, impersonator.', 'error');
    }

    if (!await showWimpyConfirm('Switch view to ' + name + '?')) return;
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

// --- SHARED ENROLLMENT LOGIC ---
window.updateStudentEnrollment = async function (id, status, file, btn) {
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Saving...";
    }

    let updateData = { enrollment_status: status };
    let finalReceiptUrl = null;

    if (file) {
        try {
            const fileName = `receipt_${id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('class-resources')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from('class-resources').getPublicUrl(fileName);
            finalReceiptUrl = data.publicUrl;

            // WORKAROUND: Save to shared_files table instead of students table
            await supabaseClient.from('shared_files').delete().eq('subject', `Receipt-${id}`);
            await supabaseClient.from('shared_files').insert([{
                title: 'Enrollment Receipt',
                subject: `Receipt-${id}`,
                file_url: finalReceiptUrl,
                file_type: file.type
            }]);

            // Update local cache
            const s = allStudents.find(st => st.id == id);
            if (s) s.enrollment_receipt_url = finalReceiptUrl;
        } catch (err) {
            if (typeof showToast !== 'undefined') showToast("Upload failed: " + err.message, "error");
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Update Enrollment";
            }
            return { error: err };
        }
    }

    const { error } = await supabaseClient.from('students').update(updateData).eq('id', id);

    if (error) {
        if (typeof showToast !== 'undefined') showToast("Error: " + error.message, "error");
    } else {
        if (typeof showToast !== 'undefined') showToast("Enrollment updated!");
        const s = allStudents.find(st => st.id == id);
        if (s) {
            s.enrollment_status = status;
            // AUTO-DELETE RECEIPT if status is changed to Not Enrolled
            if (status === 'Not Enrolled' && s.enrollment_receipt_url) {
                if (await showWimpyConfirm(`Removing Enrollment? This will also DELETE the receipt for ${s.name}. proceed?`)) {
                    await supabaseClient.from('shared_files').delete().eq('subject', `Receipt-${id}`);
                    delete s.enrollment_receipt_url;
                    if (typeof showToast !== 'undefined') showToast("Receipt removed.");
                }
            }
        }
        fetchMembers();
        displayStudents(allStudents); // Refresh Admin List too
    }

    if (btn) {
        btn.disabled = false;
        btn.innerText = "Update Enrollment";
    }
    return { error, receiptUrl: finalReceiptUrl };
};

// --- STUDENT DETAILS MODAL ---
window.openStudentDetails = function (id) {
    const student = allStudents.find(s => s.id == id);
    if (!student) return;

    const modal = document.getElementById('studentDetailsModal');
    const content = document.getElementById('studentDetailsContent');
    const avatar = student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;

    const safeName = student.name.replace(/'/g, "\\'");
    const safeCode = student.sr_code.replace(/'/g, "\\'");
    const safeAvatar = (student.avatar_url || '').replace(/'/g, "\\'");
    const currentStatus = student.enrollment_status || 'Not Enrolled';

    const receiptLink = student.enrollment_receipt_url ? `
        <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
            <a href="#" onclick="viewFullImage('${student.enrollment_receipt_url}')" style="color:#0984e3; font-size:0.9rem; text-decoration:none;">
                <i class="fas fa-receipt"></i> View Current Receipt
            </a>
            <button onclick="deleteReceipt('${student.id}')" class="sketch-btn danger" style="padding:2px 8px; font-size:0.8rem; width:auto; margin:0;" title="Delete Receipt">
                <i class="fas fa-trash"></i>
            </button>
        </div>` : '';

    content.innerHTML = `
        <img src="${avatar}" style="width:100px; height:100px; border-radius:50%; border:3px solid #000; margin-bottom:15px; object-fit:cover;">
        <h2 style="margin:0;">${escapeHTML(student.name)}</h2>
        <p style="color:#666; margin-top:5px;">${escapeHTML(student.email) || 'No Email'}</p>
        
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
            <select id="statusSelect-${student.id}" style="width:100%; padding:8px; margin-top:5px; font-family:'Patrick Hand'; border:2px solid #000; background:#fff;">
                <option value="Not Enrolled" ${currentStatus === 'Not Enrolled' ? 'selected' : ''}>Not Enrolled</option>
                <option value="Enrolled" ${currentStatus === 'Enrolled' ? 'selected' : ''}>Enrolled</option>
            </select>
            <div style="margin-top:10px;">
                <strong><i class="fas fa-file-upload"></i> Upload Receipt (Optional):</strong> <small style="color:#666;">(or Paste Image Ctrl+V)</small>
                <input type="file" id="receiptInput-${student.id}" accept="image/*" style="width:100%; margin-top:5px; font-size:0.9rem;">
                ${receiptLink}
            </div>
            <button id="btn-save-enroll-${student.id}" onclick="saveEnrollment('${student.id}')" class="sketch-btn" style="margin-top:10px; width:100%; background:#00b894; color:#fff;">Update Enrollment</button>
        </div>



        <div style="display:flex; gap:10px; flex-direction:column;">
            <button onclick="openPortalWithHelper('${safeCode}', '${student.password}', '${student.name}')" class="sketch-btn" style="background:#00b894; color:#fff;">
                <i class="fas fa-external-link-alt"></i> Login to Portal (Turbo Fill)
            </button>
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

window.saveEnrollment = async function (id) {
    const select = document.getElementById(`statusSelect-${id}`);
    const fileInput = document.getElementById(`receiptInput-${id}`);
    const btn = document.getElementById(`btn-save-enroll-${id}`);

    if (!select) return;

    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const result = await window.updateStudentEnrollment(id, select.value, file, btn);

    if (!result.error) closeStudentDetails();
};

window.deleteReceipt = async function (studentId) {
    // Admin check inside
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        const isAuthorized = (u.sr_code === 'ADMIN') || (u.role === 'admin') || (u.role && u.role.startsWith('admin:tools:'));
        if (!isAuthorized) return showToast('Only Admin can delete receipts.', 'error');
    }

    if (!await showWimpyConfirm('Delete this student\'s enrollment receipt?')) return;

    const { error } = await supabaseClient
        .from('shared_files')
        .delete()
        .eq('subject', `Receipt-${studentId}`);

    if (error) {
        showToast('Error deleting receipt.', 'error');
    } else {
        showToast('Receipt deleted.');
        // Update local cache
        const s = allStudents.find(st => st.id == studentId);
        if (s) delete s.enrollment_receipt_url;

        openStudentDetails(studentId); // Refresh modal
        fetchMembers(); // Refresh list
    }
}


window.closeStudentDetails = function () {
    document.getElementById('studentDetailsModal').classList.add('hidden');
}

// --- PORTAL POP-UP LOGIC ---
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

// --- TURBO TILING LOGIC (The Modern Way) ---
// --- TURBO TILING LOGIC (The Modern Way) ---
window.launchTurboTiling = function (srCode, password, name) {
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;

    // 1. Calculate Sizes
    const remoteWidth = Math.floor(screenW * 0.30);
    const portalWidth = Math.floor(screenW * 0.70);

    // 2. Open Portal Window (Right Side)
    const portalWin = window.open(
        "https://dione.batstate-u.edu.ph/student/#/",
        "BatStatePortal",
        `width=${portalWidth},height=${screenH},left=${remoteWidth},top=0,resizable=yes,scrollbars=yes`
    );

    // Prepare student data for the remote
    const studentData = allStudents.map(s => ({
        id: s.id,
        name: s.name,
        sr_code: s.sr_code,
        password: s.password,
        enrollment_status: s.enrollment_status || 'Not Enrolled',
        enrollment_receipt_url: s.enrollment_receipt_url || '',
        avatar_url: s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`
    })).filter(s => s.sr_code !== 'ADMIN');

    // 3. Open Remote Control Window (Left Side) using a Data URI
    const remoteHTML = `
        <html>
        <head>
            <title>Turbo Remote</title>
            <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
            <style>
                body { font-family: 'Patrick Hand', cursive; background: #fcf5e5; padding: 20px; border: 5px solid #000; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
                .card { background: #fff; border: 3px solid #000; padding: 15px; box-shadow: 4px 4px 0 #000; margin-bottom: 20px; transform: rotate(-1deg); }
                button { width: 100%; padding: 12px; margin: 8px 0; font-family: inherit; font-size: 1.2rem; cursor: pointer; border: 2px solid #000; transition: transform 0.1s; box-shadow: 3px 3px 0 #000; background: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
                button:active { transform: scale(0.98); box-shadow: 1px 1px 0 #000; }
                .btn-copy-user { border-left: 10px solid #0984e3; }
                .btn-copy-pass { border-left: 10px solid #d63031; }
                .btn-done { background: #d63031; color: white; margin-top: auto; padding: 10px; font-size: 1.1rem; }
                h2 { margin: 0; border-bottom: 2px dashed #000; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center; }
                .tip { background: #fff740; padding: 10px; border: 2px solid #000; font-size: 0.9rem; margin-top: 10px; }
                
                .enroll-section { background: #f1f2f6; border: 2px solid #000; padding: 10px; margin-top: 10px; border-radius: 5px; text-align: left; }
                .enroll-section label { display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem; }
                select, input[type="file"] { width: 100%; padding: 5px; font-family: inherit; border: 1px solid #000; margin-bottom: 8px; box-sizing: border-box; }
                .enroll-btn { background: #00b894; color: #fff; padding: 8px; font-size: 1rem; margin: 5px 0; border-left: 10px solid #006266; }
                .receipt-link { font-size: 0.8rem; color: #0984e3; text-decoration: none; display: block; margin-top: 5px; }
                
                #search-container { margin-bottom: 15px; display: none; flex-direction: column; height: 350px; }
                #search-input { width: 100%; padding: 10px; border: 2px solid #000; font-family: inherit; font-size: 1.1rem; box-sizing: border-box; margin-bottom: 10px; }
                #search-results { flex: 1; background: #fff; border: 2px solid #000; overflow-y: auto; padding: 10px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; }
                
                .student-chip { 
                    background: #fff; border: 2px solid #333; padding: 5px 10px; border-radius: 20px; font-size: 0.9rem; 
                    box-shadow: 2px 2px 0 rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: transform 0.1s;
                    max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .student-chip:hover { transform: scale(1.05); }
                .student-chip.active { background: #00b894; color: white; border-color: #000; }
                .student-chip img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; border: 1px solid #000; }
                
                .switch-btn { background: #2d3436; color: #fff; font-size: 0.9rem; padding: 5px 10px; width: auto; box-shadow: 2px 2px 0 #000; margin: 0; }
                .current-avatar { width: 50px; height: 50px; border-radius: 50%; border: 3px solid #000; object-fit: cover; }
                #student-display { display: flex; align-items: center; gap: 15px; }
            </style>
        </head>
        <body>
            <h2>
                <span><i class="fas fa-bolt"></i> TURBO REMOTE</span>
                <button class="switch-btn" onclick="toggleSearch()"><i class="fas fa-users"></i> LIST</button>
            </h2>

            <div id="search-container">
                <input type="text" id="search-input" placeholder="Search..." oninput="filterStudents()">
                <div id="search-results"></div>
            </div>

            <div class="card" id="student-display">
                <img id="display-avatar" src="${studentData.find(s => s.sr_code === srCode)?.avatar_url}" class="current-avatar">
                <div>
                    <small>LOGGING IN AS:</small>
                    <div id="display-name" style="font-size: 1.4rem; font-weight: bold;">${name}</div>
                    <div id="display-code" style="color: #666;">SR: ${srCode}</div>
                </div>
            </div>
            
            <button class="btn-copy-user" onclick="handleCopy('user')">
                <i class="fas fa-user-edit"></i> 1. COPY SR CODE
            </button>
            <button class="btn-copy-pass" onclick="handleCopy('pass')">
                <i class="fas fa-key"></i> 2. COPY PASSWORD
            </button>

            <div class="enroll-section">
                <label><i class="fas fa-user-check"></i> ENROLLMENT STATUS</label>
                <select id="status-select">
                    <option value="Not Enrolled">Not Enrolled</option>
                    <option value="Enrolled">Enrolled</option>
                </select>
                
                <label><i class="fas fa-file-upload"></i> UPLOAD RECEIPT</label>
                <input type="file" id="receipt-input" accept="image/*">
                <a id="receipt-preview" href="#" class="receipt-link" target="_blank" style="display:none;">
                    <i class="fas fa-eye"></i> View Current Receipt
                </a>
                
                <button class="enroll-btn" id="save-btn" onclick="updateEnrollment()">
                    <i class="fas fa-save"></i> UPDATE STATUS
                </button>
            </div>

            <div class="tip">
                <b>TIP:</b> Paste into the portal on the RIGHT. Use the <b>SWITCH</b> button above to cycle through students!
            </div>

            <button class="btn-done" onclick="window.close()">DONE / CLOSE</button>

            <script>
                const students = ${JSON.stringify(studentData)};
                let current = students.find(s => s.sr_code === "${srCode}");

                function init() {
                    if (current) syncUI();
                }

                function syncUI() {
                    document.getElementById('display-name').innerText = current.name;
                    document.getElementById('display-code').innerText = 'SR: ' + current.sr_code;
                    document.getElementById('display-avatar').src = current.avatar_url;
                    document.getElementById('status-select').value = current.enrollment_status;
                    
                    const receiptLink = document.getElementById('receipt-preview');
                    if (current.enrollment_receipt_url) {
                        receiptLink.href = current.enrollment_receipt_url;
                        receiptLink.style.display = 'block';
                    } else {
                        receiptLink.style.display = 'none';
                    }
                }
                function toggleSearch() {
                    const container = document.getElementById('search-container');
                    const isOpening = container.style.display !== 'block';
                    container.style.display = isOpening ? 'block' : 'none';
                    if (isOpening) {
                        renderResults(students); // Show all students by default
                        document.getElementById('search-input').focus();
                    }
                }

                function filterStudents() {
                    const query = document.getElementById('search-input').value.toLowerCase();
                    const filtered = students.filter(s => 
                        s.name.toLowerCase().includes(query) || 
                        s.sr_code.toLowerCase().includes(query)
                    );
                    renderResults(filtered);
                }

                function renderResults(list) {
                    const results = document.getElementById('search-results');
                    results.innerHTML = '';
                    
                    if (list.length === 0) {
                        results.innerHTML = '<div style="text-align:center; color:#999; width:100%;">No one found...</div>';
                        return;
                    }

                    list.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
                        const chip = document.createElement('div');
                        chip.className = 'student-chip' + (s.sr_code === current.sr_code ? ' active' : '');
                        chip.innerHTML = '<img src="' + s.avatar_url + '"><span title="' + s.name + '">' + s.name + '</span>';
                        chip.onclick = () => selectStudent(s);
                        results.appendChild(chip);
                    });
                }
                function selectStudent(s) {
                    current = s;
                    syncUI();
                    document.getElementById('search-container').style.display = 'none';
                    document.getElementById('search-input').value = '';
                    showToast(s.name + " selected!");
                }

                async function updateEnrollment() {
                    const status = document.getElementById('status-select').value;
                    const fileInput = document.getElementById('receipt-input');
                    const file = fileInput.files[0];
                    const btn = document.getElementById('save-btn');
                    
                    if (!window.opener || !window.opener.updateStudentEnrollment) {
                        showToast("ERROR: Connection to main window lost.");
                        return;
                    }

                    btn.disabled = true;
                    btn.innerText = "SAVING...";

                    const result = await window.opener.updateStudentEnrollment(current.id, status, file, null);

                    if (!result.error) {
                        current.enrollment_status = status;
                        if (result.receiptUrl) current.enrollment_receipt_url = result.receiptUrl;
                        syncUI();
                        showToast("SUCCESS! Updated Status.");
                    } else {
                        showToast("ERROR: " + result.error.message);
                    }

                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> UPDATE STATUS';
                    fileInput.value = '';
                }
                
                window.onload = init;

function handleCopy(type) {
    const text = type === 'user' ? current.sr_code : current.password;
    const label = type === 'user' ? 'SR Code' : 'Password';
    navigator.clipboard.writeText(text).then(() => {
        showToast(label + " Copied!");
    });
}

function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#00b894; color:white; padding:8px 15px; border:2px solid #000; z-index:1000; box-shadow: 4px 4px 0 #000; pointer-events: none;";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
}
            </script >
        </body >
        </html >
    `;

    const remoteWin = window.open(
        "",
        "TurboRemote",
        `width = ${remoteWidth}, height = ${screenH}, left = 0, top = 0, resizable = yes, scrollbars = yes`
    );
    remoteWin.document.write(remoteHTML);
}

// --- PORTAL AUTOMATION HELPER ---
window.openPortalWithHelper = function (srCode, password, name) {
    // SECURITY: Use the Tiling method for guaranteed cookie success
    if (confirm("Launch TURBO TILING? \\n\\nThis will open the portal and login tools side-by-side for 100% login success.")) {
        launchTurboTiling(srCode, password, name);
    } else {
        // Fallback to standard popup if they cancel
        openPortalWindow();
    }
};

window.openTurboSplitView = function () { console.warn("Split View disabled due to Portal cookie policy. Using Turbo Tiling instead."); };

// --- OTHER FEATURES ---
async function fetchMembers() {
    const refreshIcon = document.getElementById('classListRefreshIcon');
    if (refreshIcon) {
        refreshIcon.classList.add('spin-animation');
    }

    try {
        // 1. Fetch Students and Receipts using CENTRALIZED HELPER
        const students = await getStudentsWithDetails();
        if (students.length === 0) return; // Error handled inside or list is empty

        // 2. Fetch Statuses
        const { data: statuses } = await window.db.from('user_statuses').select('user_id, status');

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

        const publicMemberList = document.getElementById('publicMemberList');
        if (publicMemberList) {
            publicMemberList.innerHTML = '';

            // Filter valid members first (Exclude Admin/Principal)
            const validMembers = students.filter(s => s.sr_code !== 'ADMIN' && s.role !== 'admin' && s.name !== 'Principal User' && !s.name.includes('Admin'));

            // Update Badge with Animation
            const badge = document.getElementById('memberCountBadge');
            if (badge) {
                badge.innerText = validMembers.length;
                badge.classList.remove('pop');
                void badge.offsetWidth; // Trigger reflow to restart animation
                badge.classList.add('pop');
            }

            if (validMembers.length === 0) {
                publicMemberList.innerHTML = '<span style="font-style:italic">No members yet...</span>';
            } else {
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
                        <span style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(student.name)}</span>
                    `;
                    publicMemberList.appendChild(tag);
                });
            }
        }

        // --- POPULATE ENROLLMENT BOARD (Right Side) ---
        const enrolledList = document.getElementById('enrolled-list');
        const notEnrolledList = document.getElementById('not-enrolled-list');

        if (enrolledList && notEnrolledList) {
            const enrolled = students.filter(s => s.enrollment_status === 'Enrolled');
            const notEnrolled = students.filter(s => s.enrollment_status !== 'Enrolled' && s.sr_code !== 'ADMIN' && s.role !== 'admin');

            // Update Counts
            const countIn = document.getElementById('count-in');
            const countOut = document.getElementById('count-out');
            if (countIn) countIn.innerText = enrolled.length;
            if (countOut) countOut.innerText = notEnrolled.length;

            const generateTag = (s, isEnrolled) => {
                const safeAvatar = s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`;
                const hasReceipt = s.enrollment_receipt_url;
                const safeName = s.name.replace(/'/g, "\\'");
                const cursorStyle = hasReceipt ? 'cursor: pointer;' : 'cursor: default;';

                // Hover Events for Preview
                const hoverEvents = hasReceipt
                    ? `onmouseenter="showReceiptHover(event, '${s.enrollment_receipt_url}')" onmousemove="moveReceiptHover(event)" onmouseleave="hideReceiptHover()"`
                    : '';

                const tagAction = hasReceipt ? `onclick="openReceiptPreview('${safeName}', '${s.enrollment_receipt_url}')" title="View Receipt"` : '';
                const icon = hasReceipt ? `<i class="fas fa-receipt" style="font-size:0.8rem; color:#0984e3; margin-left:5px;"></i>` : '';

                return `
                    <div class="member-tag" style="${cursorStyle}" ${tagAction} ${hoverEvents}>
                        <img src="${safeAvatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid #333; flex-shrink: 0;">
                        <span style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${escapeHTML(s.name)}</span>
                        ${icon}
                    </div>
                 `;
            };

            enrolledList.innerHTML = enrolled.length ? enrolled.map(s => generateTag(s, true)).join('') : '<div style="width:100%; text-align:center; color:#666;">None yet</div>';
            notEnrolledList.innerHTML = notEnrolled.length ? notEnrolled.map(s => generateTag(s, false)).join('') : '<div style="width:100%; text-align:center; color:#666;">Everyone is in!</div>';
        }
    } finally {
        if (refreshIcon) {
            refreshIcon.classList.remove('spin-animation');
        }
    }
}

// --- JUMPSCARE LOGIC ---
function startJumpscareTimer() {
    setInterval(() => {
        const authSection = document.getElementById('authSection');
        // Only trigger if we are on the landing page (auth section is visible)
        if (authSection && !authSection.classList.contains('hidden')) {
            const overlay = document.getElementById('jumpscare-overlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                setTimeout(() => {
                    overlay.classList.add('hidden');
                }, 500);
            }
        }
    }, 20000);
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
            <h2 style="margin-bottom:15px;">${escapeHTML(name)}</h2>
            <div style="padding:10px; border:2px dashed #ccc; display:inline-block; border-radius:50%;">
                <img src="${safeAvatar}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:2px solid #000;">
            </div>
            <p style="margin-top:15px; font-style:italic;">"${escapeHTML(status) || 'Member'}"</p>
            ${contactBtn}
            <button onclick="document.getElementById('publicProfileModal').style.display='none'">CLOSE</button>
        </div>
    `;
    modal.style.display = 'flex';
}

async function fetchRecentLogins() {
    const container = document.getElementById('recentLoginsList');
    if (!container) return;
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
                <span>${escapeHTML(student.name)}</span>
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
        if (u.sr_code === 'ADMIN' || u.role === 'admin') isAdmin = true;
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
        div.style.left = (note.x_pos || 0) + '%';
        div.style.top = (note.y_pos || 0) + '%';
        div.style.transform = `rotate(${note.rotation}deg)`;

        // Apply Wimpy Style (Color or Lined)
        if (note.color) div.classList.add(note.color);

        // Delete Button (Only if Admin)
        if (isAdmin) {
            const btn = document.createElement('button');
            btn.className = 'delete-note-btn';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.title = "Delete Note";
            btn.style.display = 'flex';
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
        if (likedNotes.includes(note.id)) likeBtn.classList.add('liked');

        likeBtn.innerHTML = `<i class="fas fa-heart"></i> <span class="like-count">${note.likes || 0}</span>`;
        // Stop propagation to prevent dragging when clicking like
        likeBtn.onmousedown = (e) => e.stopPropagation();
        likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(note.id); };
        div.appendChild(likeBtn);

        makeDraggable(div, note.id);
        noteLayer.appendChild(div);
    });
    setTimeout(resolveCollisions, 200);
}

window.toggleLike = async function (id) {
    let likedNotes = [];
    try {
        likedNotes = JSON.parse(localStorage.getItem('liked_notes') || '[]');
    } catch (e) {
        localStorage.removeItem('liked_notes');
    }
    const isLiked = likedNotes.includes(id);
    const el = document.getElementById(`note-${id}`);

    // Optimistic UI Update (Immediate feedback)
    if (el) {
        const btn = el.querySelector('.like-sticker');
        const countSpan = el.querySelector('.like-count');
        let count = parseInt(countSpan.innerText) || 0;

        if (isLiked) {
            // Unlike
            const newLiked = likedNotes.filter(n => n !== id);
            try { localStorage.setItem('liked_notes', JSON.stringify(newLiked)); } catch (e) { }
            btn.classList.remove('liked');
            countSpan.innerText = Math.max(0, count - 1);

            // Update DB - Revert if failed
            const success = await updateLikesInDb(id, -1);
            if (!success) {
                // Revert UI
                try { localStorage.setItem('liked_notes', JSON.stringify(likedNotes)); } catch (e) { } // Put back
                btn.classList.add('liked');
                countSpan.innerText = count;
                showToast("Connection failed. Like not saved.", "error");
            }
        } else {
            // Like
            likedNotes.push(id);
            try { localStorage.setItem('liked_notes', JSON.stringify(likedNotes)); } catch (e) { }
            btn.classList.add('liked');
            countSpan.innerText = count + 1;

            // Update DB - Revert if failed
            const success = await updateLikesInDb(id, 1);
            if (!success) {
                // Revert UI
                const revertedLiked = likedNotes.filter(n => n !== id);
                try { localStorage.setItem('liked_notes', JSON.stringify(revertedLiked)); } catch (e) { }
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

        if (fetchError) {
            console.error("Error fetching like count:", fetchError.message, fetchError.details || '');
            return false;
        }

        const newCount = Math.max(0, (data?.likes || 0) + change);
        const { error: updateError } = await supabaseClient.from('notes').update({ likes: newCount }).eq('id', id);

        if (updateError) {
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
            if (payload.eventType === 'INSERT') {
                fetchNotes(); // New note added, refresh board
            } else if (payload.eventType === 'DELETE') {
                const el = document.getElementById(`note-${payload.old.id}`);
                if (el) el.remove();
            } else if (payload.eventType === 'UPDATE') {
                const el = document.getElementById(`note-${payload.new.id}`);
                if (el) {
                    // Update Like Count
                    const countSpan = el.querySelector('.like-count');
                    if (countSpan) countSpan.innerText = payload.new.likes || 0;

                    // Update Position (Only if changed significantly, to avoid jitter)
                    // We skip this if the user is currently dragging it (checked via class or state if needed)
                    // For now, we just update likes to be "responsive" as requested.
                }
            }
        })
        .subscribe();
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
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) showToast("Could not delete note.", "error");
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

        // Bring to front
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

    function elementDrag(e) { e = e || window.event; let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX; let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY; pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY; element.style.top = (element.offsetTop - pos2) + "px"; element.style.left = (element.offsetLeft - pos1) + "px"; }

    function closeDragElement() {
        // Reset z-index slightly so it doesn't stay 'active' forever, or keep it high
        element.style.zIndex = 'auto';
        const parent = element.parentElement;

        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;

        // FIX: Check if parent has dimensions to avoid NaN/Infinity errors
        if (!parent || parent.offsetWidth <= 0 || parent.offsetHeight <= 0) return;

        // FIX: Only update if actually moved (prevents 400 errors on simple clicks)
        if (Math.abs(element.offsetLeft - startLeft) < 2 && Math.abs(element.offsetTop - startTop) < 2) return;

        const xPercent = (element.offsetLeft / parent.offsetWidth) * 100;
        const yPercent = (element.offsetTop / parent.offsetHeight) * 100;
        resolveCollisions();
        updateNotePosition(noteId, xPercent, yPercent);
    }
}
async function updateNotePosition(id, x, y) {
    // FIX: Ensure values are valid numbers before sending to DB
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    x = parseFloat(Math.max(0, Math.min(x, 95)).toFixed(2));
    y = parseFloat(Math.max(0, Math.min(y, 95)).toFixed(2));
    await supabaseClient.from('notes').update({ x_pos: x, y_pos: y }).eq('id', id);
}

// --- FREEDOM WALL MODAL (Landing Page) ---
window.openFreedomWall = function () {
    document.getElementById('freedomWallModal').classList.remove('hidden');

    // Check for Admin to show controls
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code === 'ADMIN' || u.role === 'admin') {
            const controls = document.getElementById('fw-admin-controls');
            if (controls) controls.classList.remove('hidden');
        }
    }

    fetchNotes(); // Refresh notes when opening
    setTimeout(resolveCollisions, 300);
    // Auto-focus the input for instant accessibility
    setTimeout(() => {
        const input = document.getElementById('fw-landing-input');
        if (input) input.focus();
    }, 100);
}
window.closeFreedomWall = function () {
    document.getElementById('freedomWallModal').classList.add('hidden');
}

// --- COLOR SELECTION ---
window.selectColor = function (el, color) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('fw-landing-color').value = color;
}

window.postLandingNote = async function () {
    const input = document.getElementById('fw-landing-input');
    const btn = document.getElementById('fw-landing-btn');
    const text = input.value.trim();

    if (!text) return showToast('Write something first!', 'error');

    if (btn) btn.disabled = true; // Prevent spam

    // Random Position & Style
    const randomX = Math.floor(Math.random() * 80) + 10;
    const randomY = Math.floor(Math.random() * 80) + 10;
    const rotation = Math.floor(Math.random() * 20) - 10;
    const selectedColor = document.getElementById('fw-landing-color').value || 'white';

    const { error } = await supabaseClient.from('notes').insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: selectedColor, likes: 0 }]);

    if (btn) btn.disabled = false;

    if (error) showToast('Failed to post.', 'error');
    else { showToast('Note posted!'); input.value = ''; fetchNotes(); }
}

// logout removed (in common.js)

// Function to return to the admin choice modal from the admin dashboard
function returnToAdminChoice() {
    adminDashboard.classList.add('hidden');
    // Show landing page again (which has admin controls)
    const authSection = document.getElementById('authSection');
    if (authSection) authSection.classList.remove('hidden');

    // Reset Mobile Navs
    const fixedNav = document.getElementById('fixed-action-buttons');
    const adminNav = document.getElementById('admin-mobile-nav');
    if (fixedNav) fixedNav.classList.remove('hidden');
    if (adminNav) adminNav.classList.add('hidden');
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
            <div class="update-img-container" onclick="viewFullImage('assets/images/Beforeimg.png')">
                <div style="font-weight: bold; background: #bdc3c7; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(-3deg); border: 2px solid #000; position: absolute; top: -12px; left: -5px; z-index: 2; font-size: 0.8rem;">BEFORE:</div>
                <img src="assets/images/Beforeimg.png" alt="Old Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
            </div>
            <div class="update-arrow">→</div>
            <div class="update-img-container" onclick="viewFullImage('assets/images/Afterimg.png')">
                <div style="font-weight: bold; background: #ffee58; color: #000; display: inline-block; padding: 2px 10px; transform: rotate(3deg); border: 2px solid #000; position: absolute; top: -12px; right: -5px; z-index: 2; font-size: 0.8rem;">NOW:</div>
                <img src="assets/images/Afterimg.png" alt="New Website" style="width: 100%; height: auto; border: 3px solid #000; box-shadow: 4px 4px 0 rgba(0,0,0,0.2); background: #fff; transition: transform 0.2s;">
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

// --- CONGRATS MESSAGE ---
window.showCongratsMessage = function (prevModal) {
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

        var interval = setInterval(function () {
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
        .neq('subject', 'General')
        .neq('subject', 'PENDING_MEMORY')
        .not('subject', 'like', 'Receipt-%')
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
    if (!container || !section) return;

    const { data, error } = await supabaseClient
        .from('shared_files')
        .select('*')
        .eq('subject', 'LandingGallery')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        section.classList.add('hidden');
        return;
    }

    // Check for Admin
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    let isAdmin = false;
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code === 'ADMIN' || u.role === 'admin') isAdmin = true;
    }

    const trigger = document.getElementById('admin-gallery-add-trigger');
    if (trigger) {
        if (isAdmin) trigger.classList.remove('hidden');
        else trigger.classList.add('hidden');
    }

    galleryItems = data; // Store for lightbox
    section.classList.remove('hidden');
    container.innerHTML = data.map((item, index) => {
        const deleteBtn = isAdmin ? `<button onclick="event.stopPropagation(); deleteAdminFile(${item.id})" class="sketch-btn danger" style="position:absolute; top:-10px; right:-10px; width:30px !important; height:30px !important; border-radius:50% !important; padding:0 !important; display:flex; align-items:center; justify-content:center; z-index:20; font-size:0.9rem;">X</button>` : '';
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
window.openGalleryLightbox = function (startIndex) {
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
    const next = (e) => { if (e) e.stopPropagation(); currentIndex = (currentIndex + 1) % galleryItems.length; updateImage(currentIndex); };
    const prev = (e) => { if (e) e.stopPropagation(); currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length; updateImage(currentIndex); };
    const close = () => { document.removeEventListener('keydown', keyHandler); overlay.remove(); };

    prevBtn.onclick = prev;
    nextBtn.onclick = next;
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', keyHandler);

    imgContainer.appendChild(img);
    overlay.append(closeBtn, prevBtn, imgContainer, nextBtn, caption);
    document.body.appendChild(overlay);
    updateImage(currentIndex);
}

// --- CUSTOM WIMPY POP-UP ---
// showWimpyConfirm removed (in common.js)

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
    if (!container) return;

    container.innerHTML = '<p>Checking suggestion box...</p>';

    const { data, error } = await supabaseClient
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    if (!data || data.length === 0) {
        container.innerHTML = '<h3 style="text-decoration:underline wavy #d63031;"><i class="fas fa-envelope-open-text"></i> Inbox / Requests</h3><p style="text-align:center; color:#666;">No new requests.</p>';
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

window.deleteRequest = async function (id) {
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code !== 'ADMIN' && u.role !== 'admin') return showToast('Unauthorized action.', 'error');
    }

    if (!await showWimpyConfirm('Burn this note?')) return;
    await supabaseClient.from('requests').delete().eq('id', id);
    fetchRequests();
}

// --- ADMIN FILE MANAGER (To delete memories/uploads) ---
async function fetchAdminFiles() {
    const container = document.getElementById('adminFileList');
    if (!container) return;

    container.innerHTML = '<p>Loading files...</p>';

    const { data, error } = await supabaseClient
        .from('shared_files')
        .select('*')
        .neq('subject', 'LandingGallery')
        .not('subject', 'like', 'Receipt-%')
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    if (!data || data.length === 0) {
        container.innerHTML = '<h3 style="text-decoration:underline wavy #0984e3;"><i class="fas fa-folder-open"></i> Manage Files</h3><p style="text-align:center; color:#666;">No files uploaded.</p>';
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

window.deleteAdminFile = async function (id) {
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code !== 'ADMIN' && u.role !== 'admin') return showToast('Unauthorized action.', 'error');
    }

    if (!await showWimpyConfirm('Delete this file permanently?')) return;
    const { error } = await supabaseClient.from('shared_files').delete().eq('id', id);
    if (error) showToast('Error deleting file.', 'error');
    else {
        showToast('File deleted.');
        fetchAdminFiles();
        fetchNewUploads(); // Refresh the public list too
        fetchLandingGallery(); // Refresh gallery if applicable
    }
}

// --- FILE PREVIEWER MODAL ---
window.openFilePreview = function (url, title) {
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
window.generateFileCard = function (file, isNew = false) {
    const safeUrl = (file.file_url || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const safeTitle = (file.title || 'File').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const subject = file.subject || 'General';
    const badgeHtml = (isNew && subject !== 'General') ? `<div style="font-size: 0.8rem; background: #d63031; color: white; padding: 2px 6px; border-radius: 4px; transform: rotate(5deg);">NEW!</div>` : '';

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
window.scrollGallery = function (direction) {
    const container = document.getElementById('wimpyGalleryContainer');
    if (container) {
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
window.uploadGalleryItemIndex = async function (e) {
    e.preventDefault();

    // Admin Check
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code !== 'ADMIN' && u.role !== 'admin') return showToast('Unauthorized upload.', 'error');
    } else {
        return; // No user
    }

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
window.toggleMemberList = function () {
    const list = document.getElementById('publicMemberList');
    const icon = document.getElementById('memberToggleIcon');

    if (list) list.classList.toggle('hidden');
    if (icon) {
        icon.style.transform = list.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

// --- CLASS LIST MODAL ---
window.openClassList = function () {
    document.getElementById('classListModal').classList.remove('hidden');
    fetchMembers(); // Refresh data when opening
}
window.closeClassList = function () {
    document.getElementById('classListModal').classList.add('hidden');
}

// --- PUBLIC REQUEST MODAL ---
window.openRequestModal = function () {
    // Close profile modal if open
    const profileModal = document.getElementById('publicProfileModal');
    if (profileModal) profileModal.style.display = 'none';

    document.getElementById('requestModal').classList.remove('hidden');
}

window.closeRequestModal = function () {
    document.getElementById('requestModal').classList.add('hidden');
    document.getElementById('req-content').value = '';
}

window.submitRequest = async function () {
    const content = document.getElementById('req-content').value;
    if (!content) return showToast('Write something first!', 'error');

    const { error } = await supabaseClient.from('requests').insert([{
        content: content,
        sender: 'Anonymous (Public)'
    }]);

    if (error) showToast('Error sending: ' + error.message, 'error');
    else {
        showToast('Request sent to Admin!');
        closeRequestModal();
    }
}

// --- ADMIN LIST TOGGLE ---
window.toggleAdminList = function () {
    const list = document.getElementById('adminList');
    const icon = document.getElementById('adminToggleIcon');

    if (list) list.classList.toggle('hidden');
    if (icon) {
        icon.style.transform = list.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

// --- ADMIN FREEDOM WALL TOOLS ---
window.autoArrangeNotes = async function () {
    const { data, error } = await supabaseClient.from('notes').select('id');
    if (error || !data) return;

    showToast("Arranging...");
    const cols = 5;
    const spacingX = 18;
    const spacingY = 25;

    await Promise.all(data.map((note, i) =>
        supabaseClient.from('notes').update({
            x_pos: (i % cols) * spacingX + 5,
            y_pos: Math.floor(i / cols) * spacingY + 5,
            rotation: 0
        }).eq('id', note.id)
    ));

    fetchNotes();
    showToast("Notes aligned!");
}

window.scatterNotes = async function () {
    const { data, error } = await supabaseClient.from('notes').select('id');
    if (error || !data) return;

    showToast("Scattering...");
    await Promise.all(data.map(note =>
        supabaseClient.from('notes').update({
            x_pos: Math.floor(Math.random() * 80) + 5,
            y_pos: Math.floor(Math.random() * 80) + 5,
            rotation: Math.floor(Math.random() * 40) - 20
        }).eq('id', note.id)
    ));

    fetchNotes();
    showToast("Notes scattered!");
}


// --- INSTANT GALLERY UPLOAD (ADMIN) ---
window.handleInstantGalleryUpload = async function (e) {
    // Admin Check
    const storedUser = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.sr_code !== 'ADMIN' && u.role !== 'admin') return showToast('Unauthorized upload.', 'error');
    } else return;

    const file = e.target.files[0];
    if (!file) return;

    const caption = prompt("Enter a caption for this photo:", "New Memory");
    if (caption === null) return; // User cancelled

    showToast("Uploading photo...");

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
            title: caption || 'Untitled',
            subject: 'LandingGallery',
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbError) throw dbError;

        showToast('Photo added to Memories!');
        fetchLandingGallery();
    } catch (err) {
        console.error(err);
        showToast('Upload failed: ' + err.message, 'error');
    }
}

// --- HOVER PREVIEW FOR RECEIPT ---
window.showReceiptHover = function (e, url) {
    let tooltip = document.getElementById('receipt-hover-preview');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'receipt-hover-preview';
        tooltip.style.cssText = 'position: fixed; z-index: 10000; background: #fff; padding: 5px; border: 2px solid #000; box-shadow: 5px 5px 0 rgba(0,0,0,0.2); pointer-events: none; transform: rotate(-2deg); animation: fadeIn 0.2s;';
        // Added position:relative container for the overlay
        tooltip.innerHTML = `
            <div style="position: relative;">
                <img src="" style="display: block; max-width: 200px; max-height: 200px; object-fit: contain;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: #fff; padding: 5px 8px; border-radius: 4px; font-size: 0.8rem; text-align: center; border: 1px solid #fff; white-space: nowrap;">
                    Click to view receipt
                </div>
            </div>
        `;
        document.body.appendChild(tooltip);
    }
    const img = tooltip.querySelector('img');
    if (img.src !== url) img.src = url;

    // Initial position
    updateHoverPosition(e);
}

window.moveReceiptHover = function (e) {
    updateHoverPosition(e);
}

window.hideReceiptHover = function () {
    const tooltip = document.getElementById('receipt-hover-preview');
    if (tooltip) tooltip.remove();
}

function updateHoverPosition(e) {
    const tooltip = document.getElementById('receipt-hover-preview');
    if (!tooltip) return;

    // Offset from cursor to avoid covering it
    const x = e.clientX + 15;
    const y = e.clientY + 15;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

// --- DEDICATED RECEIPT PREVIEW MODAL ---
window.openReceiptPreview = function (name, url) {
    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';

    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    box.style.cssText = 'width: 95%; max-width: 500px; padding: 0; overflow: hidden; border-radius: 5px; background: #fff; border: 3px solid #000;';

    box.innerHTML = `
        <div style="background: #2d3436; color: #fff; padding: 15px; text-align: center; border-bottom: 3px solid #000; position: relative;">
            <h2 style="margin:0; font-size: 1.5rem; font-family: 'Patrick Hand';"><i class="fas fa-file-invoice"></i> OFFICIAL RECEIPT</h2>
            <p style="margin:5px 0 0 0; font-size: 1rem; opacity: 0.9; font-family: sans-serif;">Student: <b>${name}</b></p>
            <div style="position: absolute; top: 10px; right: 10px; width: 15px; height: 15px; background: #d63031; border-radius: 50%; border: 2px solid #fff;"></div>
            <div style="position: absolute; top: 10px; left: 10px; width: 15px; height: 15px; background: #f1c40f; border-radius: 50%; border: 2px solid #fff;"></div>
        </div>
        <div style="padding: 20px; background: #fdfbf7; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 100%; background: #fff; padding: 10px; border: 2px dashed #000; box-shadow: 5px 5px 0 rgba(0,0,0,0.1); transform: rotate(-1deg); margin-bottom: 20px;">
                <img src="${url}" style="width: 100%; height: auto; max-height: 50vh; object-fit: contain; display: block; border: 1px solid #eee;">
            </div>
            <div style="display: flex; gap: 10px; width: 100%; justify-content: center; padding: 0 20px 20px 20px; box-sizing: border-box;">
                <a href="${url}" target="_blank" download class="sketch-btn" style="background: #0984e3; color: #fff; font-size: 1rem; flex: 1;">
                    <i class="fas fa-download"></i> Download
                </a>
                <button onclick="this.closest('.wimpy-modal-overlay').remove()" class="sketch-btn danger" style="font-size: 1rem; flex: 1; margin: 0 !important;">
                    Close
                </button>
            </div>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// --- GLOBAL PASTE LISTENER (For Image Uploads) ---
document.addEventListener('paste', function (e) {
    // 1. Check Student Details Modal (Enrollment Receipt)
    const detailsModal = document.getElementById('studentDetailsModal');
    if (detailsModal && !detailsModal.classList.contains('hidden')) {
        const fileInput = detailsModal.querySelector('input[type="file"][id^="receiptInput-"]');
        if (fileInput) handleImagePaste(e, fileInput);
        return;
    }

    // 2. Check Admin Dashboard Gallery Upload (Index Page)
    const adminDash = document.getElementById('adminDashboard');
    if (adminDash && !adminDash.classList.contains('hidden')) {
        const galleryInput = document.getElementById('idx-g-file');
        // Only if the input is visible/part of the active view
        if (galleryInput && galleryInput.offsetParent !== null) {
            handleImagePaste(e, galleryInput);
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