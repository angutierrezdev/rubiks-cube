// Solver Strategy Module
// Strategy pattern for solving methods (OCP), mirroring rotationStrategy.js.
// Solvers are pure: they take the cube context and return the solution as
// stage-grouped moves. They never animate or mutate the live cube.
//
// solve(context) -> [{ stage: string, moves: [{ name, axis, layer, direction }] }]
// context = { state: CubeState, history: [{ axis, layer, direction }] }

/**
 * Base solver strategy.
 */
class SolverStrategy {
    getName() {
        return 'Base Solver';
    }

    solve(context) {
        throw new Error('SolverStrategy.solve must be implemented');
    }
}

/**
 * Names a raw { axis, layer, direction } move in standard notation,
 * including middle slices (M follows L, E follows D, S follows F).
 */
function moveNotation(axis, layer, direction) {
    const FACE_NAMES = {
        'x:1:-1': 'R', 'x:1:1': "R'",
        'x:-1:1': 'L', 'x:-1:-1': "L'",
        'y:1:-1': 'U', 'y:1:1': "U'",
        'y:-1:1': 'D', 'y:-1:-1': "D'",
        'z:1:-1': 'F', 'z:1:1': "F'",
        'z:-1:1': 'B', 'z:-1:-1': "B'",
        'x:0:1': 'M', 'x:0:-1': "M'",
        'y:0:1': 'E', 'y:0:-1': "E'",
        'z:0:-1': 'S', 'z:0:1': "S'"
    };
    return FACE_NAMES[`${axis}:${layer}:${direction}`] || `${axis}${layer}${direction}`;
}

/**
 * RetraceSolver - replays the recorded move history backwards.
 * This is the original solve behavior, kept as a selectable method.
 */
class RetraceSolver extends SolverStrategy {
    getName() {
        return 'Retrace Moves';
    }

    solve(context) {
        const moves = [...context.history].reverse().map(m => ({
            name: moveNotation(m.axis, m.layer, -m.direction),
            axis: m.axis,
            layer: m.layer,
            direction: -m.direction
        }));
        if (moves.length === 0) return [];
        return [{ stage: 'Retracing moves', moves }];
    }
}

if (typeof window !== 'undefined') {
    window.SolverStrategy = SolverStrategy;
    window.RetraceSolver = RetraceSolver;
    window.solverMoveNotation = moveNotation;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SolverStrategy, RetraceSolver, moveNotation };
}
