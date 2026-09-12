import {BLACK, WHITE, applyMove, countDiscs, createInitialBoard, getLegalMoves, isGameOver, opponent} from './board.js';

export class OthelloGame {
    constructor(humanColor = BLACK) {
        this.reset(humanColor);
    }

    reset(humanColor = BLACK) {
        this.board = createInitialBoard();
        this.humanColor = humanColor;
        this.aiColor = opponent(humanColor);
        this.currentPlayer = BLACK;
        this.lastMove = null;
        this.gameOver = false;
    }

    legalMoves() {
        return getLegalMoves(this.board, this.currentPlayer);
    }

    makeMove(row, col) {
        if (this.gameOver) throw new Error('The game is already over.');
        const movingPlayer = this.currentPlayer;
        this.board = applyMove(this.board, row, col, movingPlayer);
        this.lastMove = {row, col, player: movingPlayer};
        this.currentPlayer = opponent(movingPlayer);

        let passedColor = null;
        if (getLegalMoves(this.board, this.currentPlayer).length === 0) {
            if (getLegalMoves(this.board, movingPlayer).length > 0) {
                passedColor = this.currentPlayer;
                this.currentPlayer = movingPlayer;
            } else {
                this.gameOver = true;
            }
        }

        return {passedColor, gameOver: this.gameOver};
    }

    score() {
        return countDiscs(this.board);
    }

    winner() {
        if (!this.gameOver && !isGameOver(this.board)) return null;
        const {black, white} = this.score();
        if (black === white) return 0;
        return black > white ? BLACK : WHITE;
    }
}

export {BLACK, WHITE};
