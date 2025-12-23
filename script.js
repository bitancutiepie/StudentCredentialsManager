// script.js (Sticky Notes Edition)

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

// Check Libraries
if (typeof window.supabase === 'undefined') alert('Error: Supabase not loaded.');
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
const noteLayer = document.getElementById('note-layer'); // NEW
const noteInput = document.getElementById('noteInput'); // NEW

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
fetchMembers();
fetchNotes(); // Fetch Sticky Notes on load!

// --- APP LOGIC ---

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

// --- ADMIN FETCH ---
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

// --- PUBLIC MEMBER LIST ---
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

// --- NEW: STICKY NOTES LOGIC ---

async function postNote() {
    const text = noteInput.value.trim();
    if (!text) return showToast('Please write something!', 'error');

    // 1. Calculate Random Position (Scatter Logic)
    // We create a buffer of 10% on each side so it doesn't go off-screen
    const randomX = Math.floor(Math.random() * 80) + 5; // 5% to 85% of screen width
    const randomY = Math.floor(Math.random() * 80) + 5; // 5% to 85% of screen height
    const rotation = Math.floor(Math.random() * 20) - 10; // Random tilt between -10deg and 10deg
    
    // Random Color
    const colors = ['#fff740', '#ff7eb9', '#7afcff', '#98ff98'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const { error } = await supabaseClient
        .from('notes')
        .insert([{ 
            content: text, 
            x_pos: randomX, 
            y_pos: randomY, 
            rotation: rotation,
            color: randomColor
        }]);

    if (error) {
        showToast('Failed to stick note.', 'error');
    } else {
        showToast('Note posted!');
        noteInput.value = '';
        fetchNotes(); // Refresh to see your new note
    }
}

async function fetchNotes() {
    const { data, error } = await supabaseClient
        .from('notes')
        .select('*');

    if (error) return;

    noteLayer.innerHTML = ''; // Clear current notes
    data.forEach(note => {
        const div = document.createElement('div');
        div.className = 'sticky-note';
        div.innerText = note.content;
        
        // Apply Random Styles from DB
        div.style.left = note.x_pos + '%';
        div.style.top = note.y_pos + '%';
        div.style.transform = `rotate(${note.rotation}deg)`;
        div.style.backgroundColor = note.color;

        noteLayer.appendChild(div);
    });
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