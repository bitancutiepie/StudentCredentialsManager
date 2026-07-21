// --- CONFIGURATION ---
// SUPABASE_URL and SUPABASE_KEY are loaded from common.js

// Use existing client if available
const sb = window.db;
let globalFiles = [];

// --- 1. PREVIEW MODAL ---
window.openFilePreview = async function (url, title, fileId) {
    if (!url) return alert('No file link available.');

    // --- TRACKING (Persistent Mode) ---
    try {
        const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');
        if (currentUser && fileId) {
            const logPayload = {
                type: 'file_view',
                u: currentUser.name,
                a:
                    currentUser.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`,
                fid: fileId,
                t: new Date().toISOString(),
            };

            // Use 'notes' table with a hidden color for logging (proven pattern in group-chat.js)
            await window.db.from('notes').insert([
                {
                    content: JSON.stringify(logPayload),
                    x_pos: 0,
                    y_pos: 0,
                    rotation: 0,
                    color: 'FILE_VIEW',
                    likes: 0,
                },
            ]);
            console.log(`View logged for file ${fileId}`);
        }
    } catch (err) {
        console.warn('View tracking failed:', err);
    }

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
                <div id="filePreviewModal" class="file-preview-overlay">
                    <div class="file-preview-box">
                        <div class="preview-header">
                            <h3><i class="fas fa-eye"></i> ${title}</h3>
                            <div class="preview-actions">
                                <a href="${url}" target="_blank" download style="text-decoration:none;">
                                    <button class="sketch-btn" style="background:#0984e3; color:#fff; padding: 8px 15px; margin:0;" title="Download">
                                        <i class="fas fa-download"></i> <span class="hide-mobile">DOWNLOAD</span>
                                    </button>
                                </a>
                                <button class="sketch-btn danger" onclick="document.getElementById('filePreviewModal').remove()" style="padding: 8px 15px; margin:0;">
                                    <i class="fas fa-times"></i> <span class="hide-mobile">CLOSE</span>
                                </button>
                            </div>
                        </div>
                        <div class="preview-body">
                            ${contentHtml}
                        </div>
                    </div>
                </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// --- NEW: VIEW FILE LOG (WHO CLICKED) ---
window.viewFileHistory = async function (fileId, title) {
    console.log('Fetching viewer log for file ID:', fileId);

    // 1. Create Loading Overlay
    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    overlay.id = 'viewer-log-modal';
    overlay.innerHTML = `
                <div class="wimpy-modal-box" style="max-width:400px; text-align:left;">
                    <h2 style="margin-top:0;"><i class="fas fa-eye"></i> Unique Viewers</h2>
                    <p style="font-size:0.9rem; color:#666; margin-top:-10px; font-family:'Patrick Hand';">File: ${title}</p>
                    <div id="viewer-list" style="max-height:300px; overflow-y:auto; margin:15px 0;">
                        <div class="loader">Checking the paper trail...</div>
                    </div>
                    <button onclick="document.getElementById('viewer-log-modal').remove()" class="sketch-btn" style="width:100%; background:#000; color:#fff;">GOT IT</button>
                </div>
            `;
    document.body.appendChild(overlay);

    try {
        // Fetch from notes table where color is FILE_VIEW
        // Increased limit to 200 to get a better history scope before filtering
        const { data: logs, error } = await window.db
            .from('notes')
            .select('content, created_at')
            .eq('color', 'FILE_VIEW')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        // Filter for this specific file AND Unique Users
        const uniqueViewers = new Map();

        (logs || []).forEach((log) => {
            try {
                const v = JSON.parse(log.content);
                if (v && v.fid == fileId) {
                    // Since we ordered by created_at DESC, the first occurrence is the latest
                    if (!uniqueViewers.has(v.u)) {
                        uniqueViewers.set(v.u, {
                            ...v,
                            t: log.created_at, // Use server timestamp for accuracy
                        });
                    }
                }
            } catch (e) {}
        });

        const fileViewers = Array.from(uniqueViewers.values());

        const listEl = document.getElementById('viewer-list');
        if (!fileViewers || fileViewers.length === 0) {
            listEl.innerHTML =
                '<p style="text-align:center; font-style:italic; padding: 20px;">Nobody has viewed this file yet. Be the first!</p>';
            return;
        }

        // 3. Render List
        listEl.innerHTML = fileViewers
            .map((v) => {
                const avatar = v.a || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.u)}&background=random`;
                const timeDisp = window.timeAgo ? window.timeAgo(v.t) : new Date(v.t).toLocaleString();
                return `
                        <div style="display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px dashed #ccc;">
                            <img src="${avatar}" style="width:35px; height:35px; border-radius:50%; border:1px solid #000;">
                            <div style="flex:1;">
                                <div style="font-family:'Patrick Hand'; font-size:1.1rem; font-weight:bold;">${typeof escapeHTML === 'function' ? escapeHTML(v.u) : v.u}</div>
                                <div style="font-size:0.75rem; color:#d63031;">Last seen: ${timeDisp}</div>
                            </div>
                        </div>
                    `;
            })
            .join('');
    } catch (err) {
        console.error('Failed to load viewers:', err);
        const listEl = document.getElementById('viewer-list');
        if (listEl) listEl.innerHTML = '<p>Error loading log.</p>';
    }
};

