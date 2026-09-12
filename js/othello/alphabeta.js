import {applyMove, getLegalMoves, isGameOver, opponent} from './board.js';
import {evaluateBoard, moveOrderingScore} from './heuristics.js';

class SearchTimeout extends Error {}

function orderedMoves(board, player) {
    return getLegalMoves(board, player)
        .slice()
        .sort((first, second) => moveOrderingScore(board, second) - moveOrderingScore(board, first));
}

function ensureTime(context) {
    context.nodes += 1;
    if ((context.nodes & 255) === 0 && performance.now() >= context.deadline) {
        throw new SearchTimeout();
    }
}

function alphaBeta(board, turn, rootPlayer, depth, alpha, beta, context) {
    ensureTime(context);
    if (depth === 0 || isGameOver(board)) {
        return evaluateBoard(board, rootPlayer, context.heuristic);
    }

    const moves = orderedMoves(board, turn);
    if (moves.length === 0) {
        return alphaBeta(board, opponent(turn), rootPlayer, depth, alpha, beta, context);
    }

    if (turn === rootPlayer) {
        let value = -Infinity;
        for (const move of moves) {
            const child = applyMove(board, move.row, move.col, turn);
            value = Math.max(value, alphaBeta(child, opponent(turn), rootPlayer, depth - 1, alpha, beta, context));
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return value;
    }

    let value = Infinity;
    for (const move of moves) {
        const child = applyMove(board, move.row, move.col, turn);
        value = Math.min(value, alphaBeta(child, opponent(turn), rootPlayer, depth - 1, alpha, beta, context));
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
    }
    return value;
}

function searchRoot(board, player, depth, context) {
    const moves = orderedMoves(board, player);
    let bestMove = moves[0] || null;
    let bestValue = -Infinity;
    let alpha = -Infinity;

    for (const move of moves) {
        ensureTime(context);
        const child = applyMove(board, move.row, move.col, player);
        const value = alphaBeta(child, opponent(player), player, depth - 1, alpha, Infinity, context);
        if (value > bestValue) {
            bestValue = value;
            bestMove = move;
        }
        alpha = Math.max(alpha, bestValue);
    }

    return {move: bestMove, value: bestValue};
}

export function chooseMove(board, player, options = {}) {
    const maxDepth = options.maxDepth ?? 4;
    const timeLimitMs = options.timeLimitMs ?? 500;
    const moves = orderedMoves(board, player);
    if (moves.length === 0) {
        return {move: null, depth: 0, nodes: 0};
    }

    const context = {
        deadline: performance.now() + timeLimitMs,
        nodes: 0,
        heuristic: options.heuristic ?? 'stability'
    };
    let bestMove = moves[0];
    let completedDepth = 0;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
        try {
            const result = searchRoot(board, player, depth, context);
            bestMove = result.move;
            completedDepth = depth;
        } catch (error) {
            if (!(error instanceof SearchTimeout)) throw error;
            break;
        }
        if (performance.now() >= context.deadline) break;
    }

    return {move: bestMove, depth: completedDepth, nodes: context.nodes};
}
