// script.js (Clean Pop-Up Window Version)

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

const authSection = document.getElementById('authSection');
const adminDashboard = document.getElementById('adminDashboard');
const studentDashboard = document.getElementById('studentDashboard');

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
let avatarInput; // Will be created dynamically

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
    // Inject Avatar Input for Registration
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
    showWelcomeNote();
});

// --- AUTH LOGIC ---

toggleAuth.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authForm.reset();
    if (isLoginMode) {
        formTitle.innerText = 'Ako na ang Bahala';
        submitBtn.innerText = 'ENTER →';
        nameInput.classList.add('hidden');
        nameInput.required = false;
        if(avatarInput) avatarInput.classList.add('hidden');
        const lbl = document.getElementById('avatarLabel');
        if(lbl) lbl.classList.add('hidden');
        toggleAuth.innerHTML = "Magpapalista? <b>Come here mga kosa click this</b>";
    } else {
        formTitle.innerText = 'Palista na';
        submitBtn.innerText = 'SIGN UP';
        nameInput.classList.remove('hidden');
        nameInput.required = true;
        if(avatarInput) avatarInput.classList.remove('hidden');
        const lbl = document.getElementById('avatarLabel');
        if(lbl) lbl.classList.remove('hidden');
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

    if (data.sr_code === 'ADMIN') {
        showAdminPanel(data.name);
    } else {
        showStudentPanel(data.name, data.sr_code, data.avatar_url, data.id);
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

    const avatarImg = document.getElementById('userAvatarDisplay');
    
    // Apply styles to existing image
    avatarImg.style.width = '100px';
    avatarImg.style.height = '100px';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.objectFit = 'cover';
    avatarImg.style.cursor = 'pointer';
    avatarImg.title = 'Click to change profile picture';

    // Add visual hint for updating profile pic
    let hint = document.getElementById('avatarHint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'avatarHint';
        hint.innerText = '📷 Tap image to update';
        hint.style.fontSize = '0.8rem';
        hint.style.color = '#555';
        hint.style.cursor = 'pointer';
        hint.onclick = () => avatarImg.click();
        
        const imgContainer = avatarImg.parentElement;
        if (imgContainer && imgContainer.parentNode) {
            imgContainer.parentNode.insertBefore(hint, imgContainer.nextSibling);
        }
    }

    // Setup input if not present
    let updateInput = document.getElementById('updateAvatarInput');
    if (!updateInput) {
        updateInput = document.createElement('input');
        updateInput.type = 'file';
        updateInput.id = 'updateAvatarInput';
        updateInput.accept = 'image/*';
        updateInput.style.display = 'none';
        avatarImg.parentNode.appendChild(updateInput);

        avatarImg.addEventListener('click', () => updateInput.click());
        updateInput.addEventListener('change', async (e) => {
            if (e.target.files[0] && currentStudentId) {
                await updateProfilePic(currentStudentId, e.target.files[0]);
            }
        });
    }

    avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

async function updateProfilePic(id, file) {
    showToast('Uploading new look...', 'info');
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${id}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
        });
    
    if (uploadError) {
        console.error('Supabase Storage Error:', uploadError);
        if (uploadError.message.includes('row-level security')) {
            return showToast('Permission Denied: Enable "Anon" uploads in Supabase Storage.', 'error');
        }
        return showToast(`Upload failed: ${uploadError.message}`, 'error');
    }

    const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
    
    const { error: dbError } = await supabaseClient
        .from('students')
        .update({ avatar_url: data.publicUrl })
        .eq('id', id);

    if (dbError) return showToast('Database update failed', 'error');

    document.getElementById('userAvatarDisplay').src = data.publicUrl;
    showToast('Profile picture updated!', 'success');
    fetchMembers();
}