// --- 2. FETCH & RENDER FILES ---
window.refreshFiles = async function () {
    const list = document.getElementById('file-list');
    if (!list) return;

    const { data, error } = await sb
        .from('shared_files')
        .select('*')
        .neq('subject', 'LandingGallery')
        .not('subject', 'like', 'Receipt-%')
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) return console.error(error);

    globalFiles = data || [];
    renderFileList(globalFiles);
    if (window.updateFolderCounts) updateFolderCounts();
};

window.renderFileList = function (files) {
    const list = document.getElementById('file-list');
    if (!files.length) {
        list.innerHTML = '<p>No files found.</p>';
        return;
    }

    // Check Admin
    const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');
    const isAdmin = currentUser && currentUser.sr_code === 'ADMIN';

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 3);

    list.innerHTML = files
        .map((file) => {
            const safeUrl = (file.file_url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeTitle = (file.title || 'File')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;');
            const subjectCode = file.subject || 'General';
            const subject =
                subjectCode === 'General'
                    ? 'General'
                    : window.subjectMapping
                      ? window.subjectMapping[subjectCode] || subjectCode
                      : subjectCode;
            const displayTitle = typeof escapeHTML === 'function' ? escapeHTML(file.title) : safeTitle;

            const createdAt = new Date(file.created_at);
            const isNew = createdAt > dateLimit && subject !== 'General';
            const badgeHtml = isNew
                ? `<span class="new-badge-sketch" style="background:#ff4757; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px; border:1px solid #000; display:inline-block; transform:rotate(5deg);">NEW!</span>`
                : '';

            // Better Icon Logic
            let iconClass = 'fa-file';
            let iconColor = '#2f3542';
            const fType = (file.file_type || '').toLowerCase();
            if (fType.includes('pdf')) {
                iconClass = 'fa-file-pdf';
                iconColor = '#d63031';
            } else if (fType.includes('image')) {
                iconClass = 'fa-file-image';
                iconColor = '#00b894';
            } else if (fType.includes('word')) {
                iconClass = 'fa-file-word';
                iconColor = '#0984e3';
            } else if (fType.includes('ppt')) {
                iconClass = 'fa-file-powerpoint';
                iconColor = '#e17055';
            } else if (fType.includes('video')) {
                iconClass = 'fa-file-video';
                iconColor = '#6c5ce7';
            }

            const deleteBtn = isAdmin
                ? `<button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="sketch-icon-btn" title="Delete File" style="margin-right:auto;"><i class="fas fa-trash" style="color:#d63031;"></i></button>`
                : '';

            return `
                <div class="file-card-mini" onclick="openFilePreview('${safeUrl}', '${safeTitle}', '${file.id}')" style="animation-delay: ${Math.random() * 0.3}s;">
                    <div class="file-card-top" style="background:${iconColor}15; border-bottom: 2px dashed ${iconColor}40; padding:8px 12px; margin:-12px -12px 10px -12px; border-radius:9px 9px 0 0; display:flex; align-items:center; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <i class="fas ${iconClass}" style="color:${iconColor}; font-size:0.85rem;"></i>
                            <span style="color:${iconColor}; font-weight:bold; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">${subject}</span>
                            ${badgeHtml}
                        </div>
                        <span style="font-size:0.7rem; color:#999;"><i class="fas fa-clock"></i> ${timeAgo ? timeAgo(file.created_at) : createdAt.toLocaleDateString()}</span>
                    </div>
                    <div class="file-card-body" style="display:flex; align-items:flex-start; gap:12px;">
                        <div class="file-icon-box" style="border-color: ${iconColor}; color: ${iconColor};">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <div class="file-info-main">
                            <div class="file-title-text">${displayTitle}</div>
                        </div>
                    </div>
                    <div class="file-card-footer">
                        ${deleteBtn}
                        <button onclick="event.stopPropagation(); viewFileHistory('${file.id}', '${safeTitle}')" class="sketch-icon-btn" title="See who viewed this"><i class="fas fa-eye" style="color:#fdcb6e;"></i></button>
                        <button onclick="event.stopPropagation(); copyToClipboard('${safeUrl}')" class="sketch-icon-btn" title="Copy Link"><i class="fas fa-link" style="color:#636e72;"></i></button>
                        <button class="sketch-icon-btn" title="Open File"><i class="fas fa-external-link-alt" style="color:#0984e3;"></i></button>
                    </div>
                </div>`;
        })
        .join('');
};

