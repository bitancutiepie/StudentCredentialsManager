// creature-battle.js — Real-time Creature Battle System
// Uses window.roomChannel (Supabase Broadcast) for multiplayer

(function () {
    'use strict';

    // ==================== CREATURE DATA ====================
    const CREATURES = {
        tikbalang: {
            name: 'Tikbalang',
            image: 'assets/images/Creatures/tikbalang.png',
            lore: 'Ang pinakapoging tikbalang ng IT 06',
            beats: ['sigbin', 'tiyanak'],
            losesTo: ['angel', 'demunyo']
        },
        tiyanak: {
            name: 'Tiyanak',
            image: 'assets/images/Creatures/tiyanak.png',
            lore: 'Ang pinakapraning na tiyanak sa mundong ibabaw',
            beats: ['angel', 'demunyo'],
            losesTo: ['tikbalang', 'sigbin']
        },
        angel: {
            name: 'Angel',
            image: 'assets/images/Creatures/angel.png',
            lore: 'Dahil nabali ang leeg niya naging anghel tuloy',
            beats: ['demunyo', 'tikbalang'],
            losesTo: ['sigbin', 'tiyanak']
        },
        demunyo: {
            name: 'Demunyo',
            image: 'assets/images/Creatures/demunyo.png',
            lore: 'Wala demunyo lang talaga',
            beats: ['tikbalang', 'sigbin'],
            losesTo: ['angel', 'tiyanak']
        },
        sigbin: {
            name: 'Sigbin',
            image: 'assets/images/Creatures/sigbin.png',
            lore: 'Pinakawild at laging inheat',
            beats: ['angel', 'tiyanak'],
            losesTo: ['demunyo', 'tikbalang']
        }
    };

    // ==================== STATE ====================
    let battleState = 'idle';
    // States: idle | waiting_response | selecting | waiting_opponent | countdown | reveal | result
    let myChoice = null;
    let opponentChoice = null;
    let opponentId = null;
    let opponentName = null;
    let opponentAvatar = null;
    let selectionTimer = null;
    let selectionTimeLeft = 45;
    let pendingInviteFrom = null;

    let currentBattleId = null;

    function generateBattleId() {
        return 'battle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    // ==================== INIT ====================
    window.initCreatureBattle = function () {
        const container = document.getElementById('battle-game-section');
        if (!container) return;
        if (currentBattleId) return;
        resetBattleState();
        renderLanding();
    };

    function resetBattleState() {
        battleState = 'idle';
        myChoice = null;
        opponentChoice = null;
        opponentId = null;
        opponentName = null;
        opponentAvatar = null;
        currentBattleId = null;
        if (selectionTimer) clearInterval(selectionTimer);
        selectionTimer = null;
        selectionTimeLeft = 45;
        pendingInviteFrom = null;
    }

    // ==================== LANDING VIEW ====================
    function renderLanding() {
        const container = document.getElementById('battle-game-container');
        if (!container) return;

        container.innerHTML = `
            <div class="battle-landing">
                <div class="battle-lore-header">
                    <p style="font-family: 'Patrick Hand', cursive; font-size: 1.3rem; color: #555; max-width: 500px; margin: 0 auto 25px;">
                        Choose your creature wisely. Each one has strengths and weaknesses. Challenge a classmate and prove your strategy!
                    </p>
                    <button class="sketch-btn battle-start-btn" onclick="window.openBattleOpponentSelect()">
                        BATTLE A CLASSMATE
                    </button>
                </div>

                <!-- Leaderboard Section -->
                <div id="battle-leaderboard-section" class="battle-leaderboard-section">
                    <div class="lb-header" onclick="window.toggleLeaderboard()">
                        <h3><i class="fas fa-trophy"></i> LEADERBOARD</h3>
                        <i class="fas fa-chevron-down" id="lb-toggle-icon"></i>
                    </div>
                    <div id="battle-leaderboard-content" class="lb-content">
                        <div style="text-align: center; padding: 20px; color: #999; font-family: 'Patrick Hand';">
                            <i class="fas fa-spinner fa-spin"></i> Loading...
                        </div>
                    </div>
                </div>

                <div class="battle-creature-showcase">
                    ${Object.entries(CREATURES).map(([key, c]) => `
                        <div class="tcg-card" data-creature="${key}">
                            <div class="tcg-card-inner">
                                <div class="tcg-card-frame">
                                    <div class="tcg-card-image-window">
                                        <img src="${c.image}" alt="${c.name}" class="tcg-card-art">
                                    </div>
                                    <div class="tcg-card-banner">
                                        <span class="tcg-card-name">${c.name}</span>
                                    </div>
                                    <div class="tcg-card-desc">
                                        <p>${c.lore}</p>
                                    </div>
                                    <div class="tcg-card-matchups">
                                        <span class="tcg-beats"><i class="fas fa-chevron-up"></i> ${c.beats.map(b => CREATURES[b].name).join(', ')}</span>
                                        <span class="tcg-loses"><i class="fas fa-chevron-down"></i> ${c.losesTo.map(l => CREATURES[l].name).join(', ')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Load leaderboard data
        loadLeaderboard();
    }

    // ==================== LEADERBOARD TOGGLE ====================
    window.toggleLeaderboard = function () {
        var content = document.getElementById('battle-leaderboard-content');
        var icon = document.getElementById('lb-toggle-icon');
        if (!content) return;
        content.classList.toggle('lb-collapsed');
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    };

    // ==================== LEADERBOARD ====================
    async function loadLeaderboard() {
        if (!window.db) return;

        try {
            var { data, error } = await window.db
                .from('students')
                .select('id, name, avatar_url, battle_wins, battle_losses')
                .or('battle_wins.gt.0,battle_losses.gt.0');

            if (error) {
                console.error('Leaderboard fetch error:', error);
                renderLeaderboard([]);
                return;
            }

            // Calculate score and sort
            var ranked = (data || []).map(function (s) {
                var wins = s.battle_wins || 0;
                var losses = s.battle_losses || 0;
                var total = wins + losses;
                var winRate = total > 0 ? wins / total : 0;
                return {
                    id: s.id,
                    name: s.name,
                    avatar: s.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(s.name) + '&background=random',
                    wins: wins,
                    losses: losses,
                    score: (wins * 3) - losses,
                    winRate: winRate,
                    total: total
                };
            });

            ranked.sort(function (a, b) {
                if (b.score !== a.score) return b.score - a.score;
                return b.wins - a.wins;
            });

            renderLeaderboard(ranked);
        } catch (err) {
            console.error('Leaderboard error:', err);
            renderLeaderboard([]);
        }
    }

    function getStars(winRate) {
        if (winRate >= 0.8) return 3;
        if (winRate >= 0.5) return 2;
        if (winRate > 0) return 1;
        return 0;
    }

    function renderLeaderboard(ranked) {
        var container = document.getElementById('battle-leaderboard-content');
        if (!container) return;

        if (!ranked || ranked.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; font-family: Patrick Hand; color: #999; font-size: 1.2rem;"><i class="fas fa-ghost" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>No battles yet. Be the first to fight!</div>';
            return;
        }

        var topPlayer = ranked[0];
        var topStars = getStars(topPlayer.winRate);
        var starHTML = '';
        for (var s = 0; s < topStars; s++) starHTML += '<i class="fas fa-star"></i>';

        var html = '<div class="lb-layout">';

        // Top player card
        html += '<div class="lb-top-player">';
        html += '<div class="lb-top-rank-badge">1<sup>st</sup> Rank</div>';
        html += '<div class="lb-top-avatar-wrap"><img src="' + topPlayer.avatar + '" alt="' + escapeHTML(topPlayer.name) + '" class="lb-top-avatar"></div>';
        html += '<div class="lb-top-stars">' + (starHTML || '<i class="far fa-star"></i>') + '</div>';
        html += '<div class="lb-top-name">' + escapeHTML(topPlayer.name) + '</div>';
        html += '<div class="lb-top-score">' + topPlayer.score + '</div>';
        html += '<div class="lb-top-score-label">Points</div>';
        html += '<div class="lb-top-stats"><span class="lb-wl-win"><i class="fas fa-check"></i> ' + topPlayer.wins + 'W</span> <span class="lb-wl-lose"><i class="fas fa-times"></i> ' + topPlayer.losses + 'L</span></div>';
        html += '</div>';

        // Ranked list
        html += '<div class="lb-list">';
        for (var i = 0; i < ranked.length; i++) {
            var p = ranked[i];
            var rank = i + 1;
            var pStars = getStars(p.winRate);
            var pStarHTML = '';
            for (var j = 0; j < pStars; j++) pStarHTML += '<i class="fas fa-star"></i>';
            if (pStars === 0) pStarHTML = '<i class="far fa-star"></i>';

            var rankClass = 'lb-rank-default';
            if (rank === 1) rankClass = 'lb-rank-gold';
            else if (rank === 2) rankClass = 'lb-rank-silver';
            else if (rank === 3) rankClass = 'lb-rank-bronze';

            var isMe = window.user && p.id === window.user.id;

            html += '<div class="lb-row' + (isMe ? ' lb-row-me' : '') + '">';
            html += '<div class="lb-rank ' + rankClass + '">' + rank + '<sup>' + getOrdinal(rank) + '</sup></div>';
            html += '<img src="' + p.avatar + '" alt="' + escapeHTML(p.name) + '" class="lb-row-avatar">';
            html += '<div class="lb-row-info"><div class="lb-row-name">' + escapeHTML(p.name) + '</div><div class="lb-row-wl"><span class="lb-wl-win">' + p.wins + 'W</span> / <span class="lb-wl-lose">' + p.losses + 'L</span></div></div>';
            html += '<div class="lb-row-stars">' + pStarHTML + '</div>';
            html += '<div class="lb-row-score"><span>Score</span><strong>' + p.score + '</strong></div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
    }

    function getOrdinal(n) {
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }

    // ==================== RECORD BATTLE RESULT ====================
    async function recordBattleResult(result) {
        if (!window.db || !window.user) return;
        if (result === 'draw') return; // Draws don't affect stats

        try {
            if (result === 'win') {
                // Increment my wins
                var { data: me } = await window.db.from('students').select('battle_wins').eq('id', window.user.id).single();
                await window.db.from('students').update({ battle_wins: ((me && me.battle_wins) || 0) + 1 }).eq('id', window.user.id);
            } else if (result === 'lose') {
                // Increment my losses
                var { data: me2 } = await window.db.from('students').select('battle_losses').eq('id', window.user.id).single();
                await window.db.from('students').update({ battle_losses: ((me2 && me2.battle_losses) || 0) + 1 }).eq('id', window.user.id);
            }
        } catch (err) {
            console.error('Failed to record battle result:', err);
        }
    }

    // ==================== OPPONENT SELECT ====================
    window.openBattleOpponentSelect = function () {
        if (!window.user) return showToast('You must be logged in!', 'error');
        if (!window.roomChannel) return showToast('Not connected to live features. Refresh the page.', 'error');

        const presenceState = window.roomChannel.presenceState();
        const onlineUsers = [];
        for (const key in presenceState) {
            if (presenceState[key].length > 0) {
                const u = presenceState[key][0];
                if (u.user_id !== window.user.id) {
                    onlineUsers.push(u);
                }
            }
        }

        let overlay = document.getElementById('battle-opponent-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'battle-opponent-modal';
            overlay.className = 'wimpy-modal-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="wimpy-modal-box" style="max-width: 420px; max-height: 70vh; display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
                    <h2 style="margin:0; font-size: 1.5rem;"><i class="fas fa-users"></i> Choose Your Opponent</h2>
                    <button onclick="document.getElementById('battle-opponent-modal').classList.add('hidden')" class="sketch-btn danger" style="width:auto; padding: 5px 10px;">X</button>
                </div>
                <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    ${onlineUsers.length === 0
                ? '<p style="text-align:center; color:#999; font-style:italic; padding: 30px 0;">No one else is online right now...</p>'
                : onlineUsers.map(u => `
                            <div class="battle-opponent-row" onclick="window.sendBattleInvite('${u.user_id}', '${escapeHTML(u.name)}', '${u.avatar}')">
                                <img src="${u.avatar}" alt="${u.name}" class="battle-opponent-avatar">
                                <span class="battle-opponent-name">${escapeHTML(u.name)}</span>
                                <span class="battle-opponent-badge">Challenge</span>
                            </div>
                        `).join('')
            }
                </div>
            </div>
        `;
        overlay.classList.remove('hidden');
    };

    // ==================== INVITE SYSTEM ====================
    window.sendBattleInvite = function (targetId, targetName, targetAvatar) {
        if (battleState !== 'idle') return showToast('You are already in a battle!', 'error');

        opponentId = targetId;
        opponentName = targetName;
        opponentAvatar = targetAvatar;
        currentBattleId = generateBattleId();
        battleState = 'waiting_response';

        const modal = document.getElementById('battle-opponent-modal');
        if (modal) modal.classList.add('hidden');

        window.roomChannel.send({
            type: 'broadcast',
            event: 'battle_invite',
            payload: {
                battle_id: currentBattleId,
                from_id: window.user.id,
                from_name: window.user.name,
                from_avatar: window.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.user.name) + '&background=random',
                to_id: targetId
            }
        });

        const container = document.getElementById('battle-game-container');
        if (container) {
            container.innerHTML = '<div class="battle-waiting"><div class="battle-waiting-card"><i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: #6c5ce7;"></i><h3 style="font-family: Permanent Marker; margin: 15px 0 5px;">Waiting for ' + escapeHTML(targetName) + '...</h3><p style="font-family: Patrick Hand; color: #666;">Battle invite sent! Waiting for response.</p><button class="sketch-btn danger" onclick="window.cancelBattleInvite()" style="margin-top: 15px; width: auto;">Cancel</button></div></div>';
        }

        showToast('Battle invite sent to ' + targetName + '!');
    };

    window.cancelBattleInvite = function () {
        if (currentBattleId && opponentId) {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'battle_cancel',
                payload: {
                    battle_id: currentBattleId,
                    from_id: window.user.id,
                    to_id: opponentId
                }
            });
        }
        resetBattleState();
        renderLanding();
        showToast('Battle invite cancelled.');
    };

    // ==================== INCOMING INVITE ====================
    window.showBattleInvite = function (data) {
        var battle_id = data.battle_id;
        var from_id = data.from_id;
        var from_name = data.from_name;
        var from_avatar = data.from_avatar;

        // ALLOW invites if idle OR if looking at results (Rematch flow)
        if (battleState !== 'idle' && battleState !== 'result') {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'battle_decline',
                payload: { battle_id: battle_id, from_id: window.user.id, to_id: from_id, reason: 'busy' }
            });
            return;
        }

        // TREND: If same opponent sends invite while we are at results, show it as a rematch request
        if (battleState === 'result' && from_id === opponentId) {
            pendingInviteFrom = data;
            var statusEl = document.getElementById('rematch-status-text');
            if (statusEl) {
                statusEl.innerHTML = '<div style="margin: 10px 0; padding: 5px; background: rgba(108, 92, 231, 0.1); border-radius: 5px; color: #6c5ce7; font-weight: bold; animation: pulse 1.5s infinite;">' + escapeHTML(from_name) + ' wants a rematch!</div>';
            }
            var retryBtn = document.getElementById('battle-play-again-btn');
            if (retryBtn) {
                retryBtn.innerHTML = '<i class="fas fa-play"></i> ACCEPT REMATCH';
                retryBtn.style.background = '#6c5ce7';
                retryBtn.onclick = function () { window.acceptBattleInvite(); };
            }
            return;
        }

        pendingInviteFrom = data;

        var overlay = document.getElementById('battle-invite-popup');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'battle-invite-popup';
            overlay.className = 'wimpy-modal-overlay';
            overlay.style.zIndex = '15000';
            document.body.appendChild(overlay);
        }

        var avatar = from_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(from_name) + '&background=random';

        overlay.innerHTML = '<div class="battle-invite-card" style="animation: battleInvitePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);"><div class="battle-invite-header"><span style="font-size: 2.5rem;">&#9876;&#65039;</span><h2>BATTLE CHALLENGE!</h2></div><div class="battle-invite-body"><img src="' + avatar + '" class="battle-invite-avatar"><h3>' + escapeHTML(from_name) + '</h3><p>wants to battle you!</p></div><div class="battle-invite-actions"><button class="sketch-btn" onclick="window.declineBattleInvite()" style="flex:1; background: #fff;">DECLINE</button><button class="sketch-btn" onclick="window.acceptBattleInvite()" style="flex:1; background: #00b894; color: #fff;">ACCEPT</button></div></div>';
        overlay.classList.remove('hidden');

        var sound = document.getElementById('notif-sound');
        if (sound) sound.play().catch(function () { });
    };

    window.acceptBattleInvite = function () {
        if (!pendingInviteFrom) return;
        var battle_id = pendingInviteFrom.battle_id;
        var from_id = pendingInviteFrom.from_id;
        var from_name = pendingInviteFrom.from_name;
        var from_avatar = pendingInviteFrom.from_avatar;

        opponentId = from_id;
        opponentName = from_name;
        opponentAvatar = from_avatar;
        currentBattleId = battle_id;

        var popup = document.getElementById('battle-invite-popup');
        if (popup) popup.classList.add('hidden');

        window.roomChannel.send({
            type: 'broadcast',
            event: 'battle_accept',
            payload: {
                battle_id: battle_id,
                from_id: window.user.id,
                from_name: window.user.name,
                from_avatar: window.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.user.name) + '&background=random',
                to_id: from_id
            }
        });

        pendingInviteFrom = null;

        var gamesTab = document.querySelector('[onclick*="switchTab"][onclick*="games"]') ||
            document.querySelector('.tab-btn[onclick*="games"]');
        if (gamesTab) gamesTab.click();

        var battleBtn = document.querySelector('[onclick*="switchGame(\'battle\'"]');
        if (battleBtn) {
            window.switchGame('battle', battleBtn);
        }

        startCreatureSelection();
    };

    window.declineBattleInvite = function () {
        if (!pendingInviteFrom) return;

        window.roomChannel.send({
            type: 'broadcast',
            event: 'battle_decline',
            payload: {
                battle_id: pendingInviteFrom.battle_id,
                from_id: window.user.id,
                to_id: pendingInviteFrom.from_id
            }
        });

        pendingInviteFrom = null;
        var popup = document.getElementById('battle-invite-popup');
        if (popup) popup.classList.add('hidden');
    };

    // ==================== CREATURE SELECTION ====================
    function startCreatureSelection() {
        battleState = 'selecting';
        myChoice = null;
        opponentChoice = null;
        selectionTimeLeft = 45;

        var container = document.getElementById('battle-game-container');
        if (!container) return;

        var oppAvatar = opponentAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(opponentName) + '&background=random';
        var myAvatarUrl = window.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.user.name) + '&background=random';

        var html = '<div class="battle-selection"><div class="battle-vs-bar"><div class="battle-player-tag"><img src="' + myAvatarUrl + '" class="battle-vs-avatar"><span>' + escapeHTML(window.user.name) + '</span></div><div class="battle-vs-text"><span id="battle-timer" class="battle-timer">' + selectionTimeLeft + '</span><span style="font-family: Permanent Marker; font-size: 1.5rem;">VS</span></div><div class="battle-player-tag"><img src="' + oppAvatar + '" class="battle-vs-avatar"><span>' + escapeHTML(opponentName) + '</span></div></div>';

        html += '<h3 style="font-family: Permanent Marker; text-align: center; margin: 20px 0 5px;">Choose Your Creature!</h3>';
        html += '<p style="text-align: center; font-family: Patrick Hand; color: #666; margin-bottom: 15px;">Pick wisely — your opponent is choosing too!</p>';
        html += '<div class="battle-creature-grid">';

        Object.entries(CREATURES).forEach(function (entry) {
            var key = entry[0];
            var c = entry[1];
            html += '<div class="battle-creature-card" id="creature-card-' + key + '" onclick="window.selectCreature(\'' + key + '\')">';
            html += '<div class="tcg-select-card"><div class="tcg-select-img-wrap"><img src="' + c.image + '" alt="' + c.name + '"></div>';
            html += '<div class="tcg-select-name">' + c.name + '</div>';
            html += '<div class="battle-card-matchup"><small class="tcg-beats"><i class="fas fa-chevron-up"></i> ' + c.beats.map(function (b) { return CREATURES[b].name; }).join(', ') + '</small>';
            html += '<small class="tcg-loses"><i class="fas fa-chevron-down"></i> ' + c.losesTo.map(function (l) { return CREATURES[l].name; }).join(', ') + '</small></div></div></div>';
        });

        html += '</div>';
        html += '<div id="battle-confirm-area" class="battle-confirm-area hidden"><button class="sketch-btn" id="battle-confirm-btn" onclick="window.confirmCreatureChoice()" style="background: #6c5ce7; color: #fff; font-size: 1.3rem; padding: 12px 40px; width: auto;"><i class="fas fa-check"></i> LOCK IN!</button></div></div>';

        container.innerHTML = html;

        selectionTimer = setInterval(function () {
            selectionTimeLeft--;
            var timerEl = document.getElementById('battle-timer');
            if (timerEl) timerEl.textContent = selectionTimeLeft;

            if (selectionTimeLeft <= 10 && timerEl) {
                timerEl.classList.add('battle-timer-warning');
            }

            if (selectionTimeLeft <= 0) {
                clearInterval(selectionTimer);
                if (!myChoice) {
                    var keys = Object.keys(CREATURES);
                    window.selectCreature(keys[Math.floor(Math.random() * keys.length)]);
                    window.confirmCreatureChoice();
                    showToast('Time is up! Random creature chosen!');
                }
            }
        }, 1000);
    }

    window.selectCreature = function (key) {
        if (battleState !== 'selecting') return;

        document.querySelectorAll('.battle-creature-card').forEach(function (c) { c.classList.remove('selected'); });

        var card = document.getElementById('creature-card-' + key);
        if (card) card.classList.add('selected');
        myChoice = key;

        var confirmArea = document.getElementById('battle-confirm-area');
        if (confirmArea) confirmArea.classList.remove('hidden');
    };

    window.confirmCreatureChoice = function () {
        if (!myChoice || battleState !== 'selecting') return;

        battleState = 'waiting_opponent';
        if (selectionTimer) clearInterval(selectionTimer);

        window.roomChannel.send({
            type: 'broadcast',
            event: 'battle_choice',
            payload: {
                battle_id: currentBattleId,
                from_id: window.user.id,
                to_id: opponentId,
                creature: myChoice
            }
        });

        document.querySelectorAll('.battle-creature-card').forEach(function (c) {
            if (!c.classList.contains('selected')) {
                c.style.opacity = '0.3';
                c.style.pointerEvents = 'none';
            }
        });

        var confirmArea = document.getElementById('battle-confirm-area');
        if (confirmArea) {
            confirmArea.innerHTML = '<div style="display: flex; align-items: center; gap: 10px; justify-content: center;"><i class="fas fa-lock" style="color: #6c5ce7; font-size: 1.3rem;"></i><span style="font-family: Permanent Marker; font-size: 1.3rem; color: #6c5ce7;">LOCKED IN — ' + CREATURES[myChoice].name + '</span></div><p style="font-family: Patrick Hand; color: #999; margin-top: 5px;">Waiting for opponent to choose...</p>';
        }

        if (opponentChoice) {
            startCountdown();
        }
    };

    // ==================== BATTLE RESOLUTION ====================
    function startCountdown() {
        battleState = 'countdown';
        var container = document.getElementById('battle-game-container');
        if (!container) return;

        var myAvatar = window.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.user.name) + '&background=random';
        var oppAvatarUrl = opponentAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(opponentName) + '&background=random';

        container.innerHTML = '<div class="battle-arena" id="battle-arena-main">' +
            '<div class="battle-flash-overlay" id="battle-flash"></div>' +
            '<div class="battle-arena-players">' +
            '<div class="battle-arena-side battle-side-left battle-enter-left">' +
            '<img src="' + myAvatar + '" class="battle-arena-avatar">' +
            '<span class="battle-arena-name">' + escapeHTML(window.user.name) + '</span>' +
            '<div class="battle-arena-creature" id="my-creature-reveal"><div class="battle-card-back battle-card-wobble">?</div></div>' +
            '</div>' +
            '<div class="battle-arena-center"><div id="battle-countdown" class="battle-countdown">3</div></div>' +
            '<div class="battle-arena-side battle-side-right battle-enter-right">' +
            '<img src="' + oppAvatarUrl + '" class="battle-arena-avatar">' +
            '<span class="battle-arena-name">' + escapeHTML(opponentName) + '</span>' +
            '<div class="battle-arena-creature" id="opp-creature-reveal"><div class="battle-card-back battle-card-wobble">?</div></div>' +
            '</div>' +
            '</div>' +
            '<div id="battle-result-area" class="hidden"></div>' +
            '</div>';

        var count = 3;
        var countdownEl = document.getElementById('battle-countdown');
        var arena = document.getElementById('battle-arena-main');

        var countdownInterval = setInterval(function () {
            count--;
            if (count > 0) {
                if (countdownEl) {
                    countdownEl.textContent = count;
                    countdownEl.style.animation = 'none';
                    void countdownEl.offsetWidth;
                    countdownEl.style.animation = 'countdownPulse 0.8s ease-out';
                    // Escalating shake
                    if (arena) {
                        arena.style.animation = 'none';
                        void arena.offsetWidth;
                        arena.style.animation = 'battleShake 0.12s ease ' + (4 - count);
                    }
                }
            } else if (count === 0) {
                if (countdownEl) {
                    countdownEl.textContent = 'VS';
                    countdownEl.className = 'battle-countdown battle-clash-text';
                    countdownEl.style.animation = 'none';
                    void countdownEl.offsetWidth;
                    countdownEl.style.animation = 'clashBurst 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                }
                // Screen flash
                var flash = document.getElementById('battle-flash');
                if (flash) {
                    flash.classList.add('active');
                    setTimeout(function () { flash.classList.remove('active'); }, 300);
                }
                // Heavy shake
                if (arena) {
                    arena.style.animation = 'none';
                    void arena.offsetWidth;
                    arena.style.animation = 'battleShake 0.08s ease 5';
                }
            } else {
                clearInterval(countdownInterval);
                revealCreatures();
            }
        }, 1000);
    }

    function revealCreatures() {
        battleState = 'reveal';
        var myCreature = CREATURES[myChoice];
        var oppCreature = CREATURES[opponentChoice];
        var arena = document.getElementById('battle-arena-main');

        // Stop wobble
        document.querySelectorAll('.battle-card-wobble').forEach(function (c) { c.classList.remove('battle-card-wobble'); });

        // Flash on reveal
        var flash = document.getElementById('battle-flash');
        if (flash) {
            flash.classList.add('active');
            setTimeout(function () { flash.classList.remove('active'); }, 200);
        }

        // Reveal my creature with dramatic entrance
        var myReveal = document.getElementById('my-creature-reveal');
        if (myReveal) {
            myReveal.innerHTML = '<div class="battle-revealed-creature battle-reveal-entrance-left"><img src="' + myCreature.image + '" alt="' + myCreature.name + '"><span>' + myCreature.name + '</span></div>';
        }

        // Reveal opponent with delay
        setTimeout(function () {
            var oppReveal = document.getElementById('opp-creature-reveal');
            if (oppReveal) {
                oppReveal.innerHTML = '<div class="battle-revealed-creature battle-reveal-entrance-right"><img src="' + oppCreature.image + '" alt="' + oppCreature.name + '"><span>' + oppCreature.name + '</span></div>';
            }

            // Clash shake after both revealed
            setTimeout(function () {
                if (arena) {
                    arena.style.animation = 'none';
                    void arena.offsetWidth;
                    arena.style.animation = 'battleShake 0.08s ease 5';
                }
                if (flash) {
                    flash.classList.add('active');
                    setTimeout(function () { flash.classList.remove('active'); }, 150);
                }
                setTimeout(function () { showBattleResult(); }, 600);
            }, 400);
        }, 600);
    }

    function determineBattleResult() {
        if (myChoice === opponentChoice) return 'draw';
        if (CREATURES[myChoice].beats.includes(opponentChoice)) return 'win';
        return 'lose';
    }

    function showBattleResult() {
        battleState = 'result';
        var result = determineBattleResult();

        // Record result to Supabase
        recordBattleResult(result);

        var resultArea = document.getElementById('battle-result-area');
        var countdownEl = document.getElementById('battle-countdown');
        var arena = document.getElementById('battle-arena-main');

        if (countdownEl) countdownEl.style.display = 'none';

        // Apply winner/loser effects to creature cards
        var myRevealCreature = document.querySelector('#my-creature-reveal .battle-revealed-creature');
        var oppRevealCreature = document.querySelector('#opp-creature-reveal .battle-revealed-creature');

        if (result === 'win') {
            if (myRevealCreature) myRevealCreature.classList.add('battle-winner-glow');
            if (oppRevealCreature) oppRevealCreature.classList.add('battle-loser-fade');
        } else if (result === 'lose') {
            if (oppRevealCreature) oppRevealCreature.classList.add('battle-winner-glow');
            if (myRevealCreature) myRevealCreature.classList.add('battle-loser-fade');
        } else {
            if (myRevealCreature) myRevealCreature.classList.add('battle-draw-pulse');
            if (oppRevealCreature) oppRevealCreature.classList.add('battle-draw-pulse');
        }

        // Screen shake on result
        if (arena) {
            arena.style.animation = 'none';
            void arena.offsetWidth;
            arena.style.animation = 'battleShake 0.12s ease 3';
        }

        var resultConfig = {
            win: { text: 'YOU WIN!', color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)', desc: CREATURES[myChoice].name + ' beats ' + CREATURES[opponentChoice].name + '!' },
            lose: { text: 'YOU LOSE!', color: '#d63031', bg: 'rgba(214, 48, 49, 0.15)', desc: CREATURES[opponentChoice].name + ' beats ' + CREATURES[myChoice].name + '!' },
            draw: { text: 'DRAW!', color: '#6c5ce7', bg: 'rgba(108, 92, 231, 0.15)', desc: 'Both chose ' + CREATURES[myChoice].name + '!' }
        };

        var cfg = resultConfig[result];

        if (resultArea) {
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = '<div class="battle-result-splash" style="background: ' + cfg.bg + '; border-color: ' + cfg.color + ';">' +
                '<h2 class="battle-result-text" style="color: ' + cfg.color + ';">' + cfg.text + '</h2>' +
                '<p style="font-family: Patrick Hand; font-size: 1.2rem; color: #555;">' + cfg.desc + '</p>' +
                '<div id="rematch-status-text"></div>' +
                '<button id="battle-play-again-btn" class="sketch-btn" onclick="window.battlePlayAgain()" style="background: ' + cfg.color + '; color: #fff; width: auto; margin-top: 15px; font-size: 1.1rem; padding: 10px 30px;"><i class="fas fa-redo"></i> PLAY AGAIN</button>' +
                '<button class="sketch-btn" onclick="window.battleBackToLobby()" style="width: auto; margin-top: 10px; font-size: 1rem; padding: 8px 20px;">Back to Lobby</button>' +
                '</div>';
        }
    }

    window.battlePlayAgain = function () {
        if (opponentId && opponentName) {
            var savedOpp = { id: opponentId, name: opponentName, avatar: opponentAvatar };
            resetBattleState();
            window.sendBattleInvite(savedOpp.id, savedOpp.name, savedOpp.avatar);
        } else {
            resetBattleState();
            renderLanding();
        }
    };

    window.battleBackToLobby = function () {
        resetBattleState();
        renderLanding();
    };

    // ==================== BROADCAST EVENT HANDLERS ====================
    window.handleBattleEvent = function (event, payload) {
        if (!window.user) return;

        switch (event) {
            case 'battle_invite':
                if (payload.to_id === window.user.id) {
                    window.showBattleInvite(payload);
                }
                break;

            case 'battle_accept':
                if (payload.to_id === window.user.id && payload.battle_id === currentBattleId) {
                    opponentName = payload.from_name;
                    opponentAvatar = payload.from_avatar;
                    opponentId = payload.from_id;

                    var battleBtn = document.querySelector('[onclick*="switchGame(\'battle\'"]');
                    if (battleBtn) {
                        window.switchGame('battle', battleBtn);
                    }

                    startCreatureSelection();
                    showToast(payload.from_name + ' accepted your challenge!');
                }
                break;

            case 'battle_decline':
                if (payload.to_id === window.user.id && battleState === 'waiting_response') {
                    showToast((opponentName || 'Opponent') + ' declined the battle.', 'error');
                    resetBattleState();
                    renderLanding();
                }
                break;

            case 'battle_choice':
                if (payload.to_id === window.user.id && payload.battle_id === currentBattleId) {
                    opponentChoice = payload.creature;
                    if (myChoice && (battleState === 'waiting_opponent')) {
                        startCountdown();
                    }
                }
                break;

            case 'battle_cancel':
                if (payload.to_id === window.user.id) {
                    var popup = document.getElementById('battle-invite-popup');
                    if (popup) popup.classList.add('hidden');
                    pendingInviteFrom = null;

                    if (currentBattleId === payload.battle_id) {
                        showToast('Battle was cancelled by opponent.', 'error');
                        resetBattleState();
                        renderLanding();
                    }
                }
                break;
        }
    };

    // ============================================================
    //   TOURNAMENT BRACKET SYSTEM
    // ============================================================

    // --- Tournament State ---
    let tourney = null; // { id, hostId, hostName, size, status, participants, bracket, currentMatchIdx }
    let isTourneyHost = false;
    let inTourneyMatch = false; // true when playing a tournament match

    function getMyAvatar() {
        return window.user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.user.name) + '&background=random';
    }

    // --- Extend renderLanding to show tournament buttons ---
    const _origRenderLanding = renderLanding;

    renderLanding = function () {
        _origRenderLanding();
        // Insert tournament section into the landing
        var container = document.getElementById('battle-game-container');
        if (!container) return;
        var landing = container.querySelector('.battle-landing');
        if (!landing) return;

        var loreHeader = landing.querySelector('.battle-lore-header');
        if (!loreHeader) return;

        // Add tournament button next to "BATTLE A CLASSMATE"
        var tourneyBtn = document.createElement('button');
        tourneyBtn.className = 'sketch-btn';
        tourneyBtn.style.cssText = 'background: #f1c40f; color: #000; border-color: #f1c40f; margin-top: 10px;';
        tourneyBtn.innerHTML = '🏆 TOURNAMENT';
        tourneyBtn.onclick = function () { window.openTourneyCreate(); };
        loreHeader.appendChild(tourneyBtn);

        // Show active tournament banner if one exists
        if (tourney && tourney.status !== 'finished') {
            var banner = document.createElement('div');
            banner.className = 'tourney-banner';
            banner.onclick = function () { window.openTourneyView(); };
            var statusText = tourney.status === 'lobby' ? (tourney.participants.length + '/' + tourney.size + ' players joined') : 'Tournament in progress!';
            banner.innerHTML =
                '<span class="tourney-banner-icon">🏆</span>' +
                '<div class="tourney-banner-text"><h4>TOURNAMENT ACTIVE!</h4><p>' + statusText + '</p></div>' +
                '<i class="fas fa-chevron-right" style="color: #fff; font-size: 1.2rem;"></i>';
            loreHeader.parentNode.insertBefore(banner, loreHeader.nextSibling);
        }
    };

    // --- Create Tournament ---
    window.openTourneyCreate = function () {
        if (!window.user) return showToast('You must be logged in!', 'error');
        if (!window.roomChannel) return showToast('Not connected to live features.', 'error');

        // If tournament already exists, go to view
        if (tourney && tourney.status !== 'finished') {
            window.openTourneyView();
            return;
        }

        var overlay = document.getElementById('tourney-create-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tourney-create-modal';
            overlay.className = 'wimpy-modal-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML =
            '<div class="wimpy-modal-box" style="max-width: 420px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom: 2px dashed #000; padding-bottom: 10px;">' +
            '<h2 style="margin:0; font-size: 1.5rem;">🏆 Create Tournament</h2>' +
            '<button onclick="document.getElementById(\'tourney-create-modal\').classList.add(\'hidden\')" class="sketch-btn danger" style="width:auto; padding: 5px 10px;">X</button>' +
            '</div>' +
            '<div class="tourney-create-form">' +
            '<h3>Pick Bracket Size</h3>' +
            '<p style="font-family: Patrick Hand; color: #666; font-size: 1.05rem;">How many fighters in this tournament?</p>' +
            '<div class="tourney-size-options">' +
            '<div class="tourney-size-btn selected" data-size="4" onclick="window.selectTourneySize(this, 4)"><span>4</span><span>Players</span></div>' +
            '<div class="tourney-size-btn" data-size="8" onclick="window.selectTourneySize(this, 8)"><span>8</span><span>Players</span></div>' +
            '<div class="tourney-size-btn" data-size="16" onclick="window.selectTourneySize(this, 16)"><span>16</span><span>Players</span></div>' +
            '</div>' +
            '<button class="sketch-btn" onclick="window.createTourney()" style="background: #6c5ce7; color: #fff; width: 100%; font-size: 1.2rem; padding: 12px;"><i class="fas fa-trophy"></i> CREATE TOURNAMENT</button>' +
            '</div>' +
            '</div>';

        overlay.classList.remove('hidden');
        window._selectedTourneySize = 4;
    };

    window.selectTourneySize = function (btn, size) {
        document.querySelectorAll('.tourney-size-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        window._selectedTourneySize = size;
    };

    window.createTourney = function () {
        var size = window._selectedTourneySize || 4;

        tourney = {
            id: 'tourney_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            hostId: window.user.id,
            hostName: window.user.name,
            size: size,
            status: 'lobby', // lobby | active | finished
            participants: [{
                id: window.user.id,
                name: window.user.name,
                avatar: getMyAvatar()
            }],
            bracket: null,
            currentMatchIdx: 0
        };
        isTourneyHost = true;
        inTourneyMatch = false;

        // Broadcast creation
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_create',
            payload: tourney
        });

        var modal = document.getElementById('tourney-create-modal');
        if (modal) modal.classList.add('hidden');

        showToast('Tournament created! Waiting for players...');
        renderTourneyLobby();
    };

    // --- Join Tournament ---
    window.joinTourney = function () {
        if (!tourney || tourney.status !== 'lobby') return;
        if (!window.user) return showToast('You must be logged in!', 'error');

        // Check if already joined
        var already = tourney.participants.some(function (p) { return p.id === window.user.id; });
        if (already) {
            showToast('You already joined!');
            return;
        }

        if (tourney.participants.length >= tourney.size) {
            showToast('Tournament is full!', 'error');
            return;
        }

        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_join',
            payload: {
                tourney_id: tourney.id,
                player: {
                    id: window.user.id,
                    name: window.user.name,
                    avatar: getMyAvatar()
                }
            }
        });

        // Optimistic add
        tourney.participants.push({
            id: window.user.id,
            name: window.user.name,
            avatar: getMyAvatar()
        });

        showToast('You joined the tournament!');
        renderTourneyLobby();
    };

    // --- Leave Tournament ---
    window.leaveTourney = function () {
        if (!tourney || tourney.status !== 'lobby') return;

        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_leave',
            payload: {
                tourney_id: tourney.id,
                player_id: window.user.id
            }
        });

        tourney.participants = tourney.participants.filter(function (p) { return p.id !== window.user.id; });

        if (isTourneyHost) {
            // Host leaves = cancel
            window.roomChannel.send({
                type: 'broadcast',
                event: 'tourney_cancel',
                payload: { tourney_id: tourney.id }
            });
            tourney = null;
            isTourneyHost = false;
            showToast('Tournament cancelled.');
            renderLanding();
        } else {
            showToast('You left the tournament.');
            renderLanding();
        }
    };

    // --- Tournament View (Redirector) ---
    window.openTourneyView = function () {
        if (!tourney) return;
        // Navigate to games > battle tab if not there
        var battleBtn = document.querySelector('[onclick*="switchGame(\'battle\'"]');
        if (battleBtn) window.switchGame('battle', battleBtn);

        if (tourney.status === 'lobby') {
            renderTourneyLobby();
        } else if (tourney.status === 'active') {
            renderTourneyBracket();
        } else if (tourney.status === 'finished') {
            renderTourneyFinished();
        }
    };

    // --- Render Lobby ---
    function renderTourneyLobby() {
        var container = document.getElementById('battle-game-container');
        if (!container) return;

        var participantsHTML = '';
        for (var i = 0; i < tourney.size; i++) {
            if (i < tourney.participants.length) {
                var p = tourney.participants[i];
                var hostClass = p.id === tourney.hostId ? ' is-host' : '';
                participantsHTML += '<div class="tourney-participant' + hostClass + '">' +
                    '<img src="' + p.avatar + '" alt="' + escapeHTML(p.name) + '">' +
                    '<span>' + escapeHTML(p.name) + '</span></div>';
            } else {
                participantsHTML += '<div class="tourney-slot-empty"><i class="fas fa-user-plus"></i><span>Empty</span></div>';
            }
        }

        var isJoined = tourney.participants.some(function (p) { return p.id === window.user.id; });
        var actionsHTML = '';

        if (isTourneyHost) {
            var canStart = tourney.participants.length >= 2;
            actionsHTML =
                '<button class="sketch-btn" onclick="window.startTourney()" style="background: #00b894; color: #fff; width: auto; font-size: 1.1rem; padding: 10px 25px;"' +
                (canStart ? '' : ' disabled style="background: #b2bec3; color: #fff; width: auto; font-size: 1.1rem; padding: 10px 25px; cursor: not-allowed;"') +
                '><i class="fas fa-play"></i> START TOURNAMENT (' + tourney.participants.length + '/' + tourney.size + ')</button>' +
                '<button class="sketch-btn danger" onclick="window.leaveTourney()" style="width: auto; padding: 10px 20px;">Cancel</button>';
        } else if (isJoined) {
            actionsHTML = '<button class="sketch-btn danger" onclick="window.leaveTourney()" style="width: auto; padding: 10px 20px;">Leave Tournament</button>';
        } else {
            actionsHTML = '<button class="sketch-btn" onclick="window.joinTourney()" style="background: #6c5ce7; color: #fff; width: auto; font-size: 1.1rem; padding: 10px 25px;"><i class="fas fa-sign-in-alt"></i> JOIN TOURNAMENT</button>' +
                '<button class="sketch-btn" onclick="window.battleBackToLobby()" style="width: auto; padding: 10px 20px;">Back</button>';
        }

        container.innerHTML =
            '<div class="tourney-lobby">' +
            '<div class="tourney-lobby-header">' +
            '<h3>🏆 TOURNAMENT LOBBY</h3>' +
            '<p>Hosted by ' + escapeHTML(tourney.hostName) + ' • ' + tourney.size + '-Player Bracket</p>' +
            '</div>' +
            '<div class="tourney-participants">' + participantsHTML + '</div>' +
            '<div class="tourney-lobby-actions">' + actionsHTML + '</div>' +
            '</div>';
    }

    // --- Start Tournament (Host only) ---
    window.startTourney = function () {
        if (!isTourneyHost || !tourney || tourney.status !== 'lobby') return;
        if (tourney.participants.length < 2) return showToast('Need at least 2 players!', 'error');

        tourney.status = 'active';
        tourney.bracket = generateBracket(tourney.participants, tourney.size);
        tourney.currentMatchIdx = 0;

        // Resolve byes
        resolveByes();

        // Broadcast
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_start',
            payload: tourney
        });

        showToast('Tournament started!');
        renderTourneyBracket();

        // Auto-trigger first available match
        setTimeout(function () { triggerNextMatch(); }, 2000);
    };

    // --- Bracket Generation ---
    function generateBracket(participants, bracketSize) {
        // Shuffle participants
        var shuffled = participants.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }

        var totalRounds = Math.log2(bracketSize);
        var matches = [];
        var matchId = 0;

        // First round matches
        for (var m = 0; m < bracketSize / 2; m++) {
            var p1 = shuffled[m * 2] || null;
            var p2 = shuffled[m * 2 + 1] || null;
            matches.push({
                id: matchId++,
                round: 0,
                p1: p1, // { id, name, avatar } or null (bye)
                p2: p2,
                winner: null,
                played: false
            });
        }

        // Subsequent rounds (empty, to be filled)
        var prevRoundCount = bracketSize / 2;
        for (var r = 1; r < totalRounds; r++) {
            prevRoundCount = prevRoundCount / 2;
            for (var mc = 0; mc < prevRoundCount; mc++) {
                matches.push({
                    id: matchId++,
                    round: r,
                    p1: null,
                    p2: null,
                    winner: null,
                    played: false
                });
            }
        }

        return matches;
    }

    // --- Resolve Byes ---
    function resolveByes() {
        if (!tourney || !tourney.bracket) return;
        var changed = true;
        while (changed) {
            changed = false;
            for (var i = 0; i < tourney.bracket.length; i++) {
                var match = tourney.bracket[i];
                if (match.played) continue;

                // If one player is null (bye), the other auto-advances
                if (match.p1 && !match.p2) {
                    match.winner = match.p1;
                    match.played = true;
                    advanceWinner(match);
                    changed = true;
                } else if (match.p2 && !match.p1) {
                    match.winner = match.p2;
                    match.played = true;
                    advanceWinner(match);
                    changed = true;
                } else if (!match.p1 && !match.p2 && match.round === 0) {
                    // Both null on round 0 = double bye, no one advances
                    match.played = true;
                    changed = true;
                }
            }
        }
    }

    // --- Advance Winner to next round ---
    function advanceWinner(match) {
        if (!tourney || !tourney.bracket) return;
        var totalRounds = Math.log2(tourney.size);
        if (match.round >= totalRounds - 1) return; // Final already

        // Find next round match
        var matchesInRound = [];
        var matchIndex = -1;
        for (var i = 0; i < tourney.bracket.length; i++) {
            if (tourney.bracket[i].round === match.round) {
                if (tourney.bracket[i].id === match.id) matchIndex = matchesInRound.length;
                matchesInRound.push(tourney.bracket[i]);
            }
        }

        var nextMatchLocalIdx = Math.floor(matchIndex / 2);
        var isTop = matchIndex % 2 === 0;

        // Find the next round match
        var nextRoundMatches = [];
        for (var j = 0; j < tourney.bracket.length; j++) {
            if (tourney.bracket[j].round === match.round + 1) {
                nextRoundMatches.push(tourney.bracket[j]);
            }
        }

        if (nextMatchLocalIdx < nextRoundMatches.length) {
            var nextMatch = nextRoundMatches[nextMatchLocalIdx];
            if (isTop) {
                nextMatch.p1 = match.winner;
            } else {
                nextMatch.p2 = match.winner;
            }
        }
    }

    // --- Render Bracket ---
    function renderTourneyBracket() {
        var container = document.getElementById('battle-game-container');
        if (!container || !tourney || !tourney.bracket) return;

        var totalRounds = Math.log2(tourney.size);
        var roundNames = [];
        for (var r = 0; r < totalRounds; r++) {
            if (r === totalRounds - 1) roundNames.push('Final');
            else if (r === totalRounds - 2) roundNames.push('Semis');
            else roundNames.push('Round ' + (r + 1));
        }

        var bracketHTML = '<div class="tourney-bracket">';

        for (var rd = 0; rd < totalRounds; rd++) {
            bracketHTML += '<div class="tourney-round">';
            bracketHTML += '<div class="tourney-round-label">' + roundNames[rd] + '</div>';

            var roundMatches = tourney.bracket.filter(function (m) { return m.round === rd; });

            for (var mi = 0; mi < roundMatches.length; mi++) {
                var m = roundMatches[mi];
                var matchClass = 'tourney-match';
                if (m.played) matchClass += ' match-done';
                else if (m.p1 && m.p2) matchClass += ' match-active';

                bracketHTML += '<div class="' + matchClass + '">';
                bracketHTML += renderMatchPlayer(m, m.p1, true);
                bracketHTML += renderMatchPlayer(m, m.p2, false);
                bracketHTML += '</div>';
            }

            bracketHTML += '</div>';

            // Add connectors between rounds (except after last)
            if (rd < totalRounds - 1) {
                bracketHTML += '<div class="tourney-connector">';
                var connCount = Math.pow(2, totalRounds - rd - 1) / 2;
                for (var c = 0; c < connCount; c++) {
                    bracketHTML += '<div class="tourney-connector-line"></div>';
                }
                bracketHTML += '</div>';
            }
        }

        bracketHTML += '</div>';

        // Check if finished
        var championHTML = '';
        var standingsHTML = '';
        var actionsHTML = '';
        var finalMatch = tourney.bracket[tourney.bracket.length - 1];

        if (finalMatch && finalMatch.played && finalMatch.winner) {
            tourney.status = 'finished';
            championHTML = renderChampion(finalMatch.winner);
            standingsHTML = renderStandings();
            actionsHTML = '<div style="text-align: center; margin-top: 20px;">' +
                '<button class="sketch-btn" onclick="window.endTourney()" style="background: #6c5ce7; color: #fff; width: auto; padding: 10px 25px; font-size: 1.1rem;"><i class="fas fa-home"></i> BACK TO LOBBY</button>' +
                '</div>';
        } else {
            actionsHTML = '<div style="text-align: center; margin-top: 15px;">';
            if (isTourneyHost) {
                actionsHTML += '<button class="sketch-btn" onclick="window.triggerNextMatchManual()" style="background: #00b894; color: #fff; width: auto; padding: 8px 20px; margin: 5px;"><i class="fas fa-bolt"></i> Trigger Next Match</button>';
                actionsHTML += '<button class="sketch-btn danger" onclick="window.cancelTourney()" style="width: auto; padding: 8px 20px; margin: 5px;">Cancel Tournament</button>';
            }
            actionsHTML += '<button class="sketch-btn" onclick="window.battleBackToLobby()" style="width: auto; padding: 8px 20px; margin: 5px;">Back to Lobby</button>';
            actionsHTML += '</div>';
        }

        container.innerHTML =
            '<div class="tourney-bracket-wrapper">' +
            '<div class="tourney-bracket-header">' +
            '<h3>🏆 TOURNAMENT BRACKET</h3>' +
            '<p>Hosted by ' + escapeHTML(tourney.hostName) + '</p>' +
            '</div>' +
            championHTML +
            bracketHTML +
            standingsHTML +
            actionsHTML +
            '</div>';
    }

    function renderMatchPlayer(match, player, isTop) {
        if (!player) {
            if (match.round === 0) {
                return '<div class="tourney-match-player is-bye"><span>— BYE —</span></div>';
            }
            return '<div class="tourney-match-player is-tbd"><span>TBD</span></div>';
        }

        var cls = 'tourney-match-player';
        if (match.played && match.winner) {
            if (match.winner.id === player.id) cls += ' match-winner';
            else cls += ' match-loser';
        }

        var isMe = window.user && player.id === window.user.id;
        if (isMe) cls += ' lb-row-me';

        return '<div class="' + cls + '">' +
            '<img src="' + player.avatar + '" alt="' + escapeHTML(player.name) + '">' +
            '<span>' + escapeHTML(player.name) + '</span>' +
            '</div>';
    }

    function renderChampion(winner) {
        return '<div class="tourney-champion-card">' +
            '<div class="tourney-champion-crown">👑</div>' +
            '<h2>CHAMPION!</h2>' +
            '<img src="' + winner.avatar + '" alt="' + escapeHTML(winner.name) + '">' +
            '<h3>' + escapeHTML(winner.name) + '</h3>' +
            '</div>';
    }

    function renderStandings() {
        if (!tourney || !tourney.bracket) return '';

        // Build standings: champion, runner-up, semi-finalists, etc.
        var totalRounds = Math.log2(tourney.size);
        var standings = [];

        // Champion
        var finalMatch = tourney.bracket[tourney.bracket.length - 1];
        if (finalMatch && finalMatch.winner) {
            standings.push({ player: finalMatch.winner, result: 'Champion', resultClass: 'gold' });
            // Runner-up
            var loser = finalMatch.p1 && finalMatch.p1.id !== finalMatch.winner.id ? finalMatch.p1 : finalMatch.p2;
            if (loser) standings.push({ player: loser, result: 'Runner-up', resultClass: 'silver' });
        }

        // Semi-finalists and others
        for (var rd = totalRounds - 2; rd >= 0; rd--) {
            var roundMatches = tourney.bracket.filter(function (m) { return m.round === rd && m.played && m.winner; });
            for (var i = 0; i < roundMatches.length; i++) {
                var m = roundMatches[i];
                var rl = m.p1 && m.p1.id !== m.winner.id ? m.p1 : m.p2;
                if (rl && !standings.some(function (s) { return s.player.id === rl.id; })) {
                    var label = rd === totalRounds - 2 ? 'Semi-finalist' : 'Round ' + (rd + 1);
                    var resultClass = rd === totalRounds - 2 ? 'bronze' : 'eliminated';
                    standings.push({ player: rl, result: label, resultClass: resultClass });
                }
            }
        }

        if (standings.length === 0) return '';

        var html = '<div class="tourney-standings">' +
            '<div class="tourney-standings-header"><i class="fas fa-list-ol"></i> Tournament Standings</div>';

        for (var s = 0; s < standings.length; s++) {
            var st = standings[s];
            var rankIcon = s === 0 ? '🥇' : s === 1 ? '🥈' : s === 2 ? '🥉' : (s + 1);
            html += '<div class="tourney-standing-row">' +
                '<div class="tourney-standing-rank">' + rankIcon + '</div>' +
                '<img src="' + st.player.avatar + '" alt="' + escapeHTML(st.player.name) + '">' +
                '<div class="tourney-standing-name">' + escapeHTML(st.player.name) + '</div>' +
                '<div class="tourney-standing-result ' + st.resultClass + '">' + st.result + '</div>' +
                '</div>';
        }

        html += '</div>';
        return html;
    }

    // --- Trigger Next Match (Host) ---
    function triggerNextMatch() {
        if (!isTourneyHost || !tourney || tourney.status !== 'active') return;

        // Find next unplayed match where both players are set
        var nextMatch = null;
        for (var i = 0; i < tourney.bracket.length; i++) {
            var m = tourney.bracket[i];
            if (!m.played && m.p1 && m.p2) {
                nextMatch = m;
                break;
            }
        }

        if (!nextMatch) {
            // Check if tournament is over
            var finalMatch = tourney.bracket[tourney.bracket.length - 1];
            if (finalMatch && finalMatch.played) {
                tourney.status = 'finished';
                broadcastTourneyUpdate();
                renderTourneyBracket();
            }
            return;
        }

        tourney.currentMatchIdx = nextMatch.id;

        // Broadcast to both players to start battle
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_battle_start',
            payload: {
                tourney_id: tourney.id,
                match_id: nextMatch.id,
                p1: nextMatch.p1,
                p2: nextMatch.p2
            }
        });

        // If host is one of the players, handle locally
        if (nextMatch.p1.id === window.user.id || nextMatch.p2.id === window.user.id) {
            startTourneyMatchAsPlayer(nextMatch);
        }
    }

    window.triggerNextMatchManual = function () {
        triggerNextMatch();
        showToast('Triggering next match...');
    };

    // --- Start a match as a player in tournament ---
    function startTourneyMatchAsPlayer(match) {
        inTourneyMatch = true;
        var oppPlayer = match.p1.id === window.user.id ? match.p2 : match.p1;

        opponentId = oppPlayer.id;
        opponentName = oppPlayer.name;
        opponentAvatar = oppPlayer.avatar;
        currentBattleId = 'tourney_match_' + match.id;

        startCreatureSelection();
    }

    // --- Handle Tournament Battle Result ---
    function onTourneyBattleResult(result) {
        if (!tourney || !inTourneyMatch) return;
        inTourneyMatch = false;

        // Report result to host
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_match_result',
            payload: {
                tourney_id: tourney.id,
                match_id: tourney.currentMatchIdx,
                reporter_id: window.user.id,
                winner_id: result === 'win' ? window.user.id : (result === 'lose' ? opponentId : null),
                result: result
            }
        });

        // If I'm the host, process immediately
        if (isTourneyHost && result !== 'draw') {
            processTourneyMatchResult(tourney.currentMatchIdx, result === 'win' ? window.user.id : opponentId);
        }
    }

    function processTourneyMatchResult(matchId, winnerId) {
        if (!tourney || !tourney.bracket) return;

        var match = null;
        for (var i = 0; i < tourney.bracket.length; i++) {
            if (tourney.bracket[i].id === matchId) {
                match = tourney.bracket[i];
                break;
            }
        }

        if (!match || match.played) return;

        // Set winner
        if (match.p1 && match.p1.id === winnerId) {
            match.winner = match.p1;
        } else if (match.p2 && match.p2.id === winnerId) {
            match.winner = match.p2;
        } else {
            return; // Invalid
        }

        match.played = true;
        advanceWinner(match);
        resolveByes(); // In case the next round has byes

        // Broadcast updated state
        broadcastTourneyUpdate();

        // Re-render bracket
        renderTourneyBracket();

        // Trigger next match after delay
        setTimeout(function () { triggerNextMatch(); }, 3000);
    }

    function broadcastTourneyUpdate() {
        if (!tourney) return;
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_update',
            payload: tourney
        });
    }

    // --- Cancel Tournament ---
    window.cancelTourney = function () {
        if (!isTourneyHost || !tourney) return;
        window.roomChannel.send({
            type: 'broadcast',
            event: 'tourney_cancel',
            payload: { tourney_id: tourney.id }
        });
        showToast('Tournament cancelled.');
        tourney = null;
        isTourneyHost = false;
        inTourneyMatch = false;
        renderLanding();
    };

    // --- End Tournament (back to lobby) ---
    window.endTourney = function () {
        tourney = null;
        isTourneyHost = false;
        inTourneyMatch = false;
        resetBattleState();
        renderLanding();
    };

    function renderTourneyFinished() {
        renderTourneyBracket(); // Bracket renderer handles finished state
    }

    // --- Extend showBattleResult for tournament mode ---
    var _origShowBattleResult = showBattleResult;
    showBattleResult = function () {
        _origShowBattleResult();

        if (inTourneyMatch) {
            var result = determineBattleResult();
            onTourneyBattleResult(result);

            // Add "Back to Bracket" button
            var resultArea = document.getElementById('battle-result-area');
            if (resultArea) {
                var bracketBtn = document.createElement('button');
                bracketBtn.className = 'sketch-btn';
                bracketBtn.style.cssText = 'width: auto; margin-top: 10px; font-size: 1rem; padding: 8px 20px; background: #6c5ce7; color: #fff;';
                bracketBtn.innerHTML = '<i class="fas fa-trophy"></i> Back to Bracket';
                bracketBtn.onclick = function () {
                    resetBattleState();
                    inTourneyMatch = false;
                    renderTourneyBracket();
                };
                var splash = resultArea.querySelector('.battle-result-splash');
                if (splash) splash.appendChild(bracketBtn);
            }
        }
    };

    // --- Extend handleBattleEvent for tournament events ---
    var _origHandleBattleEvent = window.handleBattleEvent;
    window.handleBattleEvent = function (event, payload) {
        // Handle tournament events first
        switch (event) {
            case 'tourney_create':
                if (!tourney || tourney.status === 'finished') {
                    tourney = payload;
                    isTourneyHost = (payload.hostId === window.user.id);
                    showToast('🏆 ' + escapeHTML(payload.hostName) + ' created a tournament!');
                    // If on battle landing, re-render to show banner
                    var container = document.getElementById('battle-game-container');
                    if (container && container.querySelector('.battle-landing')) {
                        renderLanding();
                    }
                }
                return;

            case 'tourney_join':
                if (tourney && tourney.id === payload.tourney_id && tourney.status === 'lobby') {
                    var exists = tourney.participants.some(function (p) { return p.id === payload.player.id; });
                    if (!exists) {
                        tourney.participants.push(payload.player);
                        showToast(escapeHTML(payload.player.name) + ' joined the tournament!');
                        // Re-render lobby if viewing it
                        var cont = document.getElementById('battle-game-container');
                        if (cont && cont.querySelector('.tourney-lobby')) {
                            renderTourneyLobby();
                        }
                    }
                }
                return;

            case 'tourney_leave':
                if (tourney && tourney.id === payload.tourney_id && tourney.status === 'lobby') {
                    tourney.participants = tourney.participants.filter(function (p) { return p.id !== payload.player_id; });
                    var cont2 = document.getElementById('battle-game-container');
                    if (cont2 && cont2.querySelector('.tourney-lobby')) {
                        renderTourneyLobby();
                    }
                }
                return;

            case 'tourney_start':
                tourney = payload;
                isTourneyHost = (payload.hostId === window.user.id);
                showToast('🏆 Tournament has started!');
                // Switch to bracket if in battle section
                var bContainer = document.getElementById('battle-game-container');
                if (bContainer) {
                    renderTourneyBracket();
                }
                return;

            case 'tourney_update':
                tourney = payload;
                isTourneyHost = (payload.hostId === window.user.id);
                var uContainer = document.getElementById('battle-game-container');
                if (uContainer && !inTourneyMatch) {
                    if (tourney.status === 'active' || tourney.status === 'finished') {
                        renderTourneyBracket();
                    }
                }
                return;

            case 'tourney_battle_start':
                if (!tourney || tourney.id !== payload.tourney_id) return;
                // Check if I'm a player in this match
                if (payload.p1.id === window.user.id || payload.p2.id === window.user.id) {
                    tourney.currentMatchIdx = payload.match_id;

                    // Switch to battle tab if needed
                    var gamesTab = document.querySelector('[onclick*="switchTab"][onclick*="games"]') ||
                        document.querySelector('.tab-btn[onclick*="games"]');
                    if (gamesTab) gamesTab.click();

                    var bBtn = document.querySelector('[onclick*="switchGame(\'battle\'"]');
                    if (bBtn) window.switchGame('battle', bBtn);

                    showToast('🏆 Your tournament match is starting!');

                    var matchInfo = { p1: payload.p1, p2: payload.p2, id: payload.match_id };
                    startTourneyMatchAsPlayer(matchInfo);
                }
                return;

            case 'tourney_match_result':
                if (isTourneyHost && tourney && tourney.id === payload.tourney_id) {
                    // Only process if host and not already processed
                    if (payload.result !== 'draw' && payload.winner_id) {
                        processTourneyMatchResult(payload.match_id, payload.winner_id);
                    }
                }
                return;

            case 'tourney_cancel':
                if (tourney && tourney.id === payload.tourney_id) {
                    showToast('Tournament was cancelled.', 'error');
                    tourney = null;
                    isTourneyHost = false;
                    inTourneyMatch = false;
                    var cContainer = document.getElementById('battle-game-container');
                    if (cContainer) {
                        renderLanding();
                    }
                }
                return;
        }

        // Fall through to original handler
        _origHandleBattleEvent(event, payload);
    };

})();
