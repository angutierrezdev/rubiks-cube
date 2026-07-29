// Turn Arbiter Module
// Decides whether a request to turn a face may start, given what is already
// turning. Zero dependencies (no THREE.js, no DOM) so it can be unit tested
// directly with `node tests/test-turn-arbiter.js` - the same pattern as
// src/controllers/arcballRotation.js and src/core/cubeState.js.
//
// Three separate paths mutate the same cubies: the two-finger touch gesture,
// the modifier-key mouse drag, and the app's own animated sequences (solve,
// scramble, step playback). Each used to guard itself, or not at all - the
// touch handlers never consulted the animation state, so a stray finger could
// land a turn in the middle of a solve, and the solver would keep applying its
// remaining moves to a cube that had changed underneath it.
//
// The guard lives here instead of in any one path so that adding a fourth way
// to turn a face cannot silently skip it. Bypass-by-forgetting is what caused
// the bug this module exists to prevent.

const TURN_SOURCES = {
    TOUCH: 'touch',
    MOUSE: 'mouse',
    PROGRAMMATIC: 'programmatic'
};

// ALLOW  - nothing is in the way; start now.
// DEFER  - another turn owns these cubies but is on its way out. The request is
//          legitimate and must not be dropped; it waits for the hand-off.
// REJECT - the request cannot be honoured at all and the user should be told
//          why.
const TURN_VERDICTS = {
    ALLOW: 'allow',
    DEFER: 'defer',
    REJECT: 'reject'
};

const REJECT_REASONS = {
    SEQUENCE_RUNNING: 'sequence-running',
    USER_TURN_IN_PROGRESS: 'user-turn-in-progress'
};

const USER_SOURCES = [TURN_SOURCES.TOUCH, TURN_SOURCES.MOUSE];

function isUserSource(source) {
    return USER_SOURCES.indexOf(source) !== -1;
}

function allow() {
    return { allowed: true, verdict: TURN_VERDICTS.ALLOW, reason: null, message: null };
}

function defer(reason) {
    return { allowed: true, verdict: TURN_VERDICTS.DEFER, reason, message: null };
}

function reject(reason, message) {
    return { allowed: false, verdict: TURN_VERDICTS.REJECT, reason, message };
}

/**
 * Decide whether a turn may start.
 *
 * Returns a structured verdict rather than a boolean so the UI can explain a
 * refusal, and so new verdicts can be added without changing call sites.
 * `allowed` is false only for REJECT: a deferred turn is still going to
 * happen, just not this instant.
 *
 * @param {Object} request - { source } from TURN_SOURCES
 * @param {Object} world - what is currently turning:
 *   @param {string|null} world.liveTurnSource - source of the turn a user is
 *     actively dragging, or null
 *   @param {number} world.settlingTurns - turns easing toward their snap angle
 *   @param {boolean} world.programmaticTurn - a solve, scramble or step
 *     playback is running
 * @returns {{allowed: boolean, verdict: string, reason: string|null, message: string|null}}
 */
function evaluateTurnRequest(request, world) {
    const source = request && request.source;
    const liveTurnSource = (world && world.liveTurnSource) || null;
    const settlingTurns = (world && world.settlingTurns) || 0;
    const programmaticTurn = !!(world && world.programmaticTurn);

    if (source === TURN_SOURCES.PROGRAMMATIC) {
        // A sequence must not start on top of a turn the user is still making,
        // or one still easing to its snap angle - it would plan from a cube
        // position that is about to change. Sequences arbitrate among
        // themselves through their own animation state.
        if (liveTurnSource || settlingTurns > 0) {
            return reject(REJECT_REASONS.USER_TURN_IN_PROGRESS, 'Finish your turn first');
        }
        return allow();
    }

    if (!isUserSource(source)) {
        return allow();
    }

    // User input is never absorbed into a running sequence and never aborts one
    // implicitly. A stray finger should not derail a solve.
    if (programmaticTurn) {
        return reject(REJECT_REASONS.SEQUENCE_RUNNING, 'Busy — wait for the current moves');
    }

    // Another turn still owns these cubies. Let it finish its ease - preempting
    // it pops the face to 90 degrees, and refusing outright creates a dead zone
    // that swallows legitimate fast chained turns.
    if (settlingTurns > 0) {
        return defer(liveTurnSource === source ? 'own-turn-settling' : 'other-turn-settling');
    }

    if (liveTurnSource && liveTurnSource !== source) {
        return defer('other-input-live');
    }

    return allow();
}

const TurnArbiter = {
    TURN_SOURCES,
    TURN_VERDICTS,
    REJECT_REASONS,
    evaluateTurnRequest
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.TurnArbiter = TurnArbiter;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TurnArbiter;
}
