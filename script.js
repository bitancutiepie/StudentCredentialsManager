// script.js (Plain Text Password Edition)

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
    // --- CHANGE: NO HASHING, SAVING PLAIN TEXT ---
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

    // --- CHANGE: PLAIN TEXT COMPARISON ---
    // We check if the input password matches the database password exactly
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

// --- UPDATED FETCH FUNCTION (Plain Password View) ---
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

function logout() {
    authSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    studentDashboard.classList.add('hidden');
    srCodeInput.value = '';
    passwordInput.value = '';
    fetchMembers(); 
}