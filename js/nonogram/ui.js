import {NONOGRAM_PUZZLES} from './puzzles.js';
import {
    EMPTY,
    FILLED,
    MARKED,
    applyRectangle,
    cloneGrid,
    cluesForLine,
    createGrid,
    formatDuration,
    isSolved,
    mismatchedCells,
    toggledValue
} from './logic.js';

const HINT_LIMIT = 3;
const BEST_STORAGE_KEY = 'changdao-nonogram-personal-bests-v1';

const puzzleElement = document.querySelector('#nonogram-puzzle');
const overlay = document.querySelector('#puzzle-overlay');
const setupDialog = document.querySelector('#puzzle-setup');
const rulesDialog = document.querySelector('#nonogram-rules');
const completionDialog = document.querySelector('#puzzle-complete');
const startButton = document.querySelector('#start-puzzle');
const showRulesButton = document.querySelector('#show-nonogram-rules');
const closeRulesButton = document.querySelector('#close-nonogram-rules');
const replayButton = document.querySelector('#replay-puzzle');
const nextButton = document.querySelector('#next-puzzle');
const hintButton = document.querySelector('#use-hint');
const undoButton = document.querySelector('#undo-move');
const resetButton = document.querySelector('#reset-puzzle');
const restartButton = document.querySelector('#restart-puzzle');
const newPuzzleButton = document.querySelector('#new-puzzle');
const checkButton = document.querySelector('#check-puzzle');
const puzzleNumberElement = document.querySelector('#puzzle-number');
const hintsLeftElement = document.querySelector('#hints-left');
const personalBestElement = document.querySelector('#personal-best');
const timerElement = document.querySelector('#puzzle-timer');
const filledCountElement = document.querySelector('#filled-count');
const statusElement = document.querySelector('#puzzle-status');
const statusDetailElement = document.querySelector('#puzzle-status-detail');
const completionSummary = document.querySelector('#completion-summary');
const humanResult = document.querySelector('#human-result');
const solverResult = document.querySelector('#solver-result');

let puzzleIndex = -1;
let puzzle = null;
let grid = createGrid();
let history = [];
let started = false;
let completed = false;
let hintsUsed = 0;
let startTime = 0;
let finalSeconds = 0;
let timerHandle = null;
let statusMessage = '';
let dragState = null;
let hintedCellKey = '';
let hintToken = 0;

function randomPuzzleIndex(excluding = -1) {
    if (NONOGRAM_PUZZLES.length === 1) return 0;
    let nextIndex = excluding;
    while (nextIndex === excluding) nextIndex = Math.floor(Math.random() * NONOGRAM_PUZZLES.length);
    return nextIndex;
}

