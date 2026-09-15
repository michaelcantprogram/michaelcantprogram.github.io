import assert from 'node:assert/strict';
import {
    BLACK,
    WHITE,
    applyMove,
    countDiscs,
    createInitialBoard,
    getLegalMoves,
    isGameOver
} from '../js/othello/board.js';
import {chooseMove} from '../js/othello/alphabeta.js';
import {OthelloGame} from '../js/othello/game.js';
import {evaluateBoard, HEURISTICS} from '../js/othello/heuristics.js';

function moveKeys(moves) {
    return moves.map(({row, col}) => `${row},${col}`).sort();
}

const initialBoard = createInitialBoard();
assert.deepEqual(moveKeys(getLegalMoves(initialBoard, BLACK)), ['2,3', '3,2', '4,5', '5,4']);
assert.deepEqual(moveKeys(getLegalMoves(initialBoard, WHITE)), ['2,4', '3,5', '4,2', '5,3']);

const afterD3 = applyMove(initialBoard, 2, 3, BLACK);
assert.equal(afterD3[3][3], BLACK);
assert.deepEqual(countDiscs(afterD3), {black: 4, white: 1, empty: 59});
assert.throws(() => applyMove(initialBoard, 0, 0, BLACK), /Illegal Othello move/);

const searchResult = chooseMove(initialBoard, BLACK, {maxDepth: 3, timeLimitMs: 500});
assert.ok(searchResult.move);
assert.ok(moveKeys(getLegalMoves(initialBoard, BLACK)).includes(`${searchResult.move.row},${searchResult.move.col}`));

const randomResult = chooseMove(initialBoard, BLACK, {heuristic: 'random', random: () => 0.5});
assert.ok(randomResult.move);
assert.equal(randomResult.depth, 0);
assert.equal(randomResult.nodes, 0);
assert.ok(moveKeys(getLegalMoves(initialBoard, BLACK)).includes(`${randomResult.move.row},${randomResult.move.col}`));

assert.deepEqual(Object.keys(HEURISTICS), ['parity', 'mobility', 'corner', 'stability']);
for (const heuristic of Object.keys(HEURISTICS)) {
    assert.equal(typeof evaluateBoard(initialBoard, BLACK, heuristic), 'number');
    const result = chooseMove(initialBoard, BLACK, {heuristic, maxDepth: 2, timeLimitMs: 500});
    assert.ok(result.move, `${heuristic} agent must choose a move.`);
    assert.ok(result.depth <= 2, `${heuristic} agent must respect the maximum depth.`);
    assert.ok(moveKeys(getLegalMoves(initialBoard, BLACK)).includes(`${result.move.row},${result.move.col}`));
}
assert.throws(() => evaluateBoard(initialBoard, BLACK, 'not-a-heuristic'), /Unknown Othello heuristic/);

const game = new OthelloGame(BLACK);
let turns = 0;
while (!game.gameOver && turns < 100) {
    const move = game.legalMoves()[0];
    assert.ok(move, 'The active player must have a legal move.');
    game.makeMove(move.row, move.col);
    turns += 1;
}
assert.ok(game.gameOver);
assert.ok(isGameOver(game.board));
const finalScore = game.score();
assert.equal(finalScore.black + finalScore.white + finalScore.empty, 64);
assert.ok(turns <= 60);
assert.notEqual(game.winner(), null);

const fullBoard = Array.from({length: 8}, () => Array(8).fill(BLACK));
assert.ok(isGameOver(fullBoard), 'A full board must be terminal.');

const noMoveBoard = Array.from({length: 8}, () => Array(8).fill(BLACK));
noMoveBoard[7][7] = 0;
assert.ok(isGameOver(noMoveBoard), 'A non-full board with no legal move for either side must be terminal.');

const whiteGame = new OthelloGame(WHITE);
assert.equal(whiteGame.currentPlayer, BLACK);
assert.equal(whiteGame.aiColor, BLACK);

console.log('Othello engine tests passed.');
