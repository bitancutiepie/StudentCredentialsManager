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

        if (battleState !== 'idle') {
            window.roomChannel.send({
                type: 'broadcast',
                event: 'battle_decline',
                payload: { battle_id: battle_id, from_id: window.user.id, to_id: from_id, reason: 'busy' }
            });
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
                '<button class="sketch-btn" onclick="window.battlePlayAgain()" style="background: ' + cfg.color + '; color: #fff; width: auto; margin-top: 15px; font-size: 1.1rem; padding: 10px 30px;"><i class="fas fa-redo"></i> PLAY AGAIN</button>' +
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

})();