// --- ADMIN FEATURES ---

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
    studentTableBody.innerHTML = '';
    students.forEach(student => {
        if(student.sr_code === 'ADMIN') return;

        const safeName = student.name.replace(/'/g, "\\'");
        const safeCode = student.sr_code.replace(/'/g, "\\'");
        const safeAvatar = (student.avatar_url || '').replace(/'/g, "\\'");

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="flex-cell">
                    <img src="${student.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #333;">
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
                    <button class="btn-icon" style="background:#2196F3; color:white; border-color:#0b7dda;" onclick="loginAsUser('${safeName}', '${safeCode}', '${safeAvatar}', '${student.id}')" title="Login As">🚀</button>
                </div>
            </td>
        `;
        studentTableBody.appendChild(row);
    });
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

function loginAsUser(name, code, avatarUrl, id) {
    if(!confirm('Switch view to ' + name + '?')) return;
    showStudentPanel(name, code, avatarUrl, id);
    showToast('Switched to user view');
}

// --- PORTAL POP-UP LOGIC ---

function openPortalWindow() {
    // Calculates the center of the screen
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

// --- DRAGGABLE STICKY NOTES ---

async function postNote() {
    const text = noteInput.value.trim();
    if (!text) return showToast('Please write something!', 'error');

    let randomX;
    // Responsive positioning: On mobile, spawn anywhere. On desktop, prefer sides.
    if (window.innerWidth < 600) {
        randomX = Math.floor(Math.random() * 80) + 5; // 5% to 85%
    } else {
        if (Math.random() > 0.5) {
            randomX = Math.floor(Math.random() * 20) + 2; 
        } else {
            randomX = Math.floor(Math.random() * 20) + 75; 
        }
    }
    const randomY = Math.floor(Math.random() * 90) + 5; 
    const rotation = Math.floor(Math.random() * 20) - 10;
    const colors = ['#fff740', '#ff7eb9', '#7afcff', '#98ff98'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const { error } = await supabaseClient
        .from('notes')
        .insert([{ content: text, x_pos: randomX, y_pos: randomY, rotation: rotation, color: randomColor }]);

    if (error) {
        showToast('Failed to stick note.', 'error');
    } else {
        showToast('Note posted!');
        noteInput.value = '';
        fetchNotes();
    }
}

async function fetchNotes() {
    const { data, error } = await supabaseClient
        .from('notes')
        .select('*');

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

        const visibleBox = Array.from(document.querySelectorAll('.sketch-box')).find(box => !box.classList.contains('hidden'));
        if (visibleBox) {
            const boxRect = visibleBox.getBoundingClientRect();
            const noteRect = element.getBoundingClientRect();
            
            const overlap = !(noteRect.right < boxRect.left || noteRect.left > boxRect.right || noteRect.bottom < boxRect.top || noteRect.top > boxRect.bottom);

            if (overlap) {
                const noteCX = noteRect.left + noteRect.width / 2;
                const boxCX = boxRect.left + boxRect.width / 2;
                let newLeft;
                const padding = 20;

                if (noteCX < boxCX) {
                    newLeft = (boxRect.left + window.scrollX) - noteRect.width - padding;
                    if (newLeft < 10) newLeft = 10;
                } else {
                    newLeft = (boxRect.right + window.scrollX) + padding;
                    if (newLeft + noteRect.width > window.innerWidth) newLeft = window.innerWidth - noteRect.width - 10;
                }
                
                if (window.innerWidth < 600 && (newLeft < 10 || newLeft > window.innerWidth - 100)) {
                     element.style.top = ((boxRect.bottom + window.scrollY) + padding) + "px";
                } else {
                     element.style.left = newLeft + "px";
                }
            }
        }

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

function logout() {
    currentStudentId = null;
    authSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    searchInput.value = '';
    fetchMembers(); 
    fetchNotes();
}

function showWelcomeNote() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center;';
    
    const note = document.createElement('div');
    note.className = 'sketch-box';
    note.style.width = '90%';
    note.style.maxWidth = '400px';
    note.style.margin = '0'; // Override default margin for centering
    note.style.textAlign = 'center';
    note.style.transform = 'rotate(-1deg)';
    
    note.innerHTML = `
        <h2 style="margin-top:0;">ANNOUNCEMENT</h2>
        <p style="font-size:1.5rem; margin: 20px 0;">"Register na kayo para maenroll ko kayo -JV"</p>
        <button onclick="this.parentElement.parentElement.remove()">GEH GEH</button>
    `;
    
    modal.appendChild(note);
    document.body.appendChild(modal);
}