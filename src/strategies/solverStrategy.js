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

    supportsSteps() {
        return false;
    }

    /**
     * Ordered stage metadata for step mode: [{ name, goal, algorithm }].
     * Contract: stage names emitted by solve() must appear, in order, as a
     * subsequence of these names. Non-steppable solvers return [].
     */
    getStageDefinitions() {
        return [];
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

if (typeof window !== 'undefined') {
    window.SolverStrategy = SolverStrategy;
    window.solverMoveNotation = moveNotation;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SolverStrategy, moveNotation };
}
