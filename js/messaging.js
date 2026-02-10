// messaging.js - Chat & Inbox Logic
// Relies on window.db (Supabase) and window.user (Current User)

let currentChatPartnerId = null;
let allClassmates = [];

window.initMessaging = async function () {
    const user = window.user;
    if (!user) return;

    // Prevent duplicate subscriptions
    if (window.msgSubscription) await window.db.removeChannel(window.msgSubscription);

    // Subscribe to incoming messages
    window.msgSubscription = window.db.channel('public:messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
        }, payload => {
            handleIncomingMessage(payload.new);
        })
        .subscribe();

    checkUnreadCount();
}

// --- NEW CHAT / RECIPIENT LOGIC ---
window.openNewChatModal = async function () {
    const user = window.user;
    if (!user) return;

    const modal = document.getElementById('newChatModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    const list = document.getElementById('recipient-list');
    list.innerHTML = '<div class="loader" style="font-size:1rem;">Finding classmates...</div>';

    // Fetch all students except self
    const { data, error } = await window.db
        .from('students')
        .select('id, name, sr_code, avatar_url')
        .neq('id', user.id)
        .order('name', { ascending: true });

    if (error) {
        list.innerHTML = '<p>Error loading classmates.</p>';
        return;
    }

    allClassmates = data;
    renderRecipientList(allClassmates);
    setTimeout(() => document.getElementById('recipient-search').focus(), 100);
}

function renderRecipientList(students) {
    const list = document.getElementById('recipient-list');
    if (!students || students.length === 0) {
        list.innerHTML = '<p style="text-align:center; margin-top:20px;">No one found.</p>';
        return;
    }

    list.innerHTML = students.map(s => {
        const avatar = s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`;
        return `
            <div onclick="openChatModal('${s.id}', '${escapeHTML(s.name)}'); document.getElementById('newChatModal').classList.add('hidden');" 
                 style="display:flex; align-items:center; gap:10px; padding:10px; background:#fff; border:2px solid #000; border-radius:10px; cursor:pointer; transition:transform 0.1s;"
                 onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${avatar}" style="width:35px; height:35px; border-radius:50%; border:1px solid #000; object-fit:cover;">
                <div style="font-weight:bold;">${escapeHTML(s.name)} <small style="color:#666; font-weight:normal;">(${escapeHTML(s.sr_code)})</small></div>
            </div>
        `;
    }).join('');
}

window.filterRecipients = function () {
    const q = document.getElementById('recipient-search').value.toLowerCase();
    const filtered = allClassmates.filter(s => s.name.toLowerCase().includes(q) || s.sr_code.toLowerCase().includes(q));
    renderRecipientList(filtered);
}

window.openChatModal = async function (partnerId, partnerName) {
    const user = window.user;
    if (!user) return;
    if (partnerId === user.id) return showToast("Talking to yourself?");

    currentChatPartnerId = partnerId;
    document.getElementById('chat-with-name').innerHTML = `<i class="fas fa-comments"></i> Chat with ${partnerName}`;
    document.getElementById('chat-target-id').value = partnerId;
    document.getElementById('chatModal').classList.remove('hidden');

    await loadChatHistory(partnerId);
    markMessagesAsRead(partnerId);
}

window.closeChatModal = function () {
    document.getElementById('chatModal').classList.add('hidden');
    currentChatPartnerId = null;
}

async function loadChatHistory(partnerId) {
    const user = window.user;
    if (!user) return;

    const container = document.getElementById('chat-history');
    container.innerHTML = '<div class="loader" style="font-size:1rem;">Loading notes...</div>';

    const { data, error } = await window.db
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        container.innerHTML = '<p>Error loading messages.</p>';
        return;
    }
    renderMessages(data);
}

function renderMessages(messages) {
    const user = window.user;

    const container = document.getElementById('chat-history');
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">No notes yet. Say hi!</p>';
        return;
    }
    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender_id === user.id;
        return `<div class="chat-bubble ${isMe ? 'me' : 'them'}">${escapeHTML(msg.content)}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendChatMessage = async function (e) {
    e.preventDefault();
    const user = window.user;
    if (!user) return;

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const targetId = document.getElementById('chat-target-id').value;

    if (!content || !targetId) return;

    // Optimistic UI
    const container = document.getElementById('chat-history');
    const tempDiv = document.createElement('div');
    tempDiv.className = 'chat-bubble me';
    tempDiv.innerText = content;
    container.appendChild(tempDiv);
    container.scrollTop = container.scrollHeight;
    input.value = '';

    await window.db.from('messages').insert([{ sender_id: user.id, receiver_id: targetId, content: content }]);
}

function handleIncomingMessage(msg) {
    if (currentChatPartnerId === msg.sender_id) {
        const container = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = 'chat-bubble them';
        div.innerText = msg.content;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        markMessagesAsRead(msg.sender_id);
    } else {
        // Play sound
        const audio = document.getElementById('notif-sound');
        if (audio) audio.play().catch(e => console.log("Audio blocked:", e));

        checkUnreadCount();

        // NEW: Instantly refresh inbox list if it is currently open
        const inboxModal = document.getElementById('inboxModal');
        if (inboxModal && !inboxModal.classList.contains('hidden')) {
            refreshInboxList(false); // false = don't show loading spinner (seamless update)
        }

        // Interactive Toast (Click to Open Inbox)
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.cursor = 'pointer';
            toast.innerHTML = `<b><i class="fas fa-envelope"></i> New Note!</b><br><span style="font-size:0.9rem">Click to read</span>`;
            toast.onclick = () => { toast.remove(); openInboxModal(); };
            container.appendChild(toast);
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
        }
    }
}

async function checkUnreadCount() {
    const user = window.user;
    if (!user) return;

    const { count } = await window.db.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('is_read', false);
    const badge = document.getElementById('msg-badge');
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

async function markMessagesAsRead(senderId) {
    const user = window.user;
    if (!user) return;
    await window.db.from('messages').update({ is_read: true }).eq('sender_id', senderId).eq('receiver_id', user.id);
    checkUnreadCount();
}

window.openInboxModal = async function () {
    const modal = document.getElementById('inboxModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    await refreshInboxList(true); // true = show loading spinner on first open
}

window.refreshInboxList = async function (showLoader = true) {
    const user = window.user;
    const list = document.getElementById('inbox-list');
    if (!list) return;

    if (showLoader) list.innerHTML = '<div class="loader" style="font-size:1rem;">Checking mail...</div>';

    if (!user) return;

    // 1. Fetch all messages involving user
    const { data: msgs, error } = await window.db
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        list.innerHTML = '<p>Error loading inbox.</p>';
        return;
    }

    if (!msgs || msgs.length === 0) {
        list.innerHTML = '<p style="text-align:center; margin-top:20px; color:#666;">No messages yet.</p>';
        return;
    }

    // 2. Group by conversation partner
    const conversations = {};
    msgs.forEach(m => {
        const isMe = m.sender_id === user.id;
        const partnerId = isMe ? m.receiver_id : m.sender_id;

        if (!conversations[partnerId]) {
            conversations[partnerId] = { partnerId, lastMessage: m, unreadCount: 0 };
        }
        if (!isMe && !m.is_read) conversations[partnerId].unreadCount++;
    });

    const partnerIds = Object.keys(conversations);

    // 3. Fetch partner details
    const { data: students } = await window.db.from('students').select('id, name, avatar_url').in('id', partnerIds);

    if (!students) { list.innerHTML = '<p>Error loading users.</p>'; return; }

    // 4. Sort: Unread first, then by latest message date
    students.sort((a, b) => {
        const convA = conversations[a.id];
        const convB = conversations[b.id];

        // If one has unread and other doesn't, unread goes first
        if (convA.unreadCount > 0 && convB.unreadCount === 0) return -1;
        if (convA.unreadCount === 0 && convB.unreadCount > 0) return 1;

        // Otherwise sort by latest message time
        return new Date(convB.lastMessage.created_at) - new Date(convA.lastMessage.created_at);
    });

    // 5. Render list
    list.innerHTML = students.map(s => {
        const conv = conversations[s.id];
        const isUnread = conv.unreadCount > 0;
        const bgStyle = isUnread ? 'background:#fff740;' : 'background:#fff;';
        const avatar = s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`;
        const date = new Date(conv.lastMessage.created_at).toLocaleDateString();
        const prefix = conv.lastMessage.sender_id === user.id ? 'You: ' : '';
        const preview = conv.lastMessage.content.length > 25 ? conv.lastMessage.content.substring(0, 25) + '...' : conv.lastMessage.content;

        return `
            <div onclick="openChatModal('${s.id}', '${escapeHTML(s.name)}'); document.getElementById('inboxModal').classList.add('hidden');" 
                 style="display:flex; align-items:center; gap:10px; padding:10px; ${bgStyle} border:2px solid #000; border-radius:10px; cursor:pointer; transition:transform 0.2s;"
                 onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; border:1px solid #000; object-fit:cover;">
                <div style="flex:1; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between;"><strong style="font-size:1.1rem;">${escapeHTML(s.name)}</strong><small style="font-size:0.8rem; color:#666;">${date}</small></div>
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#555; font-size:0.9rem;">${prefix}${escapeHTML(preview)}</div>
                </div>
                ${isUnread ? `<div style="background:#d63031; color:#fff; font-weight:bold; padding:2px 8px; border-radius:50%; font-size:0.8rem;">${conv.unreadCount}</div>` : ''}
            </div>
        `;
    }).join('');
}

// --- MESSAGE MANAGER (ADMIN) ---
window.fetchAdminMessages = async function () {
    const list = document.getElementById('admin-message-list');
    if (!list) return;

    list.innerHTML = '<div class="loader" style="font-size:1rem;">Loading conversations...</div>';

    // 1. Fetch Students Map
    const { data: students, error: sError } = await window.db.from('students').select('id, name');
    if (sError) { console.error(sError); return; }

    const studentMap = {};
    students.forEach(s => studentMap[s.id] = s.name);

    // 2. Fetch Messages
    const { data: msgs, error } = await window.db
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        console.error(error);
        list.innerHTML = '<p>Error loading messages.</p>';
        return;
    }

    if (!msgs || msgs.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#666;">No messages found.</p>';
        return;
    }

    // 3. Group by Conversation
    const conversations = {};
    msgs.forEach(m => {
        // Create a unique key for the pair (sorted IDs ensures A-B is same as B-A)
        const key = [m.sender_id, m.receiver_id].sort().join('::');

        if (!conversations[key]) {
            conversations[key] = {
                lastMsg: m,
                count: 0
            };
        }
        conversations[key].count++;
    });

    // 4. Render List
    list.innerHTML = Object.keys(conversations).map(key => {
        const [u1, u2] = key.split('::');
        const conv = conversations[key];

        const name1 = studentMap[u1] || 'Unknown';
        const name2 = studentMap[u2] || 'Unknown';
        const date = new Date(conv.lastMsg.created_at).toLocaleDateString();
        const preview = conv.lastMsg.content.length > 30 ? conv.lastMsg.content.substring(0, 30) + '...' : conv.lastMsg.content;

        return `
            <div onclick="viewAdminConversation('${u1}', '${u2}')" 
                 style="background:#fff; border:2px solid #000; padding:10px; margin-bottom:8px; border-radius:5px; cursor:pointer; transition:transform 0.1s; display:flex; justify-content:space-between; align-items:center;"
                 onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:1.1rem;">${name1} <i class="fas fa-exchange-alt" style="font-size:0.8rem; color:#666;"></i> ${name2}</div>
                    <div style="font-size:0.9rem; color:#555;">${preview}</div>
                    <div style="font-size:0.8rem; color:#888;">${conv.count} messages • Last: ${date}</div>
                </div>
                <div style="font-size:1.2rem; color:#000;"><i class="fas fa-chevron-right"></i></div>
            </div>
        `;
    }).join('');
}

window.viewAdminConversation = async function (id1, id2) {
    const list = document.getElementById('admin-message-list');
    list.innerHTML = '<div class="loader" style="font-size:1rem;">Loading chat history...</div>';

    // Fetch names
    const { data: students } = await window.db.from('students').select('id, name').in('id', [id1, id2]);
    const nameMap = {};
    if (students) students.forEach(s => nameMap[s.id] = s.name);

    const name1 = nameMap[id1] || 'Unknown';
    const name2 = nameMap[id2] || 'Unknown';

    // Fetch Messages
    const { data: msgs, error } = await window.db
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${id1},receiver_id.eq.${id2}),and(sender_id.eq.${id2},receiver_id.eq.${id1})`)
        .order('created_at', { ascending: true });

    if (error) {
        list.innerHTML = '<p>Error loading chat.</p><button onclick="fetchAdminMessages()" class="sketch-btn">Back</button>';
        return;
    }

    const header = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:2px dashed #000; padding-bottom:10px;">
            <button onclick="fetchAdminMessages()" class="sketch-btn" style="width:auto; padding:5px 10px; font-size:0.9rem;"><i class="fas fa-arrow-left"></i> Back</button>
            <div style="font-weight:bold; font-size:1rem;">${name1} & ${name2}</div>
            <button onclick="deleteConversation('${id1}', '${id2}')" class="sketch-btn danger" style="width:auto; padding:5px 10px; font-size:0.9rem;"><i class="fas fa-trash"></i> Delete All</button>
        </div>
    `;

    const body = msgs.map(m => {
        const senderName = nameMap[m.sender_id] || 'Unknown';
        const date = new Date(m.created_at).toLocaleString();
        return `
            <div style="background:#f1f2f6; border:1px solid #ccc; padding:8px; margin-bottom:5px; border-radius:5px; position:relative;">
                <div style="font-size:0.75rem; color:#666; margin-bottom:3px;"><b>${senderName}</b> • ${date}</div>
                <div style="font-family:'Patrick Hand'; font-size:1.1rem; padding-right:25px; word-break:break-word;">${m.content}</div>
                <button onclick="deleteMessage('${m.id}', '${id1}', '${id2}')" class="sketch-btn danger" style="position:absolute; top:5px; right:5px; padding:0 5px; width:20px; height:20px; font-size:0.8rem; line-height:1; display:flex; align-items:center; justify-content:center;">X</button>
            </div>
        `;
    }).join('');

    list.innerHTML = header + `<div style="max-height:350px; overflow-y:auto;">${body || '<p style="text-align:center;">No messages found.</p>'}</div>`;
}

window.deleteConversation = async function (id1, id2) {
    if (!await showWimpyConfirm('Delete ENTIRE conversation history?')) return;

    const { error } = await window.db
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${id1},receiver_id.eq.${id2}),and(sender_id.eq.${id2},receiver_id.eq.${id1})`);

    if (error) showToast('Error: ' + error.message);
    else {
        showToast('Conversation deleted.');
        fetchAdminMessages();
    }
}

window.deleteMessage = async function (id, viewId1, viewId2) {
    if (!await showWimpyConfirm('Delete this message?')) return;
    const { error } = await window.db.from('messages').delete().eq('id', id);
    if (error) showToast('Error: ' + error.message);
    else {
        showToast('Message deleted.');
        if (viewId1 && viewId2) viewAdminConversation(viewId1, viewId2);
        else fetchAdminMessages();
    }
}

window.deleteOldMessages = async function () {
    if (!await showWimpyConfirm('Delete ALL messages older than 30 days?')) return;
    const date = new Date(); date.setDate(date.getDate() - 30);
    const { error } = await window.db.from('messages').delete().lt('created_at', date.toISOString());
    if (error) showToast('Error: ' + error.message); else { showToast('Old messages cleared.'); fetchAdminMessages(); }
}
