// --- IMPROVISED GROUP CHAT SYSTEM ---
// Leveraging the 'notes' table to simulate a group chat without DB schema changes.
// Chat messages are stored as notes with color = 'CHAT_HIDDEN'.
// The 'content' field stores a JSON string: { u: "Name", a: "Avatar", m: "Message", t: Timestamp, id: UserID }

const GC_SUPABASE_URL = 'https://egnyblflgppsosunnilq.supabase.co';
const GC_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbnlibGZsZ3Bwc29zdW5uaWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTYzMjksImV4cCI6MjA4MjA3MjMyOX0.HR9lt4oHuFjGcjwsF_fLoJMuG2OI8aCIoRCSyyu0zVE';

window.groupChat = {
    isOpen: false,
    subscription: null,
    hasUnread: false,
    maxMessages: 50,
    client: null,

    init: async function () {
        console.log("Initializing Group Chat...");
        this.getClient();
        this.setupRealtime();
        // Check for unread messages (optional, maybe check last 't' > lastReadTime)
    },

    getClient: function () {
        if (this.client) return this.client;

        // Try global existing clients first
        if (window.db) this.client = window.db;
        else if (window.supabaseClient) this.client = window.supabaseClient;
        else if (window.sb) this.client = window.sb;

        // Fallback: Create own instance
        if (!this.client && window.supabase) {
            console.log("Group Chat: Creating dedicated Supabase client.");
            this.client = window.supabase.createClient(GC_SUPABASE_URL, GC_SUPABASE_KEY);
        }
        return this.client;
    },

    open: async function () {
        // UNDER MAINTENANCE BABY KALMA
        if (window.showWimpyConfirm) {
            await window.showWimpyConfirm("UNDER MAINTENANCE BABY KALMA");
        } else {
            alert("UNDER MAINTENANCE BABY KALMA");
        }
        return;

        const modal = document.getElementById('groupChatModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        this.isOpen = true;
        this.hasUnread = false;
        this.updateBadge(false);
        this.scrollToBottom();

        // Focus input
        setTimeout(() => document.getElementById('gc-input').focus(), 100);

        // Load History (only if empty)
        const historyContainer = document.getElementById('gc-history');
        if (historyContainer.innerHTML.trim() === '') {
            await this.loadHistory();
        }
    },

    close: function () {
        const modal = document.getElementById('groupChatModal');
        if (modal) modal.classList.add('hidden');
        this.isOpen = false;
    },

    toggle: function () {
        if (this.isOpen) this.close();
        else this.open();
    },

    setupRealtime: function () {
        if (this.subscription) return;
        const client = this.getClient();
        if (!client) return;

        this.subscription = client
            .channel('public:notes:chat')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes', filter: 'color=eq.CHAT_HIDDEN' }, payload => {
                this.handleIncoming(payload.new);
            })
            .subscribe();
    },

    loadHistory: async function () {
        const historyContainer = document.getElementById('gc-history');
        historyContainer.innerHTML = '<div class="loader" style="font-size:1rem; padding:20px;">Loading chismis...</div>';

        const client = this.getClient();
        if (!client) {
            historyContainer.innerHTML = 'Client setup failed.';
            return;
        }

        const { data, error } = await client
            .from('notes')
            .select('*')
            .eq('color', 'CHAT_HIDDEN')
            .order('created_at', { ascending: false }) // Get latest
            .limit(this.maxMessages);

        if (error) {
            historyContainer.innerHTML = '<div style="text-align:center; color:red;">Failed to load chat.</div>';
            return;
        }

        historyContainer.innerHTML = '';
        // Reverse to show oldest first
        const messages = (data || []).reverse();
        messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
    },

    handleIncoming: function (record) {
        if (!record || record.color !== 'CHAT_HIDDEN') return;

        this.renderMessage(record);

        if (this.isOpen) {
            this.scrollToBottom();
        } else {
            this.hasUnread = true;
            this.updateBadge(true);
            this.playNotificationSound();
        }
    },

    renderMessage: function (record) {
        const historyContainer = document.getElementById('gc-history');
        let data;
        try {
            data = JSON.parse(record.content);
        } catch (e) {
            console.error("Invalid chat message format:", record.content);
            return; // invalid format
        }

        const isMe = window.user && (data.id === window.user.id);
        const time = new Date(data.t || record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `gc-message ${isMe ? 'me' : 'them'}`;

        // Avatar (only for THEM)
        const avatarHtml = !isMe ? `<img src="${data.a}" class="gc-avatar" title="${data.u}">` : '';
        const nameHtml = !isMe ? `<div class="gc-name">${data.u}</div>` : '';

        div.innerHTML = `
            ${avatarHtml}
            <div class="gc-content-wrapper">
                ${nameHtml}
                <div class="gc-bubble">
                    ${this.escapeHTML(data.m)}
                </div>
                <div class="gc-time">${time}</div>
            </div>
        `;

        historyContainer.appendChild(div);
    },

    send: async function () {
        const input = document.getElementById('gc-input');
        const text = input.value.trim();
        if (!text) return;

        if (!window.user) {
            // Try to recover user from storage if global var is missing
            const stored = localStorage.getItem('wimpy_user');
            if (stored) window.user = JSON.parse(stored);
            else {
                alert("You must be logged in to chat!");
                return;
            }
        }

        input.value = ''; // Clear input immediately

        // Prepare Payload
        const payload = {
            u: window.user.name,
            a: window.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(window.user.name)}&background=random`,
            m: text,
            t: new Date().toISOString(),
            id: window.user.id
        };

        const jsonString = JSON.stringify(payload);

        // OPTIMISTIC RENDER (Immediate Feedback)
        const tempRecord = { content: jsonString, created_at: payload.t, color: 'CHAT_HIDDEN' };
        this.renderMessage(tempRecord);
        this.scrollToBottom();

        // Use robust client getter
        const client = this.getClient();
        if (!client) {
            if (window.showToast) window.showToast("Connection Error: No DB Client", "error");
            else alert("Connection Error: No DB Client");
            return;
        }

        try {
            const { error } = await client.from('notes').insert([{
                content: jsonString,
                x_pos: 0,
                y_pos: 0,
                rotation: 0,
                color: 'CHAT_HIDDEN',
                likes: 0
            }]);

            if (error) {
                console.error("Supabase Error:", error);
                if (window.showToast) window.showToast("Send failed: " + error.message, "error");
                else alert("Send failed: " + error.message);
            }
        } catch (err) {
            console.error("Network/Client Error:", err);
            if (window.showToast) window.showToast("Network Error: " + err.message, "error");
            else alert("Network Error");
        }
    },

    scrollToBottom: function () {
        const historyContainer = document.getElementById('gc-history');
        if (historyContainer) historyContainer.scrollTop = historyContainer.scrollHeight;
    },

    updateBadge: function (show) {
        const badge = document.getElementById('gc-badge');
        if (badge) {
            badge.style.display = show ? 'block' : 'none';
            badge.classList.remove('pop');
            if (show) {
                void badge.offsetWidth;
                badge.classList.add('pop');
            }
        }
    },

    playNotificationSound: function () {
        const audio = document.getElementById('notif-sound');
        if (audio) audio.play().catch(e => { });
    },

    escapeHTML: function (str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// Robust Initialization
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const maxAttempts = 10; // Try for 5 seconds (10 * 500ms)

    const tryInit = () => {
        // Relaxed Check: We can init if we have the Supabase lib OR an existing client
        const hasSupabase = window.supabase || window.db || window.supabaseClient || window.sb;

        if (hasSupabase && window.user) {
            window.groupChat.init();
        } else if (localStorage.getItem('wimpy_user') && hasSupabase) {
            // Recover user
            try {
                window.user = JSON.parse(localStorage.getItem('wimpy_user'));
                window.groupChat.init();
            } catch (e) {
                console.error("User recovery failed", e);
            }
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryInit, 500);
            } else {
                console.warn("Group Chat: Could not init (User or Supabase Lib missing).");
            }
        }
    };

    tryInit();
});

// Bind Enter Key
document.addEventListener('keydown', function (e) {
    if (e.target.id === 'gc-input' && e.key === 'Enter') {
        window.groupChat.send();
    }
});
