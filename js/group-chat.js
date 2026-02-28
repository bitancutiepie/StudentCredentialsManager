// --- GROUP CHAT SYSTEM (Messenger-Style) ---
// Uses the 'notes' table with color = 'CHAT_HIDDEN' to store messages.
// Uses window.roomChannel (from dashboard.js) for typing/seen broadcasts.
// Content field: JSON { u: "Name", a: "Avatar", m: "Message", t: Timestamp, id: UserID }

window.groupChat = {
    isOpen: false,
    subscription: null,
    hasUnread: false,
    maxMessages: 50,
    renderedIds: new Set(),
    pendingOptimistic: new Set(),
    typingTimeout: null,
    typingUsers: {},
    lastSeenTime: null,
    seenBy: [],

    // ===== INIT =====
    init: async function () {
        console.log("Group Chat: Initializing...");
        if (!window.db) {
            console.warn("Group Chat: window.db not ready.");
            return;
        }
        this.setupRealtime();
        this.setupSelfRegen();
        this.setupBroadcastListeners();
        console.log("Group Chat: Ready.");
    },

    // ===== OPEN / CLOSE / TOGGLE =====
    open: async function () {
        const modal = document.getElementById('groupChatModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        this.isOpen = true;
        this.hasUnread = false;
        this.updateBadge(false);

        setTimeout(() => {
            const input = document.getElementById('gc-input');
            if (input) input.focus();
        }, 100);

        // Always load fresh history when opening
        await this.loadHistory();
        this.scrollToBottom();

        // Broadcast "seen" when opening
        this.broadcastSeen();
    },

    close: function () {
        const modal = document.getElementById('groupChatModal');
        if (modal) modal.classList.add('hidden');
        this.isOpen = false;
        this.clearTypingIndicator();
    },

    toggle: function () {
        if (this.isOpen) this.close();
        else this.open();
    },

    // ===== REALTIME: Postgres Changes for new messages =====
    setupRealtime: function () {
        if (this.subscription) return;
        if (!window.db) return;

        this.subscription = window.db
            .channel('gc-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notes',
                filter: 'color=eq.CHAT_HIDDEN'
            }, payload => {
                this.handleIncoming(payload.new);
            })
            .subscribe((status) => {
                console.log("Group Chat Realtime:", status);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    this.subscription = null;
                    setTimeout(() => this.setupRealtime(), 3000);
                }
            });
    },

    // ===== BROADCAST LISTENERS: Typing + Seen via roomChannel =====
    setupBroadcastListeners: function () {
        // Wait for roomChannel to be ready (it's created in dashboard.js)
        const waitForChannel = () => {
            if (window.roomChannel) {
                window.roomChannel
                    .on('broadcast', { event: 'gc_typing' }, (payload) => {
                        this.handleTypingBroadcast(payload.payload);
                    })
                    .on('broadcast', { event: 'gc_seen' }, (payload) => {
                        this.handleSeenBroadcast(payload.payload);
                    });
                console.log("Group Chat: Broadcast listeners attached.");
            } else {
                setTimeout(waitForChannel, 500);
            }
        };
        waitForChannel();
    },

    // ===== SELF-REGEN: Auto-reconnect =====
    setupSelfRegen: function () {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.subscription) this.setupRealtime();
                if (this.isOpen) this.loadHistory();
            }
        });

        window.addEventListener('online', () => {
            this.subscription = null;
            this.setupRealtime();
            if (this.isOpen) this.loadHistory();
        });
    },

    // ===== LOAD HISTORY =====
    loadHistory: async function () {
        const historyContainer = document.getElementById('gc-history');
        if (!historyContainer || !window.db) return;

        historyContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666; font-family:Patrick Hand;">Loading chismis...</div>';

        const { data, error } = await window.db
            .from('notes')
            .select('*')
            .eq('color', 'CHAT_HIDDEN')
            .order('created_at', { ascending: false })
            .limit(this.maxMessages);

        if (error) {
            historyContainer.innerHTML = '<div style="text-align:center; color:red;">Failed to load chat.</div>';
            console.error("GC Load Error:", error);
            return;
        }

        historyContainer.innerHTML = '';
        this.renderedIds.clear();
        this.pendingOptimistic.clear();

        const messages = (data || []).reverse();
        messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
    },

    // ===== HANDLE INCOMING REALTIME MESSAGE =====
    handleIncoming: function (record) {
        if (!record || record.color !== 'CHAT_HIDDEN') return;

        // Skip if already rendered
        if (record.id && this.renderedIds.has(record.id)) return;

        // De-dupe optimistic renders
        try {
            const data = JSON.parse(record.content);
            if (data.t && this.pendingOptimistic.has(data.t)) {
                this.pendingOptimistic.delete(data.t);
                if (record.id) this.renderedIds.add(record.id);
                return;
            }
            // Clear typing for this user since they sent a message
            if (data.id && this.typingUsers[data.id]) {
                delete this.typingUsers[data.id];
                this.renderTypingIndicator();
            }
        } catch (e) { }

        this.renderMessage(record);

        if (this.isOpen) {
            this.scrollToBottom();
            this.broadcastSeen();
        } else {
            this.hasUnread = true;
            this.updateBadge(true);
            this.playNotificationSound();
        }
    },

    // ===== RENDER A MESSAGE =====
    renderMessage: function (record) {
        const historyContainer = document.getElementById('gc-history');
        if (!historyContainer) return;

        if (record.id && this.renderedIds.has(record.id)) return;
        if (record.id) this.renderedIds.add(record.id);

        let data;
        try {
            data = JSON.parse(record.content);
        } catch (e) {
            return;
        }

        const isMe = window.user && (data.id === window.user.id);
        const time = new Date(data.t || record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = `gc-message ${isMe ? 'me' : 'them'}`;
        div.style.animation = 'gcSlideIn 0.25s ease-out';

        const avatarUrl = data.a || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.u)}&background=random`;
        const avatarHtml = !isMe ? `<img src="${avatarUrl}" class="gc-avatar" title="${this.escapeHTML(data.u)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(data.u)}&background=random'">` : '';
        const nameHtml = !isMe ? `<div class="gc-name">${this.escapeHTML(data.u)}</div>` : '';

        div.innerHTML = `
            ${avatarHtml}
            <div class="gc-content-wrapper">
                ${nameHtml}
                <div class="gc-bubble">${this.escapeHTML(data.m)}</div>
                <div class="gc-time">${time}</div>
            </div>
        `;

        // Insert before typing indicator if it exists
        const typingEl = document.getElementById('gc-typing-indicator');
        if (typingEl) {
            historyContainer.insertBefore(div, typingEl);
        } else {
            historyContainer.appendChild(div);
        }
    },

    // ===== SEND MESSAGE =====
    send: async function () {
        const input = document.getElementById('gc-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        if (!window.user) {
            const stored = localStorage.getItem('wimpy_user');
            if (stored) window.user = JSON.parse(stored);
            else {
                alert("You must be logged in to chat!");
                return;
            }
        }

        if (!window.db) {
            alert("Connection error — please refresh the page.");
            return;
        }

        input.value = '';
        this.broadcastStopTyping();

        const payload = {
            u: window.user.name,
            a: window.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(window.user.name)}&background=random`,
            m: text,
            t: new Date().toISOString(),
            id: window.user.id
        };

        const jsonString = JSON.stringify(payload);

        // Optimistic render
        this.pendingOptimistic.add(payload.t);
        this.renderMessage({ content: jsonString, created_at: payload.t, color: 'CHAT_HIDDEN' });
        this.scrollToBottom();

        // Save to DB
        try {
            const { error } = await window.db.from('notes').insert([{
                content: jsonString,
                x_pos: 0,
                y_pos: 0,
                rotation: 0,
                color: 'CHAT_HIDDEN',
                likes: 0
            }]);

            if (error) {
                console.error("GC Send Error:", error);
                if (window.showToast) window.showToast("Send failed: " + error.message, "error");
            }
        } catch (err) {
            console.error("GC Network Error:", err);
            if (window.showToast) window.showToast("Network Error", "error");
        }
    },

    // ===== TYPING INDICATOR =====
    broadcastTyping: function () {
        if (!window.roomChannel || !window.user) return;
        window.roomChannel.send({
            type: 'broadcast',
            event: 'gc_typing',
            payload: {
                id: window.user.id,
                name: window.user.name,
                typing: true
            }
        });

        // Auto-stop after 3 seconds of no keystrokes
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.broadcastStopTyping(), 3000);
    },

    broadcastStopTyping: function () {
        if (!window.roomChannel || !window.user) return;
        clearTimeout(this.typingTimeout);
        window.roomChannel.send({
            type: 'broadcast',
            event: 'gc_typing',
            payload: {
                id: window.user.id,
                name: window.user.name,
                typing: false
            }
        });
    },

    handleTypingBroadcast: function (data) {
        if (!data || !data.id) return;
        // Don't show own typing
        if (window.user && data.id === window.user.id) return;

        if (data.typing) {
            this.typingUsers[data.id] = data.name;
        } else {
            delete this.typingUsers[data.id];
        }
        this.renderTypingIndicator();
    },

    renderTypingIndicator: function () {
        const historyContainer = document.getElementById('gc-history');
        if (!historyContainer) return;

        // Remove existing
        let el = document.getElementById('gc-typing-indicator');

        const names = Object.values(this.typingUsers);
        if (names.length === 0) {
            if (el) el.remove();
            return;
        }

        let text = '';
        if (names.length === 1) text = names[0] + ' is typing';
        else if (names.length === 2) text = names[0] + ' and ' + names[1] + ' are typing';
        else text = names.length + ' people are typing';

        if (!el) {
            el = document.createElement('div');
            el.id = 'gc-typing-indicator';
            historyContainer.appendChild(el);
        }

        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; padding:4px 10px; font-size:0.8rem; color:#666; font-family:'Patrick Hand',cursive; animation:gcSlideIn 0.2s ease-out;">
                <span style="display:flex; gap:3px;">
                    <span class="gc-dot"></span><span class="gc-dot"></span><span class="gc-dot"></span>
                </span>
                ${this.escapeHTML(text)}
            </div>
        `;

        this.scrollToBottom();
    },

    clearTypingIndicator: function () {
        this.typingUsers = {};
        const el = document.getElementById('gc-typing-indicator');
        if (el) el.remove();
    },

    // ===== SEEN RECEIPTS =====
    broadcastSeen: function () {
        if (!window.roomChannel || !window.user) return;
        window.roomChannel.send({
            type: 'broadcast',
            event: 'gc_seen',
            payload: {
                id: window.user.id,
                name: window.user.name,
                avatar: window.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(window.user.name)}&background=random`,
                at: new Date().toISOString()
            }
        });
    },

    handleSeenBroadcast: function (data) {
        if (!data || !data.id) return;
        if (window.user && data.id === window.user.id) return;

        // Update seen list (keep unique by user id)
        const existing = this.seenBy.findIndex(s => s.id === data.id);
        if (existing >= 0) this.seenBy[existing] = data;
        else this.seenBy.push(data);

        // Keep only last 10
        if (this.seenBy.length > 10) this.seenBy = this.seenBy.slice(-10);

        this.renderSeenReceipts();
    },

    renderSeenReceipts: function () {
        let el = document.getElementById('gc-seen-receipts');
        if (!el) return;

        if (this.seenBy.length === 0) {
            el.innerHTML = '';
            return;
        }

        const avatars = this.seenBy.map(s =>
            `<img src="${s.avatar}" title="Seen by ${this.escapeHTML(s.name)}" style="width:16px;height:16px;border-radius:50%;border:1px solid #fff;object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&size=16'">`
        ).join('');

        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:2px;justify-content:flex-end;padding:2px 8px;opacity:0.7;">
                <span style="font-size:0.65rem;color:#999;margin-right:3px;">Seen by</span>
                ${avatars}
            </div>
        `;
    },

    // ===== ADMIN TOOLS =====
    toggleAdminMenu: function () {
        const panel = document.getElementById('gc-admin-panel');
        if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    },

    adminClearOld: async function () {
        if (!window.user || window.user.sr_code !== 'ADMIN') return;
        if (!window.db) return;

        if (window.showWimpyConfirm) {
            if (!await window.showWimpyConfirm('Delete all GC messages older than 24 hours?')) return;
        }

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        try {
            const { error } = await window.db
                .from('notes')
                .delete()
                .eq('color', 'CHAT_HIDDEN')
                .lt('created_at', cutoff);

            if (error) {
                if (window.showToast) window.showToast('Error: ' + error.message, 'error');
            } else {
                if (window.showToast) window.showToast('Old GC messages cleared!');
                this.loadHistory();
            }
        } catch (e) {
            console.error('GC Admin Clear Old:', e);
        }
    },

    adminClearAll: async function () {
        if (!window.user || window.user.sr_code !== 'ADMIN') return;
        if (!window.db) return;

        if (window.showWimpyConfirm) {
            if (!await window.showWimpyConfirm('⚠️ DELETE ALL group chat messages? This cannot be undone!')) return;
        }

        try {
            const { error } = await window.db
                .from('notes')
                .delete()
                .eq('color', 'CHAT_HIDDEN');

            if (error) {
                if (window.showToast) window.showToast('Error: ' + error.message, 'error');
            } else {
                if (window.showToast) window.showToast('All GC messages cleared!');
                this.loadHistory();
            }
        } catch (e) {
            console.error('GC Admin Clear All:', e);
        }
    },

    // ===== UTILITIES =====
    scrollToBottom: function () {
        const el = document.getElementById('gc-history');
        if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    },

    updateBadge: function (show) {
        // Header badge
        const badge = document.getElementById('gc-badge');
        if (badge) {
            badge.style.display = show ? 'block' : 'none';
            badge.classList.remove('pop');
            if (show) {
                void badge.offsetWidth;
                badge.classList.add('pop');
            }
        }
        // FAB badge
        const fabBadge = document.getElementById('gc-fab-badge');
        if (fabBadge) {
            fabBadge.style.display = show ? 'flex' : 'none';
        }
    },

    playNotificationSound: function () {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.12;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) { }
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

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds

    const tryInit = () => {
        if (window.db && window.user) {
            window.groupChat.init();
        } else if (window.db && localStorage.getItem('wimpy_user')) {
            try {
                window.user = JSON.parse(localStorage.getItem('wimpy_user'));
                window.groupChat.init();
            } catch (e) {
                console.error("GC: User recovery failed", e);
            }
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryInit, 500);
            } else {
                console.warn("Group Chat: Could not init after 10s.");
            }
        }
    };
    tryInit();
});

// ===== KEY BINDINGS =====
document.addEventListener('keydown', function (e) {
    if (e.target.id === 'gc-input') {
        if (e.key === 'Enter') {
            window.groupChat.send();
        } else {
            // Broadcast typing on any other key
            window.groupChat.broadcastTyping();
        }
    }
});