// Override Search/Filter
window.searchFiles = function () {
    const q = document.getElementById('file-search').value.toLowerCase();
    renderFileList(globalFiles.filter((f) => f.title.toLowerCase().includes(q) || f.subject.toLowerCase().includes(q)));
};
window.filterFiles = function (s, folderEl) {
    // 1. Toggle active state on folder cards
    document.querySelectorAll('.subject-folder').forEach((f) => f.classList.remove('active'));
    if (folderEl) folderEl.classList.add('active');

    // 2. Update label
    const displayName = s === 'All' || s === 'General' ? s : window.subjectMapping ? window.subjectMapping[s] || s : s;
    document.getElementById('file-filter-label').innerText = '📂 Showing: ' + displayName;

    // 3. Filter & render
    renderFileList(s === 'All' ? globalFiles : globalFiles.filter((f) => f.subject === s));
};

// Update folder count badges after files load
window.updateFolderCounts = function () {
    if (!globalFiles) return;
    // All files count
    const allEl = document.getElementById('fc-all');
    if (allEl) allEl.textContent = globalFiles.length + ' files';

    // General count
    const genEl = document.getElementById('fc-General');
    if (genEl) genEl.textContent = globalFiles.filter((f) => f.subject === 'General').length + ' files';

    // Per-subject counts
    if (window.subjectMapping) {
        Object.keys(window.subjectMapping).forEach((code) => {
            const el = document.getElementById('fc-' + code);
            if (el) el.textContent = globalFiles.filter((f) => f.subject === code).length + ' files';
        });
    }
};

// Override deleteFile to use the inline refresh logic
window.deleteFile = async function (id) {
    if (window.showWimpyConfirm && !(await showWimpyConfirm('Delete this file?'))) return;
    if (!window.showWimpyConfirm && !confirm('Delete this file?')) return;

    const { error } = await sb.from('shared_files').delete().eq('id', id);
    if (error) {
        if (window.showToast) showToast('Error deleting file.');
        else alert('Error deleting file.');
    } else {
        if (window.showToast) showToast('File removed.');
        refreshFiles();
    }
};

// Override loadFiles to maintain consistency with dashboard.js calls
window.loadFiles = async function (subject) {
    await refreshFiles();
    if (subject && subject !== 'All') filterFiles(subject);
};

// Load on start (Delayed slightly to ensure DOM is ready)
document.addEventListener('DOMContentLoaded', () => setTimeout(refreshFiles, 1000));

