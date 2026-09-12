export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZE = 8;

const DIRECTIONS = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1]
];

export function opponent(player) {
    return player === BLACK ? WHITE : BLACK;
}

export function createInitialBoard() {
    const board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    return board;
}

export function cloneBoard(board) {
    return board.map((row) => row.slice());
}

function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function getFlips(board, row, col, player) {
    if (!inBounds(row, col) || board[row][col] !== EMPTY) {
        return [];
    }

    const other = opponent(player);
    const flips = [];

    for (const [rowDelta, colDelta] of DIRECTIONS) {
        const line = [];
        let nextRow = row + rowDelta;
        let nextCol = col + colDelta;

        while (inBounds(nextRow, nextCol) && board[nextRow][nextCol] === other) {
            line.push({row: nextRow, col: nextCol});
            nextRow += rowDelta;
            nextCol += colDelta;
        }

        if (line.length > 0 && inBounds(nextRow, nextCol) && board[nextRow][nextCol] === player) {
            flips.push(...line);
        }
    }

    return flips;
}

export function getLegalMoves(board, player) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            const flips = getFlips(board, row, col, player);
            if (flips.length > 0) {
                moves.push({row, col, flips});
            }
        }
    }
    return moves;
}

export function applyMove(board, row, col, player) {
    const flips = getFlips(board, row, col, player);
    if (flips.length === 0) {
        throw new Error(`Illegal Othello move at row ${row}, column ${col}.`);
    }

    const nextBoard = cloneBoard(board);
    nextBoard[row][col] = player;
    for (const position of flips) {
        nextBoard[position.row][position.col] = player;
    }
    return nextBoard;
}

export function countDiscs(board) {
    let black = 0;
    let white = 0;
    for (const row of board) {
        for (const cell of row) {
            if (cell === BLACK) black += 1;
            if (cell === WHITE) white += 1;
        }
    }
    return {black, white, empty: BOARD_SIZE * BOARD_SIZE - black - white};
}

export function isGameOver(board) {
    return getLegalMoves(board, BLACK).length === 0 && getLegalMoves(board, WHITE).length === 0;
}
