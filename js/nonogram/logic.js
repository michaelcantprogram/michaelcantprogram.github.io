export const EMPTY = 0;
export const FILLED = 1;
export const MARKED = -1;

export function createGrid(rows = 10, columns = 10) {
    return Array.from({length: rows}, () => Array(columns).fill(EMPTY));
}

export function cloneGrid(grid) {
    return grid.map((row) => row.slice());
}

export function toggledValue(currentValue, toolValue) {
    return currentValue === toolValue ? EMPTY : toolValue;
}

export function applyRectangle(grid, start, end, toolValue) {
    const nextGrid = cloneGrid(grid);
    const firstRow = Math.min(start.row, end.row);
    const lastRow = Math.max(start.row, end.row);
    const firstColumn = Math.min(start.column, end.column);
    const lastColumn = Math.max(start.column, end.column);

    for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
            nextGrid[row][column] = toggledValue(nextGrid[row][column], toolValue);
        }
    }
    return nextGrid;
}

export function isSolved(grid, solution) {
    return solution.every((row, rowIndex) => [...row].every((cell, columnIndex) => {
        const shouldBeFilled = cell === '1';
        return (grid[rowIndex][columnIndex] === FILLED) === shouldBeFilled;
    }));
}

export function mismatchedCells(grid, solution) {
    const mismatches = [];
    solution.forEach((row, rowIndex) => {
        [...row].forEach((cell, columnIndex) => {
            const shouldBeFilled = cell === '1';
            if ((grid[rowIndex][columnIndex] === FILLED) !== shouldBeFilled) {
                mismatches.push({row: rowIndex, column: columnIndex, value: shouldBeFilled ? FILLED : MARKED});
            }
        });
    });
    return mismatches;
}

export function cluesForLine(line) {
    const clues = [];
    let runLength = 0;
    for (const value of line) {
        if (value === '1' || value === 1) {
            runLength += 1;
        } else if (runLength > 0) {
            clues.push(runLength);
            runLength = 0;
        }
    }
    if (runLength > 0) clues.push(runLength);
    return clues.length > 0 ? clues : [0];
}

export function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
