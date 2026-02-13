/**
 * Wimpy Minesweeper - Diary of a Wimpy Kid themed Minesweeper
 */

class Minesweeper {
    constructor(rows = 10, cols = 10, mines = 12, difficulty = 'easy') {
        this.rows = rows;
        this.cols = cols;
        this.minesCount = mines;
        this.difficulty = difficulty;
        this.board = [];
        this.minePositions = new Set();
        this.revealedCount = 0;
        this.flagsCount = 0;
        this.gameOver = false;
        this.timer = 0;
        this.timerInterval = null;
        this.firstClick = true;

        this.container = document.getElementById('minesweeper-board');
        this.mineDisplay = document.getElementById('ms-mine-count');
        this.timerDisplay = document.getElementById('ms-timer');
        this.bestTimeDisplay = document.getElementById('ms-best-time');
        this.faceBtn = document.getElementById('ms-reset-btn');

        this.init();
    }

    init() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.minePositions.clear();
        this.revealedCount = 0;
        this.flagsCount = 0;
        this.gameOver = false;
        this.firstClick = true;
        this.stopTimer();
        this.timer = 0;
        this.updateDisplay();
        this.setFaceIcon('smile');
        this.loadBestTime();

        this.render();
    }

    setFaceIcon(type) {
        const iconMap = {
            'smile': 'fa-smile',
            'win': 'fa-laugh-beam',
            'lose': 'fa-dizzy',
            'scared': 'fa-surprise'
        };
        this.faceBtn.innerHTML = `<i class="fas ${iconMap[type] || 'fa-smile'}"></i>`;
    }

    loadBestTime() {
        const bestTimes = JSON.parse(localStorage.getItem('ms_best_times') || '{}');
        const best = bestTimes[this.difficulty];
        if (best) {
            this.bestTimeDisplay.innerText = this.formatTime(best);
        } else {
            this.bestTimeDisplay.innerText = "--:--";
        }
    }

    saveBestTime() {
        const bestTimes = JSON.parse(localStorage.getItem('ms_best_times') || '{}');
        const currentBest = bestTimes[this.difficulty];
        if (!currentBest || this.timer < currentBest) {
            bestTimes[this.difficulty] = this.timer;
            localStorage.setItem('ms_best_times', JSON.stringify(bestTimes));
            this.loadBestTime();
            showToast(`NEW RECORD! Best time for ${this.difficulty.toUpperCase()}: ${this.formatTime(this.timer)}`, "success");
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    startTimer() {
        if (this.timerInterval) return;
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.timerDisplay.innerText = String(Math.min(this.timer, 999)).padStart(3, '0');
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateDisplay() {
        const remaining = this.minesCount - this.flagsCount;
        const sign = remaining < 0 ? '-' : '';
        const absVal = Math.abs(remaining);
        this.mineDisplay.innerText = sign + String(absVal).padStart(remaining < 0 ? 2 : 3, '0');
        this.timerDisplay.innerText = String(this.timer).padStart(3, '0');
    }

    placeMines(exRow, exCol) {
        let placed = 0;
        while (placed < this.minesCount) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);

            // Avoid placing mine on first click or in 3x3 area around first click for a better start
            if (Math.abs(r - exRow) <= 1 && Math.abs(c - exCol) <= 1) continue;
            if (this.minePositions.has(`${r},${c}`)) continue;

            this.minePositions.add(`${r},${c}`);
            this.board[r][c] = -1; // -1 represents a mine
            placed++;
        }

        // Calculate numbers
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] === -1) continue;
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc] === -1) {
                            count++;
                        }
                    }
                }
                this.board[r][c] = count;
            }
        }
    }

    render() {
        this.container.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        this.container.innerHTML = "";

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('ms-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Mobile Long Press for Flagging
                let touchTimer = null;
                cell.addEventListener('touchstart', (e) => {
                    if (this.gameOver) return;
                    this.setFaceIcon('scared');
                    touchTimer = setTimeout(() => {
                        this.handleCellRightClick(r, c, cell);
                        touchTimer = null;
                        if (window.navigator.vibrate) window.navigator.vibrate(50);
                    }, 500);
                }, { passive: true });

                cell.addEventListener('touchend', () => {
                    if (touchTimer) {
                        clearTimeout(touchTimer);
                        touchTimer = null;
                    }
                    if (!this.gameOver) this.setFaceIcon('smile');
                }, { passive: true });

                cell.addEventListener('mousedown', (e) => {
                    if (this.gameOver) return;
                    if (e.button === 0) { // Left click
                        this.setFaceIcon('scared');
                    }
                });

                cell.addEventListener('mouseup', () => {
                    if (!this.gameOver) this.setFaceIcon('smile');
                });

                cell.addEventListener('click', () => this.handleCellClick(r, c));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.handleCellRightClick(r, c, cell);
                });

                this.container.appendChild(cell);
            }
        }
    }

    handleCellClick(r, c) {
        if (this.gameOver) return;

        const cellEl = this.getCellElement(r, c);

        // Chording logic: If revealed number clicked and flags match count, reveal neighbors
        if (cellEl.classList.contains('revealed')) {
            const val = this.board[r][c];
            if (val > 0) {
                let flagsAround = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                            const neighbor = this.getCellElement(nr, nc);
                            if (neighbor.classList.contains('flagged')) flagsAround++;
                        }
                    }
                }

                if (flagsAround === val) {
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                                const neighbor = this.getCellElement(nr, nc);
                                if (!neighbor.classList.contains('revealed') && !neighbor.classList.contains('flagged')) {
                                    this.handleCellClick(nr, nc);
                                }
                            }
                        }
                    }
                }
            }
            return;
        }

        if (cellEl.classList.contains('flagged')) return;

        if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(r, c);
            this.startTimer();
        }

        if (this.board[r][c] === -1) {
            this.revealMines(r, c);
            this.endGame(false);
            return;
        }

        this.revealCell(r, c);

        if (this.revealedCount === (this.rows * this.cols - this.minesCount)) {
            this.endGame(true);
        }
    }

    handleCellRightClick(r, c, el) {
        if (this.gameOver || el.classList.contains('revealed')) return;

        if (el.classList.contains('flagged')) {
            el.classList.remove('flagged');
            this.flagsCount--;
        } else {
            if (this.flagsCount < this.minesCount) {
                el.classList.add('flagged');
                this.flagsCount++;
            }
        }
        this.updateDisplay();
    }

    revealCell(r, c) {
        const el = this.getCellElement(r, c);
        if (el.classList.contains('revealed') || el.classList.contains('flagged')) return;

        el.classList.add('revealed');
        this.revealedCount++;

        const val = this.board[r][c];
        if (val > 0) {
            el.innerText = val;
            el.classList.add(`n${val}`);
        } else if (val === 0) {
            // Flood fill for empty cells
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        this.revealCell(nr, nc);
                    }
                }
            }
        }
    }

    revealMines(hitR, hitC) {
        this.minePositions.forEach(pos => {
            const [r, c] = pos.split(',').map(Number);
            const el = this.getCellElement(r, c);
            if (!el.classList.contains('flagged')) {
                el.classList.add('revealed', 'mine');
                if (r === hitR && c === hitC) el.style.background = '#ff4757';
                el.innerHTML = `<img src="assets/images/bombaPat.png" alt="bomb" style="width: 100%; height: 100%; transform: scale(1.3);">`;
            }
        });

        // Highlight incorrectly flagged cells
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const el = this.getCellElement(r, c);
                if (el.classList.contains('flagged') && this.board[r][c] !== -1) {
                    el.style.background = '#f1f2f6';
                    el.innerHTML = `<i class="fas fa-times" style="color:#d63031; font-size:1.2rem;"></i>`;
                }
            }
        }
    }

    getCellElement(r, c) {
        return this.container.children[r * this.cols + c];
    }

    endGame(win) {
        this.gameOver = true;
        this.stopTimer();
        this.setFaceIcon(win ? 'win' : 'lose');

        if (win) {
            this.saveBestTime();
            showToast("ZOO WEE MAMA! You cleared the field!", "success");
        } else {
            showToast("RATS! You hit a mine!", "error");
        }
    }

    destroy() {
        this.stopTimer();
        if (this.container) this.container.innerHTML = "";
    }
}

let msGame = null;
function initMinesweeper() {
    // CRITICAL: Stop previous game's timer
    if (msGame) {
        msGame.destroy();
    }

    const diffSelect = document.getElementById('ms-difficulty');
    const difficulty = diffSelect ? diffSelect.value : 'easy';

    let rows = 10;
    let cols = 10;
    let mines = 12;

    if (difficulty === 'medium') {
        rows = 15;
        cols = 15;
        mines = 35;
    } else if (difficulty === 'hard') {
        rows = 20;
        cols = 20;
        mines = 75;
    }

    msGame = new Minesweeper(rows, cols, mines, difficulty);
}

window.initMinesweeper = initMinesweeper;

// Export for tab switching
window.cleanupMinesweeper = function () {
    if (msGame) msGame.stopTimer();
};

if (document.getElementById('ms-reset-btn')) {
    document.getElementById('ms-reset-btn').onclick = () => initMinesweeper();
}
