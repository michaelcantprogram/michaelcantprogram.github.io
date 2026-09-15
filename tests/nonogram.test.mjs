import assert from 'node:assert/strict';
import {NONOGRAM_PUZZLES} from '../js/nonogram/puzzles.js';
import {
    EMPTY,
    FILLED,
    MARKED,
    applyRectangle,
    cluesForLine,
    createGrid,
    formatDuration,
    isSolved,
    mismatchedCells,
    toggledValue
} from '../js/nonogram/logic.js';

assert.equal(NONOGRAM_PUZZLES.length, 6);
for (const puzzle of NONOGRAM_PUZZLES) {
    assert.equal(puzzle.solution.length, 10);
    assert.ok(puzzle.solution.every((row) => row.length === 10 && /^[01]+$/.test(row)));
    assert.deepEqual(puzzle.solution.map(cluesForLine), puzzle.rows);
    const columns = Array.from({length: 10}, (_, column) => puzzle.solution.map((row) => row[column]));
    assert.deepEqual(columns.map(cluesForLine), puzzle.columns);
}

const blank = createGrid();
assert.equal(blank.length, 10);
assert.ok(blank.every((row) => row.length === 10 && row.every((cell) => cell === EMPTY)));
assert.equal(toggledValue(EMPTY, FILLED), FILLED);
assert.equal(toggledValue(FILLED, FILLED), EMPTY);
assert.equal(toggledValue(EMPTY, MARKED), MARKED);

const rectangleGrid = createGrid(3, 3);
rectangleGrid[1][1] = FILLED;
const flippedRectangle = applyRectangle(rectangleGrid, {row: 0, column: 0}, {row: 1, column: 1}, FILLED);
assert.deepEqual(flippedRectangle, [[FILLED, FILLED, EMPTY], [FILLED, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY]]);
assert.equal(rectangleGrid[1][1], FILLED, 'rectangle changes must not mutate the history snapshot');
const crossedRectangle = applyRectangle(flippedRectangle, {row: 2, column: 2}, {row: 1, column: 1}, MARKED);
assert.equal(crossedRectangle[1][1], MARKED);
assert.equal(crossedRectangle[2][2], MARKED);

const firstPuzzle = NONOGRAM_PUZZLES[0];
const solvedGrid = firstPuzzle.solution.map((row) => [...row].map((cell) => cell === '1' ? FILLED : MARKED));
assert.ok(isSolved(solvedGrid, firstPuzzle.solution));
solvedGrid[0][0] = EMPTY;
assert.equal(isSolved(solvedGrid, firstPuzzle.solution), false);
assert.deepEqual(mismatchedCells(solvedGrid, firstPuzzle.solution)[0], {row: 0, column: 0, value: FILLED});
assert.equal(formatDuration(0), '0:00');
assert.equal(formatDuration(65.9), '1:05');

console.log('Nonogram engine tests passed.');
