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

/**
 * --- REALTIME ANNOUNCEMENT POPUP (Shared) ---
 * Displays a premium Wimpy Kid style announcement on screen.
 */
window.showAnnouncementPopup = async function (data) {
    const { id, message, admin_name, admin_avatar } = data;

    // Create overlay if not exists
    let overlay = document.getElementById('announcement-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'announcement-overlay';
        overlay.className = 'wimpy-modal-overlay';
        if (typeof overlay.className === 'undefined' || !overlay.className) {
            // Fallback styles if class missing
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
        }
        overlay.style.zIndex = '20000'; // Above everything
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
    }

    const avatar = admin_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin_name)}&background=random`;

    overlay.innerHTML = `
        <div class="announcement-pop-card" id="announcement-${id}" style="
            background: #fff740; 
            border: 4px solid #000; 
            padding: 25px; 
            max-width: 500px; 
            width: 90%; 
            position: relative; 
            transform: rotate(-0.5deg);
            box-shadow: 12px 12px 0 #000;
            animation: announcePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            color: #000;
            text-align: left;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
        ">
            <!-- Tape -->
            <div style="position: absolute; top: -15px; left: 50%; transform: translateX(-50%); width: 100px; height: 35px; background: rgba(255,255,255,0.4); border: 1px dashed rgba(0,0,0,0.1); border-radius: 2px;"></div>
            
            <!-- Close Button Top Right -->
            <button onclick="document.getElementById('announcement-overlay').style.display='none'; document.getElementById('announcement-overlay').innerHTML='';" 
                    style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #000;">
                <i class="fas fa-times"></i>
            </button>

            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; border-bottom: 2px dashed rgba(0,0,0,0.2); padding-bottom: 10px;">
                <img src="${avatar}" style="width: 50px; height: 50px; border: 3px solid #000; border-radius: 50%; background: #fff; object-fit: cover;">
                <div>
                    <h2 style="margin: 0; font-family: 'Permanent Marker', cursive; font-size: 1.5rem; color: #000;">ANNOUNCEMENT!</h2>
                    <p style="margin: 0; font-style: italic; font-size: 1rem; color: #333; font-family: 'Patrick Hand';">from ${admin_name}</p>
                </div>
            </div>

            <!-- Content Area - Scrollable if too long -->
            <div style="flex: 1; overflow-y: auto; margin-bottom: 15px; padding-right: 5px;" class="custom-scroll">
                <div style="font-size: 1.3rem; line-height: 1.4; color: #000; margin-bottom: 20px; white-space: pre-wrap; font-family: 'Patrick Hand', cursive;">
                    ${message}
                </div>

                <!-- Comment Section Wrapper -->
                <div style="border-top: 1px solid rgba(0,0,0,0.1); padding-top: 15px;">
                    <h4 style="margin: 0 0 10px 0; font-family: 'Permanent Marker'; font-size: 1.1rem;"><i class="fas fa-comments"></i> Reactions</h4>
                    <div id="comment-list-${id}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
                        <p style="font-style: italic; color: #666; font-family: 'Patrick Hand';">Loading comments...</p>
                    </div>
                </div>
            </div>

            <!-- Comment Input -->
            <div style="display: flex; gap: 5px; background: #fff; padding: 5px; border: 2px solid #000;">
                <input type="text" id="comment-input-${id}" placeholder="Say something..." 
                    style="flex: 1; border: none; background: transparent; font-family: 'Patrick Hand'; font-size: 1.1rem; padding: 5px; outline: none;"
                    onkeydown="if(event.key === 'Enter') postAnnouncementComment('${id}')">
                <button onclick="postAnnouncementComment('${id}')" style="background: #000; color: #fff; border: none; padding: 5px 12px; font-family: 'Permanent Marker'; cursor: pointer;">
                    POST
                </button>
            </div>
        </div>

        <style>
            @keyframes announcePop {
                0% { transform: scale(0.5) rotate(10deg); opacity: 0; }
                100% { transform: scale(1) rotate(-0.5deg); opacity: 1; }
            }
            #announcement-overlay {
                display: flex !important;
                align-items: center;
                justify-content: center;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.85);
                z-index: 2147483647;
                pointer-events: auto;
            }
            .custom-scroll::-webkit-scrollbar { width: 6px; }
            .custom-scroll::-webkit-scrollbar-track { background: transparent; }
            .custom-scroll::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; }
        </style>
    `;

    overlay.style.display = 'flex';

    // Fetch Existing Comments
    loadAnnouncementComments(id);
};

/**
 * --- LOAD COMMENTS ---
 */
window.loadAnnouncementComments = async function (announcementId) {
    if (!announcementId) {
        console.warn("No announcementId provided to loadAnnouncementComments");
        return;
    }

    console.log("Loading comments for ID:", announcementId, "Type:", typeof announcementId);

    const list = document.getElementById(`comment-list-${announcementId}`);
    if (!list || !window.db) return;

    try {
        const { data, error } = await window.db
            .from('notes')
            .select('*')
            .eq('color', 'COMMENT:' + announcementId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Supabase Error loading comments:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            list.innerHTML = '<p style="font-style: italic; color: #666; font-family: \'Patrick Hand\';">No comments yet. Be the first!</p>';
        } else {
            console.log(`Found ${data.length} comments.`);
            list.innerHTML = data.map(c => {
                let sender = "Someone";
                let msg = (c.content || "");
                if (msg.includes(":::")) {
                    const parts = msg.split(":::");
                    sender = parts[0];
                    msg = parts.slice(1).join(":::"); // Handle msg containing :::
                }
                return `
                    <div style="background: rgba(0,0,0,0.05); padding: 5px 10px; border-radius: 5px; font-family: 'Patrick Hand'; font-size: 1.1rem; margin-bottom: 5px;">
                        <b style="color: #d63031;">${escapeHTML(sender)}:</b> ${escapeHTML(msg)}
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error("Failed to load comments exception:", err);
        list.innerHTML = `<p style="color: red; font-size: 0.8rem;">Error loading comments. Check console.</p>`;
    }
};