// --- CUSTOM STATUS LOGIC ---
window.editUserStatus = function () {
    // FIX: Use global user from dashboard.js (Custom Auth)
    const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');

    if (!currentUser) {
        alert('Please log in to change your status.');
        return;
    }

    const el = document.getElementById('user-status-text');
    const current = el.innerText;

    document.getElementById('statusInput').value = current;
    document.getElementById('statusModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('statusInput').focus(), 100);
};

window.saveUserStatus = async function () {
    const newStatus = document.getElementById('statusInput').value.trim();
    const el = document.getElementById('user-status-text');
    const current = el.innerText;
    const modal = document.getElementById('statusModal');

    if (!newStatus) return alert('Status cannot be empty!');

    modal.classList.add('hidden');

    if (newStatus !== current) {
        el.innerText = newStatus;

        const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');

        // Save to 'user_statuses' table in Supabase
        const { error } = await sb.from('user_statuses').upsert({
            user_id: currentUser.id,
            status: newStatus,
        });

        if (error) {
            console.error('Status save failed:', error);
            alert('Save failed: ' + (error.message || 'Permission denied'));
            el.innerText = current; // Revert on error
        } else {
            showToast('Status updated!');
        }
    }
};

// --- NAME CHANGE LOGIC ---
window.editUserName = function () {
    const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');
    if (!currentUser) return alert('Please log in first.');

    document.getElementById('nameChangeInput').value = currentUser.name;
    document.getElementById('editNameModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('nameChangeInput').focus(), 100);
};

window.saveUserName = async function () {
    const newName = document.getElementById('nameChangeInput').value.trim();
    const modal = document.getElementById('editNameModal');
    let currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');

    if (!newName) return alert('Name cannot be empty!');
    if (!currentUser) return;
    if (newName === currentUser.name) return modal.classList.add('hidden');

    if (window.showWimpyConfirm && !(await showWimpyConfirm(`Change your name to "${newName}"?`))) return;

    modal.classList.add('hidden');

    // Show loading toast if available
    if (window.showToast) showToast('Updating your ID card...');

    // 1. Update Supabase
    const { error } = await sb.from('students').update({ name: newName }).eq('id', currentUser.id);

    if (error) {
        console.error('Name update failed:', error);
        alert('Could not update name: ' + error.message);
        return;
    }

    // 2. Update local state
    currentUser.name = newName;
    window.user = currentUser;

    // 3. Update Storage (Check both for safety)
    localStorage.setItem('wimpy_user', JSON.stringify(currentUser));
    if (sessionStorage.getItem('wimpy_user')) sessionStorage.setItem('wimpy_user', JSON.stringify(currentUser));

    // 4. Update UI
    const welcomeEl = document.getElementById('welcome-msg');
    if (welcomeEl) {
        welcomeEl.innerText = `Hey ${newName}! 2nd Sem na, aral mabuti.`;
    }

    // 5. Update Real-time Presence
    if (window.refreshPresence) window.refreshPresence();

    if (window.showToast) showToast('Name updated successfully!');
};
// Init Status
async function initUserStatus() {
    const currentUser = window.user || JSON.parse(localStorage.getItem('wimpy_user') || 'null');
    if (currentUser) {
        const { data } = await sb.from('user_statuses').select('status').eq('user_id', currentUser.id).maybeSingle();
        if (data && data.status) {
            const el = document.getElementById('user-status-text');
            if (el) el.innerText = data.status;
        }
    }
}

// Run on load (delayed slightly to ensure dashboard.js loads user)
document.addEventListener('DOMContentLoaded', () => setTimeout(initUserStatus, 1000));

// --- WALLPAPER GENERATOR LOGIC ---
window.openWallpaperModal = function () {
    document.getElementById('wallpaperModal').classList.remove('hidden');
    updateWallpaperOptions();
};

window.updateWallpaperOptions = function () {
    const sizeSelect = document.getElementById('wp-size-select');
    const bgSelect = document.getElementById('wp-bg-select');
    const ipownOption = bgSelect.querySelector('option[value="ipown"]');

    let isMobile = false;
    const val = sizeSelect.value;

    if (val === 'auto') {
        isMobile = window.innerWidth <= 768; // Simple width check for "Mobile"
    } else {
        const [w, h] = val.split(',').map(Number);
        isMobile = h > w; // Portrait = Mobile assumption
    }

    if (isMobile) {
        ipownOption.style.display = 'block';
        ipownOption.disabled = false;
    } else {
        ipownOption.style.display = 'none';
        ipownOption.disabled = true;
        if (bgSelect.value === 'ipown') bgSelect.value = 'paper'; // Reset if invalid
    }
};

// Add listener to Size Select
document.getElementById('wp-size-select').addEventListener('change', updateWallpaperOptions);

window.toggleCustomBgInput = function (select) {
    const input = document.getElementById('wp-custom-bg');
    if (select.value === 'custom') input.classList.remove('hidden');
    else input.classList.add('hidden');
};

window.generateWallpaperFromSelect = function (e) {
    const val = document.getElementById('wp-size-select').value;
    const bgStyle = document.getElementById('wp-bg-select').value;
    const fileInput = document.getElementById('wp-custom-bg');

    // Capture button reference immediately because e.currentTarget is null in async callbacks
    const btn = e.currentTarget;

    let w, h;
    if (val === 'auto') {
        w = Math.round(window.screen.width * (window.devicePixelRatio || 1));
        h = Math.round(window.screen.height * (window.devicePixelRatio || 1));
    } else {
        [w, h] = val.split(',').map(Number);
    }

    if (bgStyle === 'custom' && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            // Pass a mock event object with the captured button
            generateWallpaper(w, h, bgStyle, { currentTarget: btn }, evt.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        if (bgStyle === 'custom') {
            alert('Please select an image file first!');
            return;
        }
        generateWallpaper(w, h, bgStyle, e);
    }
};

window.showWallpaperPreview = function (dataUrl, filename) {
    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    overlay.id = 'wp-preview-overlay';
    overlay.style.zIndex = '10002'; // Ensure it's on top

    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    Object.assign(box.style, {
        maxWidth: '90%',
        maxHeight: '90vh',
        width: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
    });

    box.innerHTML = `
                <h2 style="margin-top:0;"><i class="fas fa-eye"></i> Preview</h2>
                <div style="flex: 1; overflow: auto; margin-bottom: 15px; border: 2px solid #000; background: #eee; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                    <img src="${dataUrl}" style="max-width: 100%; max-height: 60vh; object-fit: contain; display: block; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="wp-download-btn" class="sketch-btn" style="background: #000; color: #fff; width: auto; padding: 10px 20px;">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button onclick="document.getElementById('wp-preview-overlay').remove()" class="sketch-btn danger" style="width: auto; padding: 10px 20px;">
                        Close
                    </button>
                </div>
            `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('wp-download-btn').onclick = function () {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        // Success Toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = 'Wallpaper Saved!';
        document.getElementById('toast-container').appendChild(toast);

        document.getElementById('wp-preview-overlay').remove();
    };
};

window.generateWallpaper = async function (width, height, bgStyle, e, customBgData = null) {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Drawing...';
    btn.disabled = true;

    // 1. Fetch Schedule Data (Monday to Saturday)
    const client = window.db;

    // Helper for Time Formatting (Moved top level scope of func)
    const format12 = (t) => {
        if (!t) return '';
        const [hStr, mStr] = t.split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${mStr} ${ampm}`;
    };

    let scheduleData = [];
    if (client) {
        const { data, error } = await client.from('schedule').select('*').order('start_time', { ascending: true });
        if (!error && data) {
            scheduleData = data;
        }
    }

    // Group by Day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};
    days.forEach((d) => (grouped[d] = []));

    scheduleData.forEach((item) => {
        if (grouped[item.day_of_week]) {
            grouped[item.day_of_week].push(item);
        }
    });

    // 2. Create the Stage
    const stage = document.createElement('div');
    document.body.appendChild(stage);

    const isPortrait = height > width;

    // Apply Wimpy Styles to Stage
    let stageStyles = {
        width: width + 'px',
        height: height + 'px',
        position: 'fixed',
        top: '0',
        left: '-9999px',
        zIndex: '-9999',
        fontFamily: '"Patrick Hand", cursive',
        padding: '40px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    };

    let tableColor = '#000';
    let titleColor = '#000';
    let footerColor = '#7f8c8d';

    if (bgStyle === 'paper') {
        stageStyles.backgroundColor = '#fdfbf7';
        stageStyles.backgroundImage = 'repeating-linear-gradient(#fdfbf7 0px, #fdfbf7 29px, #a4b0be 30px)';
    } else {
        // Glassmorphism Base and Theme Colors
        if (bgStyle === 'midnight') {
            stageStyles.background = 'linear-gradient(to bottom, #0f2027, #203a43, #2c5364)';
            titleColor = '#fff';
            footerColor = 'rgba(255,255,255,0.7)';
            tableColor = '#fff';
        } else if (bgStyle === 'sunset') {
            stageStyles.background = 'linear-gradient(to right, #ff7e5f, #feb47b)';
        } else if (bgStyle === 'ocean') {
            stageStyles.background = 'linear-gradient(to top, #30cfd0 0%, #330867 100%)';
            titleColor = '#fff';
            footerColor = 'rgba(255,255,255,0.7)';
            tableColor = '#fff';
        } else if (bgStyle === 'forest') {
            stageStyles.background = 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)';
            titleColor = '#fff';
            footerColor = 'rgba(255,255,255,0.7)';
            tableColor = '#fff';
        } else if (bgStyle === 'ipown') {
            stageStyles.background = 'linear-gradient(to top, #09203f 0%, #537895 100%)'; // Dark blue gradient
            stageStyles.fontFamily = '"Montserrat", sans-serif'; // Override font for ipown
            titleColor = '#fff';
            footerColor = 'rgba(255,255,255,0.9)';
            tableColor = '#fff';
        } else if (bgStyle === 'custom' && customBgData) {
            titleColor = '#fff';
            footerColor = 'rgba(255,255,255,0.9)';
            tableColor = '#fff';
        }
    }

    Object.assign(stage.style, { ...stageStyles });

    // Custom BG Image
    if (bgStyle === 'custom' && customBgData) {
        const bgImg = document.createElement('img');
        bgImg.src = customBgData;
        Object.assign(bgImg.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: '-1',
        });
        stage.appendChild(bgImg);
    }

    // Header (Only for non-ipown, as ipown has its own header)
    if (bgStyle !== 'ipown') {
        const title = document.createElement('h1');
        title.innerHTML = 'CLASS SCHEDULE';
        Object.assign(title.style, {
            fontFamily: '"Permanent Marker", cursive',
            fontSize: isPortrait ? '5rem' : '6rem', // Huge font
            marginBottom: '30px',
            marginTop: '20px',
            transform: 'rotate(-2deg)',
            textShadow: '3px 3px 0px rgba(0,0,0,0.2)',
            color: titleColor,
        });
        stage.appendChild(title);
    }

    // 3. Build the Layout
    // Check if using the specific "Ipown" layout
    if (bgStyle === 'ipown') {
        // IPOWN FORMAT: Refined Wimpy + iPhone Layout
        const container = document.createElement('div');
        Object.assign(container.style, {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            padding: '20px',
            paddingTop: '320px', // High top padding for Lock Screen transparency
        });

        // Title Area
        const headerBox = document.createElement('div');
        headerBox.style.textAlign = 'center';
        headerBox.style.marginBottom = '30px';

        const mainTitle = document.createElement('h1');
        mainTitle.innerText = 'CLASS SCHEDULE';
        Object.assign(mainTitle.style, {
            fontFamily: '"Permanent Marker", cursive',
            fontSize: isPortrait ? '3.8rem' : '5rem', // Slightly toned down
            color: '#000',
            transform: 'rotate(-2deg)',
            margin: '0',
            textShadow: '2px 2px 0px rgba(0,0,0,0.1)',
        });
        headerBox.appendChild(mainTitle);

        const subTitle = document.createElement('h2');
        subTitle.innerText = 'BSIT 2106';
        Object.assign(subTitle.style, {
            fontFamily: '"Patrick Hand", cursive',
            fontSize: isPortrait ? '2rem' : '2.5rem',
            color: '#2d3436',
            marginTop: '5px',
            fontWeight: 'bold',
        });
        headerBox.appendChild(subTitle);
        container.appendChild(headerBox);

        // List Container
        const listContainer = document.createElement('div');
        Object.assign(listContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            // Use flex & justify to distribute, but allow huge gap at bottom if needed
            flex: '1',
            justifyContent: 'space-evenly',
            width: isPortrait ? '92%' : '75%', // Tighter width
            maxWidth: '1000px',
            margin: '0 auto',
            paddingBottom: '50px',
        });

        days.forEach((day) => {
            const dayClasses = grouped[day];
            if (dayClasses.length === 0) return;

            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'stretch', // Stretch to equal height
                background: '#fcfaf5', // Off-white paper color
                border: '2px solid #000', // Thinner border
                borderRadius: '20px 5px 15px 5px', // Less crazy radius
                padding: '0', // Removing padding from container to let children handle it
                overflow: 'hidden', // Contain children
                color: '#000',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.15)',
                transform: `rotate(${Math.random() * 1.5 - 0.75}deg)`, // More subtle rotation
                marginBottom: '15px',
            });

            // Day Name (Left Side Column)
            const dayLabel = document.createElement('div');
            dayLabel.innerText = day.substr(0, 3).toUpperCase(); // Shorten to MON, TUE
            Object.assign(dayLabel.style, {
                fontFamily: '"Permanent Marker", cursive',
                fontSize: isPortrait ? '2rem' : '2.5rem',
                width: '60px', // Fixed small width
                backgroundColor: '#000', // Black sidebar
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                writingMode: 'vertical-lr', // Vertical text
                transform: 'rotate(180deg)', // Fix orientation
                textAlign: 'center',
                borderRight: '2px solid #000',
            });
            row.appendChild(dayLabel);

            // Classes List (Right Side)
            const classListCtx = document.createElement('div');
            Object.assign(classListCtx.style, {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                padding: '15px 20px',
                gap: '12px',
            });

            dayClasses.forEach((cls) => {
                const cRow = document.createElement('div');
                Object.assign(cRow.style, {
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center', // Center vertically
                    fontFamily: '"Patrick Hand", cursive',
                    fontWeight: 'bold',
                    borderBottom: '1px dashed #ccc',
                    paddingBottom: '10px',
                    width: '100%',
                });

                // LEFT: Details
                const leftCol = document.createElement('div');
                Object.assign(leftCol.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '1',
                });

                // Subject
                const subjSpan = document.createElement('div');
                subjSpan.innerText = cls.subject_name;
                Object.assign(subjSpan.style, {
                    fontSize: isPortrait ? '1.4rem' : '1.6rem',
                    color: '#000',
                    lineHeight: '1.2',
                });
                leftCol.appendChild(subjSpan);

                // Time & Prof
                const tStart = format12(cls.start_time);
                const tEnd = format12(cls.end_time);
                const detailsSpan = document.createElement('div');
                detailsSpan.innerHTML = `<span style="color:#c0392b">${tStart}-${tEnd}</span> &bull; <span style="color:#7f8c8d; font-weight:normal;">${cls.instructor || 'TBA'}</span>`;
                detailsSpan.style.fontSize = isPortrait ? '1rem' : '1.2rem';
                detailsSpan.style.marginTop = '2px';
                leftCol.appendChild(detailsSpan);

                cRow.appendChild(leftCol);

                // RIGHT: Vertical Room Tag (Pill)
                const roomNo = (cls.room || 'TBA').replace('RM', '').trim();
                const roomTag = document.createElement('div');
                Object.assign(roomTag.style, {
                    background: '#e74c3c',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '5px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginLeft: '10px',
                    minWidth: '28px',
                    boxShadow: '1px 1px 0 rgba(0,0,0,0.2)',
                    border: '2px solid #000',
                });

                for (let char of roomNo) {
                    const s = document.createElement('span');
                    s.innerText = char;
                    s.style.lineHeight = '0.8';
                    s.style.fontSize = '0.9rem';
                    s.style.fontFamily = '"Permanent Marker", cursive';
                    roomTag.appendChild(s);
                }

                cRow.appendChild(roomTag);
                classListCtx.appendChild(cRow);
            });
            row.appendChild(classListCtx);

            listContainer.appendChild(row);
        });

        container.appendChild(listContainer);
        stage.appendChild(container);
    } else {
        // --- ORIGINAL GRID LAYOUT (Wimpy/Paper/Standard Glass) ---
        const gridContainer = document.createElement('div');
        Object.assign(gridContainer.style, {
            display: 'flex',
            flexWrap: 'nowrap', // Force single row if landscape
            width: '100%',
            height: '100%', // Fill available space
            gap: '15px',
            alignItems: 'stretch',
            justifyContent: 'center',
        });

        // If portrait, might want 2 rows of 3
        if (isPortrait) {
            gridContainer.style.flexWrap = 'wrap';
        }

        days.forEach((day, index) => {
            const dayCol = document.createElement('div');
            Object.assign(dayCol.style, {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                border: bgStyle === 'paper' ? '3px solid #000' : `2px solid ${tableColor}`,
                borderRadius: '10px',
                background: bgStyle === 'paper' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                backdropFilter: 'blur(5px)',
                minWidth: isPortrait ? '45%' : '0', // In portrait, 2 cols per row
            });

            // Day Header
            const header = document.createElement('div');
            header.innerText = day.toUpperCase();
            Object.assign(header.style, {
                background: bgStyle === 'paper' ? '#000' : 'rgba(0,0,0,0.5)',
                color: '#fff',
                textAlign: 'center',
                fontFamily: '"Permanent Marker", cursive',
                fontSize: '1.8rem',
                padding: '10px 0',
            });
            dayCol.appendChild(header);

            // Classes Container
            const list = document.createElement('div');
            Object.assign(list.style, {
                flex: '1',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            });

            const classes = grouped[day];
            if (classes.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.innerText = 'REST DAY';
                Object.assign(emptyMsg.style, {
                    textAlign: 'center',
                    color: bgStyle === 'paper' ? '#bdc3c7' : 'rgba(255,255,255,0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    transform: 'rotate(-5deg)',
                });
                list.appendChild(emptyMsg);
            } else {
                classes.forEach((cls) => {
                    const item = document.createElement('div');

                    // Item Style wrapper
                    Object.assign(item.style, {
                        borderBottom: bgStyle === 'paper' ? '2px dashed #000' : `1px dashed ${tableColor}`,
                        paddingBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'stretch',
                    });

                    // LEFT: Standard Info
                    const leftBox = document.createElement('div');
                    leftBox.style.flex = '1';

                    const tStart = format12(cls.start_time);
                    const tEnd = format12(cls.end_time);
                    // Dynamic Font Sizing for Mobile Optimization
                    const fontSizeTime = isPortrait ? '1.8rem' : '1.4rem';
                    const fontSizeSubj = isPortrait ? '1.5rem' : '1.2rem';
                    const fontSizeProf = isPortrait ? '1.3rem' : '1rem';

                    leftBox.innerHTML = `
                            <div style="font-weight:bold; font-size:${fontSizeTime}; color:${bgStyle === 'paper' ? '#d63031' : '#ff7675'}">${tStart} - ${tEnd}</div>
                            <div style="font-size:${fontSizeSubj}; line-height:1.1; font-weight:bold; color:${tableColor}">${cls.subject_name}</div>
                            <div style="font-size:${fontSizeProf}; margin-top:5px; color:${bgStyle === 'paper' ? '#2d3436' : footerColor}">
                                <i class="fas fa-chalkboard-teacher"></i> ${cls.instructor || 'TBA'}
                            </div>
                        `;
                    item.appendChild(leftBox);

                    // RIGHT: Vertical Room Tag
                    const roomNo = (cls.room || 'TBA').replace('RM', '').trim();
                    const roomTag = document.createElement('div');
                    Object.assign(roomTag.style, {
                        background: '#e74c3c', // Red
                        color: '#fff',
                        borderRadius: '50px',
                        padding: '5px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: '8px',
                        minWidth: '30px',
                        boxShadow: '2px 2px 0 rgba(0,0,0,0.2)',
                        border: bgStyle === 'paper' ? '2px solid #000' : 'none',
                    });

                    // Stack characters
                    for (let char of roomNo) {
                        const s = document.createElement('span');
                        s.innerText = char;
                        s.style.lineHeight = '0.9';
                        s.style.fontSize = fontSizeSubj;
                        s.style.fontFamily = '"Permanent Marker", cursive';
                        roomTag.appendChild(s);
                    }
                    item.appendChild(roomTag);

                    list.appendChild(item);
                });
            }

            dayCol.appendChild(list);
            gridContainer.appendChild(dayCol);
        });

        stage.appendChild(gridContainer);
    }

    // Footer
    const footer = document.createElement('div');
    footer.innerText = 'Generated by Sistema ni JV';
    Object.assign(footer.style, {
        marginTop: '20px',
        fontSize: '2rem',
        color: footerColor,
        fontFamily: bgStyle === 'ipown' ? '"Montserrat", sans-serif' : '"Permanent Marker", cursive',
    });
    stage.appendChild(footer);

    // Capture
    try {
        const canvas = await html2canvas(stage, { scale: 1, useCORS: true, logging: false });
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `WimpySchedule_${width}x${height}_${Date.now()}.png`;
        showWallpaperPreview(dataUrl, filename);
    } catch (err) {
        console.error(err);
        alert('Oops! Could not generate wallpaper.');
    } finally {
        setTimeout(() => stage.remove(), 2000);
        btn.innerHTML = originalText;
        btn.disabled = false;
        document.getElementById('wallpaperModal').classList.add('hidden');
    }
};
