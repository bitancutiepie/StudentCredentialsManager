/**
 * Wimpy Wordle - Diary of a Wimpy Kid themed Wordle clone
 */

const WIMPY_WORDS = [
    "GREGG", "DIARY", "WIMPY", "MANNY", "CHRIS", "CHEES", "METAL", "FRANK", "SUSAN", "HOLLY",
    "FREGG", "BOOKS", "WRITE", "STUCK", "ZOOEE", "MAMAS", "PLOPY", "BUBBY",
    "GAMES", "LODER", "PAPER", "SKETC", "NOTES", "CLASS", "GRADE", "SCARE", "SHOCK", "WIDER"
];

// Standard Wordle words for fallback or extended list
const EXTENDED_WORDS = [
    "APPLE", "BEACH", "BRAIN", "BREAD", "BRUSH", "CHAIR", "CHEST", "CHORD", "CLICK", "CLOCK",
    "CLOUD", "DANCE", "DIARY", "DRINK", "EARTH", "FEAST", "FIELD", "FLAME", "FLOWER", "GLASS",
    "GRAPE", "GREEN", "GHOST", "HEART", "HOUSE", "JUICE", "LIGHT", "LEMON", "MELON", "MONEY",
    "MUSIC", "NIGHT", "OCEAN", "PARTY", "PIANO", "PILOT", "PLANE", "PHONE", "PIZZA", "PLANT",
    "RADIO", "RIVER", "ROBOT", "SHIRT", "SHOES", "SMILE", "SNAKE", "SPACE", "SPOON", "STORM",
    "TABLE", "TIGER", "TOAST", "TOUCH", "TRAIN", "TRUCK", "VOICE", "WATER", "WATCH", "WHALE",
    "WORLD", "WRITE", "YACHT", "ZEBRA"
];

const ALL_WORDS = [...WIMPY_WORDS, ...EXTENDED_WORDS];

class WordleGame {
    constructor() {
        this.board = document.getElementById('wordle-game-container');
        this.secretWord = "";
        this.currentGuess = "";
        this.guesses = [];
        this.gameOver = false;
        this.maxGuesses = 6;

        this.init();
    }

