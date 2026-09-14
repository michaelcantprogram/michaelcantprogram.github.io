import {getLegalMoves} from './board.js';
import {chooseMove} from './alphabeta.js';
import {BLACK, WHITE, OthelloGame} from './game.js';

const HEURISTIC_LABELS = {
    parity: 'Parity',
    mobility: 'Mobility',
    corner: 'Corner',
    stability: 'Stability'
};
const MAX_CUSTOM_DEPTH = 8;
const SEARCH_TIME_LIMIT_MS = 7800;

const boardElement = document.querySelector('#othello-board');
const boardOverlay = document.querySelector('#board-overlay');
const setupDialog = document.querySelector('#setup-dialog');
const gameOverDialog = document.querySelector('#game-over-dialog');
const rulesDialog = document.querySelector('#rules-dialog');
const gameOverResult = document.querySelector('#game-over-result');
const gameOverScore = document.querySelector('#game-over-score');
const statusElement = document.querySelector('#game-status');
const detailElement = document.querySelector('#status-detail');
const blackScoreElement = document.querySelector('#black-score');
const whiteScoreElement = document.querySelector('#white-score');
const blackOwnerElement = document.querySelector('#black-owner');
const whiteOwnerElement = document.querySelector('#white-owner');
const sideSummaryElement = document.querySelector('#side-summary');
const agentSummaryElement = document.querySelector('#agent-summary');
const agentConfiguration = document.querySelector('#agent-configuration');
const customDepthInput = document.querySelector('#custom-depth-value');
const startGameButton = document.querySelector('#start-game');
const newGameButton = document.querySelector('#new-game');
const playAgainButton = document.querySelector('#play-again');
const showRulesButton = document.querySelector('#show-rules');
const closeRulesButton = document.querySelector('#close-rules');
const presetDepthInputs = [...document.querySelectorAll('input[name="search-depth"]:not([value="custom"])')];
const configurationInputs = [
    ...document.querySelectorAll('input[name="human-side"], input[name="agent-heuristic"], input[name="search-depth"]'),
    customDepthInput
];

let game = new OthelloGame(BLACK);
let gameStarted = false;
let aiThinking = false;
let notice = '';
let gameVersion = 0;
let rulesReturnState = 'game';
let resumeAgentAfterRules = false;

function colorName(color) {
    return color === BLACK ? 'Black' : 'White';
}

function coordinate(row, col) {
    return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function selectedHumanColor() {
    return document.querySelector('input[name="human-side"]:checked').value === 'white' ? WHITE : BLACK;
}

function selectedHeuristic() {
    return document.querySelector('input[name="agent-heuristic"]:checked').value;
}

function selectedSearchDepth() {
    const selected = document.querySelector('input[name="search-depth"]:checked').value;
    if (selected !== 'custom') return Number(selected);

    const enteredDepth = Math.trunc(Number(customDepthInput.value));
    if (!Number.isFinite(enteredDepth)) return 1;
    return Math.min(MAX_CUSTOM_DEPTH, Math.max(1, enteredDepth));
}

function normalizeCustomDepth() {
    customDepthInput.value = String(selectedSearchDepth());
}

function legalMoveKeys() {
    if (!gameStarted || game.gameOver || aiThinking || game.currentPlayer !== game.humanColor) return new Set();
    return new Set(getLegalMoves(game.board, game.humanColor).map(({row, col}) => `${row},${col}`));
}

function renderBoard() {
    const legalMoves = legalMoveKeys();
    const fragment = document.createDocumentFragment();
    boardElement.replaceChildren();
    boardElement.setAttribute('aria-busy', aiThinking ? 'true' : 'false');

    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const cell = document.createElement('button');
            const value = game.board[row][col];
            const isLegal = legalMoves.has(`${row},${col}`);
            const isLastMove = game.lastMove?.row === row && game.lastMove?.col === col;
            const labelParts = [coordinate(row, col)];

            cell.type = 'button';
            cell.className = 'board-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.disabled = !isLegal;

            if (value !== 0) {
                const disc = document.createElement('span');
                disc.className = `disc ${value === BLACK ? 'black' : 'white'}`;
                disc.setAttribute('aria-hidden', 'true');
                cell.appendChild(disc);
                labelParts.push(`${colorName(value)} disc`);
            } else {
                labelParts.push('empty');
            }

            if (isLegal) {
                cell.classList.add('legal-move');
                labelParts.push(`legal move for ${colorName(game.humanColor)}`);
                cell.title = `Play ${coordinate(row, col)}`;
            }
            if (isLastMove) {
                cell.classList.add('last-move');
                labelParts.push('last move');
            }

            cell.setAttribute('aria-label', labelParts.join(', '));
            fragment.appendChild(cell);
        }
    }

    boardElement.appendChild(fragment);
}