/**
 * --- POST COMMENT ---
 */
window.postAnnouncementComment = async function (announcementId) {
    const input = document.getElementById(`comment-input-${announcementId}`);
    const msg = input.value.trim();
    if (!msg || !window.db || !window.user) return;

    input.value = '';
    const sender = window.user.name;
    const combinedContent = `${sender}:::${msg}`;

    try {
        // 1. Save to Database
        const { error } = await window.db.from('notes').insert([{
            content: combinedContent,
            color: 'COMMENT:' + announcementId,
            x_pos: 0,
            y_pos: 0,
            rotation: 0,
            likes: 0
        }]);

        if (error) throw error;

        // 2. Broadcast to others
        if (window.roomChannel) {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'comment',
                payload: {
                    announcementId: announcementId,
                    sender: sender,
                    message: msg
                }
            });
        }

        // 3. Update locally
        const list = document.getElementById(`comment-list-${announcementId}`);
        if (list) {
            if (list.innerText.includes("No comments yet")) list.innerHTML = '';
            const div = document.createElement('div');
            div.style.cssText = "background: rgba(0,0,0,0.05); padding: 5px 10px; border-radius: 5px; font-family: 'Patrick Hand'; font-size: 1.1rem;";
            div.innerHTML = `<b style="color: #d63031;">${escapeHTML(sender)}:</b> ${escapeHTML(msg)}`;
            list.appendChild(div);
            list.parentElement.scrollTop = list.parentElement.scrollHeight;
        }

    } catch (err) {
        console.error("Comment failed:", err);
    }
};

// GLOBAL LISTENER FOR COMMENTS
// This needs to be hooked up in script.js and dashboard.js
window.handleIncomingComment = function (payload) {
    const { announcementId, sender, message } = payload;
    const list = document.getElementById(`comment-list-${announcementId}`);
    if (list) {
        if (list.innerText.includes("No comments yet")) list.innerHTML = '';
        const div = document.createElement('div');
        div.style.cssText = "background: rgba(0,0,0,0.05); padding: 5px 10px; border-radius: 5px; font-family: 'Patrick Hand'; font-size: 1.1rem;";
        div.innerHTML = `<b style="color: #d63031;">${escapeHTML(sender)}:</b> ${escapeHTML(message)}`;
        list.appendChild(div);
        // Scroll to bottom if it's the current open popup
        list.parentElement.scrollTop = list.parentElement.scrollHeight;
    }
};

/**
 * --- RECOVER RECENT ANNOUNCEMENT ON LOAD ---
 */
window.checkActiveAnnouncements = async function () {
    if (!window.db) return;
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
        const { data, error } = await window.db
            .from('notes')
            .select('*')
            .eq('color', 'GLOBAL_MSG')
            .gt('created_at', fiveMinsAgo)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
            const ann = data[0];
            window.showAnnouncementPopup({
                id: ann.id,
                message: ann.content,
                admin_name: "Admin",
                admin_avatar: ""
            });
        }
    } catch (err) {
        console.error("Failed to check active announcements:", err);
    }
}
