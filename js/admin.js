// admin.js - Admin & Manager Tools
// Relies on window.db and window.user

// --- ADMIN TOOL TOGGLE ---
window.showAdminTool = function (toolId, btnElement) {
    // 0. Permission Check
    if (toolId) {
        const toolIdToPerm = {
            'admin-schedule-form': 'schedule',
            'admin-assignment-form': 'homework',
            'admin-event-form': 'event',
            'admin-file-form': 'file',
            'admin-todo-form': 'todo',
            'admin-email-form': 'email',
            'admin-message-manager': 'messages',
            'admin-gallery-form': 'gallery',
            'admin-storage-view': 'storage',
            'admin-promote-form': 'promote',
            'admin-revoke-form': 'revoke',
            'admin-blacklist-view': 'blacklist',
            'admin-announcement-form': 'announcement'
        };

        const permKey = toolIdToPerm[toolId];
        if (permKey) {
            // "promote", "revoke", and "announcement" are strictly for MAIN ADMIN
            if (permKey === 'promote' || permKey === 'revoke' || permKey === 'announcement') {
                if (window.user.sr_code !== 'ADMIN') {
                    showToast("Only the BOSS can do this!", "error");
                    return;
                }
            } else if (!hasPermission(permKey)) {
                showToast("You don't have access to this tool.", "error");
                return;
            }
        }
    }

    // 1. Reset all buttons
    document.querySelectorAll('.filter-bar .sketch-btn').forEach(b => b.classList.remove('active-tool'));

    // Hide all admin forms
    const forms = ['admin-schedule-form', 'admin-assignment-form', 'admin-event-form', 'admin-file-form', 'admin-email-form', 'admin-message-manager', 'admin-gallery-form', 'admin-storage-view', 'admin-promote-form', 'admin-revoke-form', 'admin-todo-form', 'admin-announcement-form'];
    let isAlreadyOpen = false;

    forms.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.id === toolId && el.style.display === 'block') isAlreadyOpen = true;
            el.style.display = 'none';
        }
    });

    const hint = document.getElementById('admin-tool-hint');

    // 2. Show selected if not already open (Toggle logic)
    if (toolId && !isAlreadyOpen) {
        const selected = document.getElementById(toolId);
        if (selected) selected.style.display = 'block';
        if (hint) hint.style.display = 'none';
        if (btnElement) btnElement.classList.add('active-tool');

        // Lazy Load Data
        if (toolId === 'admin-message-manager' && window.fetchAdminMessages) window.fetchAdminMessages();
        if (toolId === 'admin-storage-view') window.fetchStorageStats();
        if (toolId === 'admin-gallery-form') window.fetchAdminGalleryList();
        if (toolId === 'admin-email-form' && window.populateEmailDropdown) window.populateEmailDropdown();
        if (toolId === 'admin-promote-form') window.populatePromoteDropdown();
        if (toolId === 'admin-revoke-form') window.populateRevokeDropdown();
    } else {
        // If closing or clicking active, show hint
        if (hint) hint.style.display = 'block';
    }
}

// --- STORAGE MONITOR ---
window.fetchStorageStats = async function () {
    const display = document.getElementById('storage-stats-display');
    if (!display) return;

    display.innerHTML = '<div class="loader">Scanning crates...</div>';

    const buckets = ['class-resources', 'avatars'];
    let bucketHtml = '';
    let grandTotalBytes = 0;

    for (const bucket of buckets) {
        // Fetch list of files (limit 1000 to get a good count)
        const { data, error } = await window.db.storage.from(bucket).list('', { limit: 1000 });

        if (error) {
            bucketHtml += `<div class="class-card" style="border-left: 5px solid #d63031; margin-bottom: 10px;"><p>Error scanning <b>${bucket}</b>: ${error.message}</p></div>`;
            continue;
        }

        const count = data.length;
        let totalSize = 0;
        data.forEach(f => totalSize += (f.metadata ? f.metadata.size : 0));
        grandTotalBytes += totalSize;

        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        bucketHtml += `
            <div class="class-card" style="margin-bottom: 10px; border-left: 5px solid #6c5ce7;">
                <h3 style="margin-top:0;">Bucket: ${bucket}</h3>
                <div style="display:flex; justify-content:space-between; font-size:1.1rem;">
                    <span><b>Files:</b> ${count}</span>
                    <span><b>Size:</b> ${sizeMB} MB</span>
                </div>
            </div>
        `;
    }

    // Calculate Totals
    const totalMB = (grandTotalBytes / (1024 * 1024)).toFixed(2);
    const limitGB = 1; // 1GB Limit
    const limitBytes = limitGB * 1024 * 1024 * 1024;
    const percent = Math.min(100, ((grandTotalBytes / limitBytes) * 100)).toFixed(1);

    const summaryHtml = `
        <div class="class-card" style="margin-bottom: 20px; border: 2px solid #000; background: #fff740; transform: rotate(-1deg);">
            <h3 style="margin-top:0;">📦 Storage Used</h3>
            <div style="font-size: 2rem; font-weight: bold; margin: 10px 0;">${totalMB} MB <span style="font-size:1rem; font-weight:normal;">/ 1 GB</span></div>
            <div style="width:100%; height:20px; background:#fff; border:2px solid #000; border-radius:10px; overflow:hidden;">
                <div style="height:100%; background:${percent > 80 ? '#d63031' : '#00b894'}; width:${percent}%;"></div>
            </div>
            <p style="text-align:right; margin:5px 0 0 0;">${percent}% Used</p>
        </div>
    `;

    display.innerHTML = summaryHtml + bucketHtml;
}