function renderStatus() {
    const score = game.score();
    const heuristic = selectedHeuristic();
    const maxDepth = selectedSearchDepth();
    const displayedHumanColor = gameStarted ? game.humanColor : selectedHumanColor();
    blackScoreElement.textContent = score.black;
    whiteScoreElement.textContent = score.white;
    blackOwnerElement.textContent = displayedHumanColor === BLACK ? '(You)' : '(Agent)';
    whiteOwnerElement.textContent = displayedHumanColor === WHITE ? '(You)' : '(Agent)';
    sideSummaryElement.textContent = `You: ${colorName(displayedHumanColor)}`;
    agentSummaryElement.textContent = `${HEURISTIC_LABELS[heuristic]} · depth ${maxDepth}`;

    if (!gameStarted) {
        statusElement.textContent = 'Ready to play';
        detailElement.textContent = 'Choose your side and agent settings.';
        return;
    }

    if (game.gameOver) {
        statusElement.textContent = 'Game over';
        detailElement.textContent = `Final score: Black ${score.black}, White ${score.white}.`;
        return;
    }

    if (aiThinking) {
        statusElement.textContent = 'Agent is thinking';
    } else if (game.currentPlayer === game.humanColor) {
        statusElement.textContent = 'Your turn';
    } else {
        statusElement.textContent = "Agent's turn";
    }

    detailElement.textContent = notice || `You are ${colorName(game.humanColor)}. ${colorName(game.currentPlayer)} moves next.`;
}

function render() {
    renderBoard();
    renderStatus();
}

function describeResult(result, actor, move) {
    if (result.gameOver) return '';
    if (result.passedColor !== null) {
        return `${colorName(result.passedColor)} has no legal move and passes.`;
    }
    return actor === 'AI' ? `Agent played ${coordinate(move.row, move.col)}.` : '';
}

function showGameOver() {
    const score = game.score();
    const winner = game.winner();
    let resultText = 'The game is a draw.';
    if (winner === game.humanColor) resultText = 'You win!';
    if (winner === game.aiColor) resultText = 'Agent wins.';

    gameOverResult.textContent = resultText;
    gameOverScore.textContent = `Black ${score.black} · White ${score.white}`;
    setupDialog.hidden = true;
    rulesDialog.hidden = true;
    gameOverDialog.hidden = false;
    boardOverlay.hidden = false;
    render();
    playAgainButton.focus();
}

function showRules() {
    rulesReturnState = !setupDialog.hidden ? 'setup' : (!gameOverDialog.hidden ? 'game-over' : 'game');
    resumeAgentAfterRules = gameStarted && !game.gameOver && game.currentPlayer === game.aiColor;

    if (aiThinking) {
        gameVersion += 1;
        aiThinking = false;
    }

    setupDialog.hidden = true;
    gameOverDialog.hidden = true;
    rulesDialog.hidden = false;
    boardOverlay.hidden = false;
    render();
    closeRulesButton.focus();
}

function closeRules() {
    rulesDialog.hidden = true;

    if (rulesReturnState === 'setup') {
        setupDialog.hidden = false;
        startGameButton.focus();
    } else if (rulesReturnState === 'game-over') {
        gameOverDialog.hidden = false;
        playAgainButton.focus();
    } else {
        boardOverlay.hidden = true;
        showRulesButton.focus();
    }

    render();
    if (resumeAgentAfterRules && rulesReturnState === 'game') scheduleAiTurn();
    resumeAgentAfterRules = false;
}

