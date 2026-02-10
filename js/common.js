// common.js - Shared Configuration and Utilities

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

// --- INITIALIZE CLIENT ---
if (typeof window.supabase !== 'undefined') {
    window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Legacy support
    window.supabaseClient = window.db;
} else {
    console.warn('Supabase JS not loaded yet. common.js will wait...');
}

// --- SHARED UTILITIES ---

/**
 * Centralized student data fetching that includes enrollment receipts.
 * @returns {Promise<Array>} - Array of students with enrollment_receipt_url
 */
async function getStudentsWithDetails() {
    if (!window.db) return [];

    // 1. Fetch Students
    const { data: students, error } = await window.db
        .from('students')
        .select('id, name, avatar_url, sr_code, role, enrollment_status, email, password');

    if (error) {
        console.error("Error fetching students:", error);
        return [];
    }

    // 2. Fetch Receipts (Workaround from shared_files)
    const { data: receipts } = await window.db
        .from('shared_files')
        .select('file_url, subject')
        .like('subject', 'Receipt-%');

    const receiptMap = {};
    if (receipts) receipts.forEach(r => receiptMap[r.subject] = r.file_url);

    // 3. Map together
    return students.map(s => ({
        ...s,
        enrollment_receipt_url: receiptMap[`Receipt-${s.id}`] || null
    }));
}

/**
 * Sanitizes a string to prevent XSS.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'info' or 'error'.
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        // Create if missing (Self-healing)
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;

    // Apply styling based on type
    if (type === 'error') {
        toast.style.background = '#ffadad';
        toast.classList.add('error');
    }

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/**
 * Debounce function to limit rate of execution.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Custom confirm modal with a "Wimpy Kid" style.
 * @param {string} message - The message to display.
 * @returns {Promise<boolean>} - Promise resolving to true if 'Yeah', false if 'Nah'.
 */
function showWimpyConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'wimpy-modal-overlay';
        overlay.style.zIndex = '10000';

        const box = document.createElement('div');
        box.className = 'wimpy-modal-box';

        box.innerHTML = `
            <h2 style="margin:0 0 10px 0; font-size:2rem;">WAIT!</h2>
            <p style="font-size:1.3rem; margin-bottom:20px;">${message}</p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="wimpy-no" class="sketch-btn" style="flex:1; background:#fff; color:#000;">NAH</button>
                <button id="wimpy-yes" class="sketch-btn" style="flex:1; background:#000; color:#fff;">YEAH</button>
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

/**
 * Shared logout functionality.
 */
async function logout() {
    if (typeof showWimpyConfirm !== 'undefined') {
        if (!await showWimpyConfirm("Pack up and leave?")) return;
    } else {
        if (!confirm("Pack up and leave?")) return;
    }
    localStorage.removeItem('wimpy_user');
    sessionStorage.removeItem('wimpy_user');
    window.location.href = 'index.html';
}

/**
 * Checks if the current user has permission to use a specific tool.
 * @param {string} tool - The tool name (e.g., 'schedule', 'homework').
 * @returns {boolean} - True if permitted.
 */
function hasPermission(tool) {
    const userStr = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!userStr) return false;
    const user = JSON.parse(userStr);

    // 1. Main Admin (ADMIN sr_code) always has all permissions
    if (user.sr_code === 'ADMIN') return true;

    // 2. Regular students have no admin permissions
    if (user.role !== 'admin' && !user.role?.startsWith('admin:')) return false;

    // 3. New Permission format: "admin:tools:schedule,homework,..."
    if (user.role.startsWith('admin:tools:')) {
        const allowedTools = user.role.split(':')[2].split(',');
        return allowedTools.includes(tool);
    }

    // 4. Legacy Admin (just "admin") - default to all permissions for backward compatibility
    return user.role === 'admin';
}

/**
 * Copy text to clipboard and show toast.
 */
function copyToClipboard(text) {
    if (!navigator.clipboard) {
        showToast('Clipboard API not supported', 'error');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied: ' + text);
    }).catch(err => {
        console.error('Copy failed', err);
        showToast('Failed to copy', 'error');
    });
}

/**
 * Updates the student's last_login timestamp in the database.
 * Throttled to once every 2 minutes per session.
 */
async function trackActivity() {
    const userStr = localStorage.getItem('wimpy_user') || sessionStorage.getItem('wimpy_user');
    if (!userStr || !window.db) return;

    const user = JSON.parse(userStr);
    const now = new Date();
    const lastTracked = sessionStorage.getItem('last_track_time');

    // Throttle: Only update every 2 minutes
    if (lastTracked && (now - new Date(lastTracked)) < 120000) return;

    try {
        await window.db
            .from('students')
            .update({ last_login: now.toISOString() })
            .eq('id', user.id);

        sessionStorage.setItem('last_track_time', now.toISOString());
        console.log("Activity tracked for:", user.name);
    } catch (err) {
        console.warn("Presence tracking failed:", err);
    }
}

/**
 * Helper to format timestamp as "X ago"
 */
function timeAgo(dateString) {
    if (!dateString) return "Unknown";
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