// --- FILE UPLOAD (Admin Resources) ---
window.uploadFile = async function (e) {
    e.preventDefault();
    if (!window.isAdmin) return;

    const fileInput = document.getElementById('f-file');
    const titleInput = document.getElementById('f-title');
    const subjectInput = document.getElementById('f-subject');
    const btn = document.getElementById('upload-btn');
    const file = fileInput.files[0];

    if (!file) return showToast('Please select a file.');
    if (!subjectInput.value) return showToast('Please select a subject.');

    btn.disabled = true;
    btn.innerHTML = 'Uploading...';

    try {
        const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;

        // 1. Upload
        const { error: uploadError } = await window.db.storage
            .from('class-resources')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. Get URL
        const { data: urlData } = window.db.storage
            .from('class-resources')
            .getPublicUrl(fileName);

        // 3. Save to DB with Subject
        const { error: dbError } = await window.db.from('shared_files').insert([{
            title: titleInput.value,
            subject: subjectInput.value,
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbError) throw dbError;

        showToast('File added to ' + subjectInput.value + ' folder!');
        if (window.loadFiles) window.loadFiles(subjectInput.value);
        e.target.reset();

    } catch (error) {
        console.error(error);
        showToast('Upload failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paperclip"></i> Upload to Cabinet';
    }
}

window.deleteFile = async function (id) {
    if (!await showWimpyConfirm('Delete this file?')) return;
    const { error } = await window.db.from('shared_files').delete().eq('id', id);
    if (error) showToast('Error deleting file.');
    else {
        showToast('File removed.');
        if (window.loadFiles) window.loadFiles();
    }
}

// --- EMAIL BLAST (EmailJS) ---
window.sendEmailService = async function (e) {
    e.preventDefault();

    const SERVICE_ID = 'service_crvq85j';
    const TEMPLATE_ID = 'template_jhu61sc';

    if (!window.isAdmin) return showToast("Admins only!");

    const recipientSelect = document.getElementById('email-recipient');
    const subjectInput = document.getElementById('email-subject');
    const bodyInput = document.getElementById('email-body');
    const btn = e.target.querySelector('button');

    // CHECK: Who are we sending to?
    const selectedValue = recipientSelect.value;

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        let emailList = "";

        // SCENARIO 1: SEND TO EVERYONE
        if (selectedValue === 'ALL') {
            btn.innerText = "Gathering all emails...";
            const { data, error } = await window.db
                .from('students')
                .select('email')
                .neq('sr_code', 'ADMIN')
                .not('email', 'is', null)
                .neq('email', '');

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("No emails found!");

            emailList = data.map(s => s.email).join(',');
        }
        // SCENARIO 2: SEND TO SPECIFIC PERSON
        else {
            emailList = selectedValue;
        }

        console.log("Sending to:", emailList);

        const templateParams = {
            subject: subjectInput.value,
            message: bodyInput.value,
            bcc: emailList,
            from_name: window.user.name
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
        showToast('Bird sent the letter!');
        e.target.reset();

    } catch (error) {
        console.error("Email Error:", error);
        showToast("Failed to send: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Send via Carrier Pigeon";
    }
}

// --- ADMIN GALLERY ---
window.fetchAdminGalleryList = async function () {
    const list = document.getElementById('admin-gallery-list');
    if (!list) return;

    list.innerHTML = '<div class="loader">Loading photos...</div>';

    const { data, error } = await window.db
        .from('shared_files')
        .select('*')
        .eq('subject', 'LandingGallery')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '<p>Error.</p>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p>No photos in gallery.</p>';
        return;
    }

    list.innerHTML = data.map(file => `
        <div class="class-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${file.file_url}" style="width:50px; height:50px; object-fit:cover; border:1px solid #000;">
                <div>${escapeHTML(file.title)}</div>
            </div>
            <button onclick="deleteGalleryImage('${file.id}')" class="sketch-btn danger" style="padding:5px 10px; width:auto;">X</button>
        </div>
    `).join('');
}


window.uploadGalleryItem = async function (e) {
    e.preventDefault();
    if (!window.isAdmin) return;

    const fileInput = document.getElementById('g-file');
    const captionInput = document.getElementById('g-caption');
    const btn = document.getElementById('upload-gallery-btn');
    const file = fileInput.files[0];

    if (!file) return showToast('Select an image.');

    btn.disabled = true;
    btn.innerText = 'Uploading...';

    try {
        const fileName = `gallery_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
        // Upload to 'class-resources' or a new bucket? existing logic usually uses 'class-resources' for files.
        // Assuming 'class-resources' based on uploadFile logic.

        const { error: upErr } = await window.db.storage.from('class-resources').upload(fileName, file);
        if (upErr) throw upErr;

        const { data: urlData } = window.db.storage.from('class-resources').getPublicUrl(fileName);

        const { error: dbErr } = await window.db.from('shared_files').insert([{
            title: captionInput.value || 'Gallery Image',
            subject: 'LandingGallery',
            file_url: urlData.publicUrl,
            file_type: file.type
        }]);

        if (dbErr) throw dbErr;

        showToast('Photo added to gallery!');
        e.target.reset();
        fetchAdminGalleryList();
    } catch (err) {
        showToast('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Upload to Gallery';
    }
}

window.deleteGalleryImage = async function (id) {
    if (!await showWimpyConfirm('Remove this photo?')) return;
    const { error } = await window.db.from('shared_files').delete().eq('id', id);
    if (error) showToast('Error: ' + error.message);
    else {
        showToast('Photo removed.');
        fetchAdminGalleryList();
    }
}

// --- MANAGE ROLES ---
window.populatePromoteDropdown = async function () {
    const dropdown = document.getElementById('promote-user-select');
    if (!dropdown) return;

    // Fetch ALL users except the Main Admin (allows updating permissions for existing admins)
    const { data } = await window.db.from('students').select('id, name, sr_code').neq('sr_code', 'ADMIN').order('name');
    if (data) {
        dropdown.innerHTML = '<option value="" disabled selected>Select User to Promote/Update</option>' +
            data.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');
    }
}

window.promoteUser = async function (e) {
    e.preventDefault();
    const userId = document.getElementById('promote-user-select').value;
    if (window.user.sr_code !== 'ADMIN') return showToast('Only the MAIN ADMIN can promote users.', 'error');
    if (!userId) return showToast('Select a user.');

    // Gather permissions
    const checkboxes = document.querySelectorAll('.tool-perm:checked');
    const perms = Array.from(checkboxes).map(cb => cb.value);

    let newRole = 'admin';
    if (perms.length > 0) {
        newRole = `admin:tools:${perms.join(',')}`;
    }

    const { error } = await window.db.from('students').update({ role: newRole }).eq('id', userId);
    if (error) showToast('Error: ' + error.message, 'error');
    else {
        showToast('User privileges updated!');
        e.target.reset();
        populatePromoteDropdown();
        populateRevokeDropdown();
    }
}

window.populateRevokeDropdown = async function () {
    const dropdown = document.getElementById('revoke-user-select');
    if (!dropdown) return;

    // Fetch ANY admin (legacy or granular) except Main Admin
    const { data } = await window.db.from('students')
        .select('id, name, sr_code')
        .ilike('role', 'admin%') // Matches 'admin' and 'admin:tools:...'
        .neq('sr_code', 'ADMIN')
        .order('name');

    if (data) {
        dropdown.innerHTML = '<option value="" disabled selected>Select Admin</option>' +
            data.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');
    }
}

window.revokeAdmin = async function (e) {
    e.preventDefault();
    const userId = document.getElementById('revoke-user-select').value;
    if (!window.user || window.user.sr_code !== 'ADMIN') return showToast('Only Main Admin can revoke.');
    if (!userId) return showToast('Select user.');

    if (!await showWimpyConfirm('Revoke admin access?')) return;

    const { error } = await window.db.from('students').update({ role: 'student' }).eq('id', userId);
    if (error) showToast('Error: ' + error.message);
    else {
        showToast('Access revoked.');
        e.target.reset();
        populateRevokeDropdown();
    }
}

// --- EMAIL DROPDOWN POPULATION ---
window.populateEmailDropdown = async function () {
    const dropdown = document.getElementById('email-recipient');
    if (!dropdown) return;

    // Fetch Name, SR Code, and Email of all students
    const { data, error } = await window.db
        .from('students')
        .select('name, sr_code, email')
        .neq('sr_code', 'ADMIN') // Don't list the admin
        .order('name', { ascending: true });

    if (error) return console.error("Error loading recipients:", error);

    // Keep the "Everyone" option, remove others to avoid duplicates if reloaded
    dropdown.innerHTML = '<option value="ALL">Send to Everyone (Blast)</option>';

    data.forEach(student => {
        // Only add if they have an email
        if (student.email) {
            const option = document.createElement('option');
            option.value = student.email; // The value is the email address
            option.innerText = `${student.name} (${student.sr_code})`;
            dropdown.appendChild(option);
        }
    });
}
window.quickAddHomeworkToEmail = function () {
    const tasks = window.assignmentsData || [];
    if (tasks.length === 0) return showToast("No homework found to attach!");

    const body = document.getElementById('email-body');

    // Format the list
    let text = "📚 UPCOMING HOMEWORK & TASKS:\n";
    tasks.forEach((t, i) => {
        const date = t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
        text += `${i + 1}. [${t.subject}] ${t.title} - Due: ${date}\n`;
    });

    text += "\nAralll mabutiii! 📝";

    body.value = text;
    body.focus();
}

// --- REALTIME ANNOUNCEMENT BROADCAST ---
// --- REALTIME ANNOUNCEMENT BROADCAST ---
window.broadcastAnnouncement = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (window.user.sr_code !== 'ADMIN') return showToast("Nice try, but only the BOSS can broadcast!", "error");

    const msgInput = document.getElementById('announcement-msg');
    const durInput = document.getElementById('announcement-duration');
    const btn = document.getElementById('broadcast-btn');

    const message = msgInput ? msgInput.value.trim() : "";
    const duration = parseInt(durInput ? durInput.value : 10) || 10;

    await window.performBroadcast(message, duration, btn);
    if (msgInput) msgInput.value = '';
}

window.quickAddAnnouncement = async function () {
    if (window.user.sr_code !== 'ADMIN') return;

    // Create Modal Elements
    const overlay = document.createElement('div');
    overlay.className = 'wimpy-modal-overlay';
    overlay.id = 'quick-ann-overlay';
    overlay.style.zIndex = '10006';

    const box = document.createElement('div');
    box.className = 'wimpy-modal-box';
    box.style.maxWidth = '400px';
    box.style.padding = '25px';
    box.style.background = '#fff';
    box.style.transform = 'rotate(0.5deg)';

    box.innerHTML = `
        <div style="text-align:left; position:relative;">
            <h2 style="margin:0 0 10px 0; font-family:'Patrick Hand'; font-size:1.8rem;">
                <i class="fas fa-bullhorn" style="color:#d63031;"></i> Quick Broadcast
            </h2>
            <p style="font-family:'Patrick Hand'; color:#666; font-size:1rem; margin-bottom:15px;">
                Type your message and set the duration:
            </p>
            
            <textarea id="qa-msg" placeholder="What's the news, Boss?" 
                style="width:100%; height:120px; border:3px solid #000; border-radius:3px; padding:15px; font-family:'Patrick Hand'; font-size:1.2rem; background:#fffdf0; box-sizing:border-box; outline:none; margin-bottom:15px;"></textarea>
            
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px; font-family:'Patrick Hand';">
                <span>Duration:</span>
                <select id="qa-dur" style="border:2px solid #000; border-radius:3px; padding:5px; font-family:'Patrick Hand';">
                    <option value="5">5 Mins</option>
                    <option value="10" selected>10 Mins</option>
                    <option value="30">30 Mins</option>
                    <option value="60">1 Hour</option>
                </select>
            </div>

            <div style="display:flex; gap:10px;">
                <button id="qa-cancel" class="sketch-btn danger" style="flex:1;">CANCEL</button>
                <button id="qa-send" class="sketch-btn" style="flex:2; background:#000; color:#fff;">BROADCAST NOW</button>
            </div>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus textarea
    setTimeout(() => document.getElementById('qa-msg').focus(), 100);

    // Cancel logic
    document.getElementById('qa-cancel').onclick = () => overlay.remove();

    // Send logic
    document.getElementById('qa-send').onclick = async () => {
        const msg = document.getElementById('qa-msg').value.trim();
        const dur = parseInt(document.getElementById('qa-dur').value);
        const btn = document.getElementById('qa-send');

        if (!msg) {
            showToast("Message is empty!", "warning");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        await window.performBroadcast(msg, dur, btn);
        overlay.remove();
    };
};

window.performBroadcast = async function (message, duration, btn = null) {
    if (!message) return showToast("Announcement is empty!", "error");

    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    }

    try {
        if (!window.roomChannel) {
            window.roomChannel = window.db.channel('room-1');
            await window.roomChannel.subscribe();
        }

        const { data: dbData, error: dbError } = await window.db.from('notes').insert([{
            content: message,
            color: 'GLOBAL_MSG',
            x_pos: duration,
            y_pos: 0,
            rotation: 0,
            likes: 0
        }]).select();

        if (dbError) throw dbError;
        const announcementId = dbData[0].id;

        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Broadcasting...';

        const resp = await window.roomChannel.send({
            type: 'broadcast',
            event: 'announcement',
            payload: {
                id: announcementId,
                message: message,
                admin_name: window.user.name,
                admin_avatar: window.user.avatar_url
            }
        });

        if (resp !== 'ok') throw new Error("Broadcast failed. Check connection.");

        showToast("📢 Announcement sent to everyone!");

        if (window.showAnnouncementPopup) {
            window.showAnnouncementPopup({
                id: announcementId,
                message: message,
                admin_name: window.user.name,
                admin_avatar: window.user.avatar_url
            });
        }

        // Refresh sidebar list if it exists
        if (window.loadRecentAnnouncementsSidebar) {
            window.loadRecentAnnouncementsSidebar();
        }

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml || '<i class="fas fa-broadcast-tower"></i> BROADCAST NOW';
        }
    }
}

// --- AUTO-CLEANUP ANNOUNCEMENTS (Smart Expiration) ---
// This runs for the admin to keep the DB clean as requested
setInterval(async () => {
    if (!window.user || window.user.sr_code !== 'ADMIN' || !window.db) return;

    try {
        // 1. Fetch all active announcements
        const { data: announcements, error: fetchErr } = await window.db
            .from('notes')
            .select('id, created_at, x_pos')
            .eq('color', 'GLOBAL_MSG');

        if (fetchErr) throw fetchErr;

        const now = Date.now();
        const expiredIds = [];

        if (announcements) {
            announcements.forEach(ann => {
                const createdAt = new Date(ann.created_at).getTime();
                const durationMs = (parseInt(ann.x_pos) || 10) * 60 * 1000;

                if (now > (createdAt + durationMs)) {
                    expiredIds.push(ann.id);
                }
            });
        }

        if (expiredIds.length > 0) {
            console.log("System: Expiring", expiredIds.length, "announcements.");

            // Delete expired announcements
            await window.db.from('notes').delete().in('id', expiredIds);

            // Also delete associated comments for these expired announcements
            const commentColors = expiredIds.map(id => `COMMENT:${id}`);
            await window.db.from('notes').delete().in('color', commentColors);
        }

        // 2. Legacy/General Cleanup (Delete anything older than 24 hours just in case)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await window.db.from('notes').delete()
            .or(`color.eq.GLOBAL_MSG,color.ilike.COMMENT:%`)
            .lt('created_at', oneDayAgo);

    } catch (err) {
        console.error("Cleanup error:", err);
    }
}, 60000); // Check every minute