function scheduleAiTurn() {
    if (!gameStarted || game.gameOver || game.currentPlayer !== game.aiColor) return;
    const versionAtStart = gameVersion;
    aiThinking = true;
    notice = 'Searching…';
    render();

    window.setTimeout(() => {
        if (versionAtStart !== gameVersion) return;
        const searchOptions = {
            heuristic: selectedHeuristic(),
            maxDepth: selectedSearchDepth(),
            timeLimitMs: SEARCH_TIME_LIMIT_MS
        };
        let move;
        const searchStartedAt = performance.now();
        try {
            move = chooseMove(game.board, game.aiColor, searchOptions).move;
        } catch (error) {
            console.error('Alpha-Beta search failed; using the first legal move.', error);
            move = game.legalMoves()[0] || null;
        }
        const searchDuration = performance.now() - searchStartedAt;

        const playAgentMove = () => {
            if (versionAtStart !== gameVersion) return;
            if (!move) {
                aiThinking = false;
                render();
                return;
            }

            const result = game.makeMove(move.row, move.col);
            aiThinking = false;
            notice = describeResult(result, 'AI', move);
            if (result.gameOver) {
                showGameOver();
                return;
            }
            render();

            if (game.currentPlayer === game.aiColor) {
                scheduleAiTurn();
            }
        };

        if (searchDuration < 1000) {
            window.setTimeout(playAgentMove, 500);
        } else {
            playAgentMove();
        }
    }, 90);
}

function handleBoardClick(event) {
    const cell = event.target.closest('.board-cell.legal-move');
    if (!cell || !gameStarted || aiThinking || game.gameOver || game.currentPlayer !== game.humanColor) return;

    const move = {row: Number(cell.dataset.row), col: Number(cell.dataset.col)};
    const result = game.makeMove(move.row, move.col);
    notice = describeResult(result, 'human', move);
    if (result.gameOver) {
        showGameOver();
        return;
    }
    render();
    scheduleAiTurn();
}

function startGame() {
    gameVersion += 1;
    aiThinking = false;
    gameStarted = true;
    if (document.querySelector('input[name="search-depth"]:checked').value === 'custom') normalizeCustomDepth();
    game = new OthelloGame(selectedHumanColor());
    configurationInputs.forEach((input) => { input.disabled = true; });
    agentConfiguration.classList.add('is-locked');
    boardOverlay.hidden = true;
    notice = game.humanColor === BLACK
        ? 'You are Black and move first.'
        : 'You are White. The Agent, playing Black, moves first.';
    render();
    scheduleAiTurn();
}

function prepareNewGame() {
    gameVersion += 1;
    aiThinking = false;
    gameStarted = false;
    game = new OthelloGame(selectedHumanColor());
    notice = '';
    configurationInputs.forEach((input) => { input.disabled = false; });
    agentConfiguration.classList.remove('is-locked');
    setupDialog.hidden = false;
    gameOverDialog.hidden = true;
    rulesDialog.hidden = true;
    boardOverlay.hidden = false;
    render();
}

boardElement.addEventListener('click', handleBoardClick);
startGameButton.addEventListener('click', startGame);
newGameButton.addEventListener('click', prepareNewGame);
playAgainButton.addEventListener('click', prepareNewGame);
showRulesButton.addEventListener('click', showRules);
closeRulesButton.addEventListener('click', closeRules);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !rulesDialog.hidden) closeRules();
});
configurationInputs.forEach((input) => input.addEventListener('change', renderStatus));
presetDepthInputs.forEach((input) => input.addEventListener('change', () => {
    customDepthInput.value = '';
}));
customDepthInput.addEventListener('focus', () => {
    document.querySelector('input[name="search-depth"][value="custom"]').checked = true;
    renderStatus();
});
customDepthInput.addEventListener('input', () => {
    document.querySelector('input[name="search-depth"][value="custom"]').checked = true;
    renderStatus();
});
customDepthInput.value = '';
prepareNewGame();