    async init() {
        // QUICKEST IMPLEMENTATION: Fetch from DB, fallback to hardcoded
        try {
            const { data, error } = await window.db
                .from('notes')
                .select('content')
                .eq('color', 'WORDLE_WORD');

            let pool = ALL_WORDS;
            if (!error && data && data.length > 0) {
                pool = data.map(w => w.content.toUpperCase());
                console.log("Loaded custom Wordle pool:", pool);
            }

            this.secretWord = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
            console.log("Secret word:", this.secretWord); // For debugging
        } catch (err) {
            this.secretWord = ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)].toUpperCase();
        }

        this.currentGuess = "";
        this.guesses = [];
        this.gameOver = false;

        this.render();
        this.setupEventListeners();
    }

    render() {
        this.board.innerHTML = `
            <div class="wordle-board">
                ${Array(this.maxGuesses).fill().map((_, i) => this.renderRow(i)).join('')}
            </div>
            <div class="wordle-keyboard">
                ${this.renderKeyboard()}
            </div>
        `;
    }

    renderRow(rowIndex) {
        const guess = this.guesses[rowIndex] || (rowIndex === this.guesses.length ? this.currentGuess : "");
        const isSubmitted = rowIndex < this.guesses.length;

        return `
            <div class="wordle-row" id="row-${rowIndex}">
                ${Array(5).fill().map((_, i) => {
            const char = guess[i] || "";
            let className = "wordle-cell";
            if (isSubmitted) {
                className += " " + this.getCellClass(char, i, this.guesses[rowIndex]);
            }
            return `<div class="wordle-cell ${className}">${char}</div>`;
        }).join('')}
            </div>
        `;
    }

    getCellClass(char, index, guess) {
        if (this.secretWord[index] === char) return "correct";
        if (this.secretWord.includes(char)) {
            // Complex Wordle logic for multiple occurrences
            const charCountInSecret = this.secretWord.split(char).length - 1;
            const charCountInGuessBefore = guess.substring(0, index + 1).split(char).length - 1;
            const correctOccurrences = Array.from(this.secretWord).filter((c, i) => c === char && guess[i] === char).length;

            if (charCountInGuessBefore <= (charCountInSecret - correctOccurrences) || this.secretWord[index] === char) {
                return "present";
            }
        }
        return "absent";
    }

    renderKeyboard() {
        const rows = [
            "QWERTYUIOP",
            "ASDFGHJKL",
            "ZXCVBNM"
        ];

        let html = "";
        rows.forEach((row, i) => {
            html += `<div class="keyboard-row">`;
            if (i === 2) html += `<div class="key wide" data-key="ENTER">ENTER</div>`;

            row.split('').forEach(char => {
                const status = this.getKeyStatus(char);
                html += `<div class="key ${status}" data-key="${char}">${char}</div>`;
            });

            if (i === 2) html += `<div class="key wide" data-key="BACKSPACE"><i class="fas fa-backspace"></i></div>`;
            html += `</div>`;
        });
        return html;
    }

    getKeyStatus(char) {
        let status = "";
        this.guesses.forEach(guess => {
            for (let i = 0; i < 5; i++) {
                if (guess[i] === char) {
                    if (this.secretWord[i] === char) status = "correct";
                    else if (this.secretWord.includes(char) && status !== "correct") status = "present";
                    else if (status !== "correct" && status !== "present") status = "absent";
                }
            }
        });
        return status;
    }

    setupEventListeners() {
        // Keyboard click
        this.board.onclick = (e) => {
            const keyEl = e.target.closest('.key');
            if (keyEl && !this.gameOver) {
                this.handleInput(keyEl.dataset.key);
            }
        };

        // Physical keyboard
        document.onkeydown = (e) => {
            if (this.gameOver || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            if (e.key === "Enter") this.handleInput("ENTER");
            else if (e.key === "Backspace") this.handleInput("BACKSPACE");
            else if (/^[a-zA-Z]$/.test(e.key)) this.handleInput(e.key.toUpperCase());
        };
    }

    handleInput(key) {
        if (key === "ENTER") {
            if (this.currentGuess.length === 5) {
                this.submitGuess();
            } else {
                this.shakeRow();
            }
        } else if (key === "BACKSPACE") {
            this.currentGuess = this.currentGuess.slice(0, -1);
            this.updateCurrentRow();
        } else if (this.currentGuess.length < 5) {
            this.currentGuess += key;
            this.updateCurrentRow();
        }
    }

    updateCurrentRow() {
        const row = document.getElementById(`row-${this.guesses.length}`);
        const cells = row.querySelectorAll('.wordle-cell');
        cells.forEach((cell, i) => {
            cell.innerText = this.currentGuess[i] || "";
            if (this.currentGuess[i]) {
                cell.classList.add('pop');
                setTimeout(() => cell.classList.remove('pop'), 100);
            }
        });
    }

    async submitGuess() {
        const guess = this.currentGuess;
        this.guesses.push(guess);
        this.currentGuess = "";

        // Animate flip
        const row = document.getElementById(`row-${this.guesses.length - 1}`);
        const cells = row.querySelectorAll('.wordle-cell');

        for (let i = 0; i < 5; i++) {
            cells[i].classList.add('flip');
            await new Promise(r => setTimeout(r, 100));

            const status = this.getCellClass(guess[i], i, guess);
            cells[i].classList.add(status);
            cells[i].classList.remove('flip');
        }

        if (guess === this.secretWord) {
            this.endGame(true);
        } else if (this.guesses.length === this.maxGuesses) {
            this.endGame(false);
        } else {
            this.render();
            this.setupEventListeners();
        }
    }

    shakeRow() {
        const row = document.getElementById(`row-${this.guesses.length}`);
        row.style.animation = 'shake 0.5s';
        setTimeout(() => row.style.animation = '', 500);
    }

    endGame(win) {
        this.gameOver = true;

        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div class="game-status-msg">
                ${win ? '<img src="monster.png" style="width: 150px; height: 150px; object-fit: contain; margin-bottom: 5px; transform: scale(1.1) rotate(-3deg);">' : ''}
                <div class="status-title">${win ? 'ZOO WEE MAMA!' : 'RATS!'}</div>
                <p style="font-size: 1.5rem;">${win ? 'You found the word!' : 'Better luck next time, Greg.'}</p>
                <p style="font-size: 2rem; margin-top: 10px; font-family: 'Permanent Marker'; text-decoration: underline;">
                    ${this.secretWord}
                </p>
                <button class="status-btn" onclick="initWimpyWordle()">PLAY AGAIN</button>
            </div>
        `;
        document.body.appendChild(overlay);
        this.statusOverlay = overlay;
    }
}

function initWimpyWordle() {
    const existing = document.querySelector('.game-status-msg');
    if (existing) existing.parentElement.remove();

    window.wordleGame = new WordleGame();
}
window.initWimpyWordle = initWimpyWordle;

// Add CSS animation for shaking
const style = document.createElement('style');
style.innerHTML = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Start game when tab is switched to 'games'
const originalSwitchTab = window.switchTab;
window.switchTab = function (tabId, event) {
    originalSwitchTab(tabId, event);
    if (tabId === 'games') {
        initWimpyWordle();

        // If Main Admin, show word pool manager and fetch data
        const poolSection = document.getElementById('wordle-pool-section');
        if (poolSection) {
            if (window.user && window.user.sr_code === 'ADMIN') {
                poolSection.classList.remove('hidden');
                if (window.fetchWordlePool) window.fetchWordlePool();
            } else {
                poolSection.classList.add('hidden');
            }
        }
    }
};