function loadPersonalBests() {
    try {
        return JSON.parse(localStorage.getItem(BEST_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function personalBestForCurrentPuzzle() {
    const stored = loadPersonalBests()[puzzle.id];
    return Number.isFinite(stored) ? stored : null;
}

function savePersonalBest(seconds) {
    try {
        const bests = loadPersonalBests();
        bests[puzzle.id] = seconds;
        localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(bests));
    } catch {
        // The puzzle remains fully playable when browser storage is unavailable.
    }
}

function arraysEqual(first, second) {
    return first.length === second.length && first.every((value, index) => value === second[index]);
}

function lineIsSatisfied(values, clues) {
    return arraysEqual(cluesForLine(values.map((value) => value === FILLED ? 1 : 0)), clues);
}

function buildPuzzle() {
    const fragment = document.createDocumentFragment();
    puzzleElement.replaceChildren();

    const corner = document.createElement('div');
    corner.className = 'clue-corner';
    corner.setAttribute('aria-hidden', 'true');
    fragment.appendChild(corner);

    puzzle.columns.forEach((clues, column) => {
        const clue = document.createElement('div');
        clue.className = 'column-clue';
        clue.dataset.columnClue = String(column);
        clue.style.gridColumn = String(column + 2);
        clue.style.gridRow = '1';
        clue.setAttribute('aria-label', `Column ${column + 1}: ${clues.join(', ')}`);
        clues.forEach((value) => {
            const number = document.createElement('span');
            number.textContent = value;
            clue.appendChild(number);
        });
        fragment.appendChild(clue);
    });

    puzzle.rows.forEach((clues, row) => {
        const clue = document.createElement('div');
        clue.className = 'row-clue';
        clue.dataset.rowClue = String(row);
        clue.style.gridColumn = '1';
        clue.style.gridRow = String(row + 2);
        clue.setAttribute('aria-label', `Row ${row + 1}: ${clues.join(', ')}`);
        clues.forEach((value) => {
            const number = document.createElement('span');
            number.textContent = value;
            clue.appendChild(number);
        });
        fragment.appendChild(clue);
    });

    for (let row = 0; row < 10; row += 1) {
        for (let column = 0; column < 10; column += 1) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'nonogram-cell';
            cell.dataset.row = String(row);
            cell.dataset.column = String(column);
            cell.style.gridColumn = String(column + 2);
            cell.style.gridRow = String(row + 2);
            fragment.appendChild(cell);
        }
    }

    puzzleElement.appendChild(fragment);
    renderPuzzle();
}

function renderPuzzle() {
    puzzleElement.querySelectorAll('.nonogram-cell').forEach((cell) => {
        const row = Number(cell.dataset.row);
        const column = Number(cell.dataset.column);
        const value = grid[row][column];
        const valueLabel = value === FILLED ? 'filled' : (value === MARKED ? 'marked empty' : 'unknown');
        cell.classList.toggle('is-filled', value === FILLED);
        cell.classList.toggle('is-marked', value === MARKED);
        cell.classList.toggle('is-hinted', `${row},${column}` === hintedCellKey);
        const isInDragSelection = dragState
            && row >= Math.min(dragState.start.row, dragState.end.row)
            && row <= Math.max(dragState.start.row, dragState.end.row)
            && column >= Math.min(dragState.start.column, dragState.end.column)
            && column <= Math.max(dragState.start.column, dragState.end.column);
        cell.classList.toggle('is-drag-preview', Boolean(isInDragSelection));
        cell.classList.toggle('is-cross-preview', Boolean(isInDragSelection && dragState.tool === MARKED));
        cell.disabled = !started || completed;
        cell.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}, ${valueLabel}`);
    });

    puzzle.rows.forEach((clues, row) => {
        puzzleElement.querySelector(`[data-row-clue="${row}"]`).classList.toggle('is-satisfied', lineIsSatisfied(grid[row], clues));
    });
    puzzle.columns.forEach((clues, column) => {
        const values = grid.map((row) => row[column]);
        puzzleElement.querySelector(`[data-column-clue="${column}"]`).classList.toggle('is-satisfied', lineIsSatisfied(values, clues));
    });
}

function elapsedSeconds() {
    if (!started) return 0;
    if (completed) return finalSeconds;
    return Math.floor((Date.now() - startTime) / 1000);
}

function renderStatus() {
    const filled = grid.flat().filter((value) => value === FILLED).length;
    const target = puzzle.solution.join('').split('').filter((value) => value === '1').length;
    const best = personalBestForCurrentPuzzle();

    puzzleNumberElement.textContent = `${puzzle.id + 1} of ${NONOGRAM_PUZZLES.length}`;
    hintsLeftElement.textContent = String(HINT_LIMIT - hintsUsed);
    personalBestElement.textContent = best === null ? '—' : formatDuration(best);
    timerElement.textContent = formatDuration(elapsedSeconds());
    filledCountElement.textContent = `${filled} / ${target}`;
    hintButton.disabled = !started || completed || hintsUsed >= HINT_LIMIT;
    undoButton.disabled = !started || completed || history.length === 0;
    resetButton.disabled = !started || completed;
    restartButton.disabled = !started;
    checkButton.disabled = !started || completed;

    if (!started) {
        statusElement.textContent = 'Ready to solve';
        statusDetailElement.textContent = 'Start when you are ready.';
    } else if (completed) {
        statusElement.textContent = 'Puzzle solved';
        statusDetailElement.textContent = `Completed in ${formatDuration(finalSeconds)}.`;
    } else {
        statusElement.textContent = 'Solving';
        statusDetailElement.textContent = statusMessage || 'Left-click fills/clears; right-click marks ×.';
    }
}

function render() {
    renderPuzzle();
    renderStatus();
}

function startTimer() {
    window.clearInterval(timerHandle);
    timerHandle = window.setInterval(() => {
        timerElement.textContent = formatDuration(elapsedSeconds());
    }, 250);
}

function stopTimer() {
    window.clearInterval(timerHandle);
    timerHandle = null;
}

function humanRankLabel(rank) {
    return Number.isInteger(rank) ? `${rank} of 6` : `tied ${Math.floor(rank)}–${Math.ceil(rank)} of 6`;
}

function completePuzzle() {
    if (completed) return;
    finalSeconds = elapsedSeconds();
    completed = true;
    stopTimer();

    const previousBest = personalBestForCurrentPuzzle();
    const qualifiesForBest = hintsUsed === 0;
    const isNewBest = qualifiesForBest && (previousBest === null || finalSeconds < previousBest);
    if (isNewBest) savePersonalBest(finalSeconds);

    let bestMessage = 'Hints were used, so this attempt was not added to personal bests.';
    if (qualifiesForBest) bestMessage = isNewBest ? 'New personal best on this device.' : 'Your personal best remains unchanged.';
    completionSummary.textContent = `Solved in ${formatDuration(finalSeconds)}. ${bestMessage}`;

    const research = puzzle.research;
    humanResult.textContent = `rating ${research.meanRating.toFixed(2)}/5 · rank ${humanRankLabel(research.humanRank)} · mean ${formatDuration(research.meanTimeSeconds)}`;
    solverResult.textContent = `${research.conflicts} conflicts · ${research.decisions} decisions · ${research.propagations} propagations`;

    setupDialog.hidden = true;
    rulesDialog.hidden = true;
    completionDialog.hidden = false;
    overlay.hidden = false;
    statusMessage = '';
    render();
    nextButton.focus();
}

function checkForCompletion() {
    if (isSolved(grid, puzzle.solution)) completePuzzle();
}

function applyCellValue(row, column, value) {
    if (grid[row][column] === value) return false;
    grid[row][column] = value;
    statusMessage = '';
    render();
    checkForCompletion();
    return true;
}

function pushHistory() {
    history.push(cloneGrid(grid));
    if (history.length > 200) history.shift();
}

function startPuzzle() {
    hintToken += 1;
    grid = createGrid();
    history = [];
    hintsUsed = 0;
    hintedCellKey = '';
    started = true;
    completed = false;
    finalSeconds = 0;
    startTime = Date.now();
    statusMessage = '';
    setupDialog.hidden = true;
    completionDialog.hidden = true;
    overlay.hidden = true;
    startTimer();
    render();
    puzzleElement.querySelector('.nonogram-cell')?.focus();
}

function preparePuzzle(nextIndex = randomPuzzleIndex(puzzleIndex)) {
    stopTimer();
    hintToken += 1;
    puzzleIndex = nextIndex;
    puzzle = NONOGRAM_PUZZLES[puzzleIndex];
    grid = createGrid();
    history = [];
    hintsUsed = 0;
    hintedCellKey = '';
    started = false;
    completed = false;
    finalSeconds = 0;
    statusMessage = '';
    dragState = null;
    setupDialog.hidden = false;
    rulesDialog.hidden = true;
    completionDialog.hidden = true;
    overlay.hidden = false;
    buildPuzzle();
    renderStatus();
}

function showRules() {
    setupDialog.hidden = true;
    rulesDialog.hidden = false;
    closeRulesButton.focus();
}

function closeRules() {
    rulesDialog.hidden = true;
    setupDialog.hidden = false;
    showRulesButton.focus();
}

function resetPuzzle() {
    if (!started || completed) return;
    hintToken += 1;
    pushHistory();
    grid = createGrid();
    hintedCellKey = '';
    statusMessage = 'Grid cleared. The timer is still running.';
    render();
}

function restartPuzzle() {
    if (!started) return;
    preparePuzzle(puzzleIndex);
}

function undoMove() {
    if (history.length === 0 || !started || completed) return;
    grid = history.pop();
    hintedCellKey = '';
    statusMessage = 'Last action undone.';
    render();
}

function useHint() {
    if (!started || completed || hintsUsed >= HINT_LIMIT) return;
    const mismatches = mismatchedCells(grid, puzzle.solution);
    if (mismatches.length === 0) {
        completePuzzle();
        return;
    }

    const hint = mismatches[Math.floor(Math.random() * mismatches.length)];
    pushHistory();
    grid[hint.row][hint.column] = hint.value;
    hintsUsed += 1;
    hintedCellKey = `${hint.row},${hint.column}`;
    statusMessage = `Hint revealed row ${hint.row + 1}, column ${hint.column + 1}.`;
    const currentToken = ++hintToken;
    render();
    window.setTimeout(() => {
        if (currentToken !== hintToken) return;
        hintedCellKey = '';
        renderPuzzle();
    }, 1400);
    checkForCompletion();
}

function checkPuzzle() {
    if (!started || completed) return;
    if (isSolved(grid, puzzle.solution)) {
        completePuzzle();
    } else {
        statusMessage = 'Not solved yet. A required cell is missing or a filled cell is incorrect.';
        renderStatus();
    }
}

function cellFromTarget(target) {
    return target instanceof Element ? target.closest('.nonogram-cell') : null;
}

function beginDrag(event) {
    const cell = cellFromTarget(event.target);
    if (!cell || !started || completed || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    dragState = {
        pointerId: event.pointerId,
        start: {row, column},
        end: {row, column},
        tool: event.button === 2 ? MARKED : FILLED
    };
    puzzleElement.setPointerCapture?.(event.pointerId);
    renderPuzzle();
}

function continueDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY);
    const cell = cellFromTarget(hovered);
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    if (row === dragState.end.row && column === dragState.end.column) return;
    dragState.end = {row, column};
    renderPuzzle();
}

function endDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const finishedDrag = dragState;
    dragState = null;
    pushHistory();
    grid = applyRectangle(grid, finishedDrag.start, finishedDrag.end, finishedDrag.tool);
    statusMessage = '';
    render();
    checkForCompletion();
}

function cancelDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState = null;
    renderPuzzle();
}

function updateClueHighlight(target) {
    puzzleElement.querySelectorAll('.is-highlighted').forEach((element) => element.classList.remove('is-highlighted'));
    const cell = cellFromTarget(target);
    if (!cell) return;
    puzzleElement.querySelector(`[data-row-clue="${cell.dataset.row}"]`)?.classList.add('is-highlighted');
    puzzleElement.querySelector(`[data-column-clue="${cell.dataset.column}"]`)?.classList.add('is-highlighted');
}

puzzleElement.addEventListener('pointerdown', beginDrag);
document.addEventListener('pointermove', continueDrag);
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', cancelDrag);
puzzleElement.addEventListener('pointerover', (event) => updateClueHighlight(event.target));
puzzleElement.addEventListener('pointerleave', () => updateClueHighlight(null));
puzzleElement.addEventListener('contextmenu', (event) => event.preventDefault());
puzzleElement.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const cell = cellFromTarget(event.target);
    if (!cell || !started || completed) return;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    pushHistory();
    applyCellValue(row, column, toggledValue(grid[row][column], FILLED));
});

startButton.addEventListener('click', startPuzzle);
showRulesButton.addEventListener('click', showRules);
closeRulesButton.addEventListener('click', closeRules);
replayButton.addEventListener('click', () => {
    preparePuzzle(puzzleIndex);
    startPuzzle();
});
nextButton.addEventListener('click', () => preparePuzzle());
newPuzzleButton.addEventListener('click', () => preparePuzzle());
hintButton.addEventListener('click', useHint);
undoButton.addEventListener('click', undoMove);
resetButton.addEventListener('click', resetPuzzle);
restartButton.addEventListener('click', restartPuzzle);
checkButton.addEventListener('click', checkPuzzle);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !rulesDialog.hidden) closeRules();
});

preparePuzzle();
