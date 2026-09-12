import {BLACK, WHITE, BOARD_SIZE, countDiscs, getLegalMoves, isGameOver, opponent} from './board.js';

const CORNERS = [[0, 0], [0, 7], [7, 0], [7, 7]];

function ownedCorners(board, player) {
    return CORNERS.reduce((total, [row, col]) => total + (board[row][col] === player ? 1 : 0), 0);
}

function stableEdgeDiscs(board, player) {
    const stable = new Set();
    const cornerRays = [
        {corner: [0, 0], directions: [[0, 1], [1, 0]]},
        {corner: [0, 7], directions: [[0, -1], [1, 0]]},
        {corner: [7, 0], directions: [[0, 1], [-1, 0]]},
        {corner: [7, 7], directions: [[0, -1], [-1, 0]]}
    ];

    for (const {corner, directions} of cornerRays) {
        const [cornerRow, cornerCol] = corner;
        if (board[cornerRow][cornerCol] !== player) continue;
        stable.add(`${cornerRow},${cornerCol}`);

        for (const [rowDelta, colDelta] of directions) {
            let row = cornerRow + rowDelta;
            let col = cornerCol + colDelta;
            while (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === player) {
                stable.add(`${row},${col}`);
                row += rowDelta;
                col += colDelta;
            }
        }
    }

    return stable.size;
}

function terminalValue(board, player) {
    const other = opponent(player);
    const counts = countDiscs(board);
    const playerCount = player === BLACK ? counts.black : counts.white;
    const opponentCount = player === BLACK ? counts.white : counts.black;
    const difference = playerCount - opponentCount;
    if (difference > 0) return 100000 + difference;
    if (difference < 0) return -100000 + difference;
    return 0;
}

function parity(board, player) {
    const counts = countDiscs(board);
    return player === BLACK ? counts.black - counts.white : counts.white - counts.black;
}

function mobility(board, player) {
    const other = opponent(player);
    return getLegalMoves(board, player).length - getLegalMoves(board, other).length;
}

function corner(board, player) {
    const other = opponent(player);
    return ownedCorners(board, player) - ownedCorners(board, other);
}

function stability(board, player) {
    const other = opponent(player);
    return stableEdgeDiscs(board, player) - stableEdgeDiscs(board, other);
}

export const HEURISTICS = Object.freeze({parity, mobility, corner, stability});

export function evaluateBoard(board, player, heuristic = 'stability') {
    if (isGameOver(board)) return terminalValue(board, player);

    const evaluate = HEURISTICS[heuristic];
    if (!evaluate) throw new Error(`Unknown Othello heuristic: ${heuristic}`);
    return evaluate(board, player);
}

export function moveOrderingScore(board, move) {
    const {row, col, flips} = move;
    const isCorner = (row === 0 || row === 7) && (col === 0 || col === 7);
    if (isCorner) return 10000 + flips.length;

    const isEdge = row === 0 || row === 7 || col === 0 || col === 7;
    const adjacentCorner = [
        [0, 0, [[0, 1], [1, 0], [1, 1]]],
        [0, 7, [[0, 6], [1, 7], [1, 6]]],
        [7, 0, [[7, 1], [6, 0], [6, 1]]],
        [7, 7, [[7, 6], [6, 7], [6, 6]]]
    ].find(([, , adjacent]) => adjacent.some(([nearRow, nearCol]) => nearRow === row && nearCol === col));

    if (adjacentCorner) {
        const [cornerRow, cornerCol] = adjacentCorner;
        if (board[cornerRow][cornerCol] === 0) return -1000 + flips.length;
    }

    return (isEdge ? 100 : 0) + flips.length;
}
