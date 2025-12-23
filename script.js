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

let isLoginMode = true;

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
    fetchMembers();
    fetchNotes(); 
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
        toggleAuth.innerHTML = "Magpapalista? <b>Come here mga kosa click this</b>";
    } else {
        formTitle.innerText = 'Palista na';
        submitBtn.innerText = 'SIGN UP';
        nameInput.classList.remove('hidden');
        nameInput.required = true;
        toggleAuth.innerHTML = "Already a member? <b>Login</b>";
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const srCode = srCodeInput.value.toUpperCase();
    const password = passwordInput.value;
    const name = nameInput.value;

    submitBtn.innerText = 'Thinking...';
    submitBtn.disabled = true;

    try {
        if (isLoginMode) {
            await handleLogin(srCode, password);
        } else {
            await handleRegister(name, srCode, password);
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.innerText = isLoginMode ? 'ENTER →' : 'SIGN UP';
        submitBtn.disabled = false;
    }
});

async function handleRegister(name, srCode, password) {
    const { error } = await supabaseClient
        .from('students')
        .insert([{ name: name, sr_code: srCode, password: password }]);

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
        showStudentPanel(data.name, data.sr_code);
    }
}

function showAdminPanel(name) {
    authSection.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    adminNameDisplay.innerText = name;
    fetchStudents(); 
}

function showStudentPanel(name, code) {
    authSection.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.remove('hidden');
    studentNameDisplay.innerText = name;
    studentCodeDisplay.innerText = code;
}

// --- ADMIN FEATURES ---

async function fetchStudents() {
    const { data, error } = await supabaseClient
        .from('students')
        .select('id, name, sr_code, password');

    if (error) return console.error(error);

    studentTableBody.innerHTML = '';
    data.forEach(student => {
        if(student.sr_code === 'ADMIN') return;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.name}</td>
            <td style="display:flex; align-items:center; gap:5px;">
                <span>${student.sr_code}</span>
                <button class="btn-icon btn-copy" onclick="copyToClipboard('${student.sr_code}')" title="Copy Code">📋</button>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:1rem; font-weight:bold;">${student.password}</span>
                    <button class="btn-icon btn-copy" onclick="copyToClipboard('${student.password}')" title="Copy Password">🔑</button>
                </div>
            </td>
            <td>
                <button class="btn-icon btn-delete" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
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

// --- PORTAL POP-UP LOGIC ---

function openPortalWindow() {
    // Calculates the center of the screen
    const width = 1000;
    const height = 800;
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
        .select('name');

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
        tag.innerText = student.name;
        publicMemberList.appendChild(tag);
    });
}

// --- DRAGGABLE STICKY NOTES ---

async function postNote() {
    const text = noteInput.value.trim();
    if (!text) return showToast('Please write something!', 'error');

    let randomX;
    if (Math.random() > 0.5) {
        randomX = Math.floor(Math.random() * 20) + 2; 
    } else {
        randomX = Math.floor(Math.random() * 20) + 75; 
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
    authSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    fetchMembers(); 
    fetchNotes();
}