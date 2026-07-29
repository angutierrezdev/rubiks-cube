// Turn arbiter test harness — run with: node tests/test-turn-arbiter.js
// Zero dependencies; exercises only the pure policy layer (turnArbiter.js).
// Exits non-zero on any failure so it can gate CI/deploys.
//
// Regression guard for a live-measured bug: two fingers turning faces at once
// orphaned cubies out of the scene graph and recorded moves for the wrong
// face, because each rotation path guarded itself — and the touch path did not
// guard at all. Every path now asks this module, so the matrix below is the
// whole concurrency policy in one place.

const {
    TURN_SOURCES,
    TURN_VERDICTS,
    REJECT_REASONS,
    evaluateTurnRequest
} = require('../src/controllers/turnArbiter.js');

let passed = 0;
let failed = 0;

function check(label, cond, detail = '') {
    if (cond) {
        passed++;
    } else {
        failed++;
        console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    }
}

const IDLE = { liveTurnSource: null, settlingTurns: 0, programmaticTurn: false };
const world = overrides => Object.assign({}, IDLE, overrides);
const ask = (source, overrides) => evaluateTurnRequest({ source }, world(overrides || {}));

function expectVerdict(label, verdict, expected) {
    check(label, verdict.verdict === expected, `got "${verdict.verdict}", expected "${expected}"`);
}

console.log('\nTurn arbiter policy\n');

// ---- Idle cube: everything may start ----
console.log('Idle cube');
[TURN_SOURCES.TOUCH, TURN_SOURCES.MOUSE, TURN_SOURCES.PROGRAMMATIC].forEach(source => {
    const v = ask(source);
    expectVerdict(`${source} on an idle cube allows`, v, TURN_VERDICTS.ALLOW);
    check(`${source} on an idle cube is allowed`, v.allowed === true);
    check(`${source} on an idle cube gives no message`, v.message === null);
});

// ---- User input against a turn that is settling: defer, never drop ----
console.log('A turn is easing to its snap angle');
expectVerdict('touch during a settling touch turn defers',
    ask(TURN_SOURCES.TOUCH, { settlingTurns: 1, liveTurnSource: null }), TURN_VERDICTS.DEFER);
expectVerdict('touch during a settling mouse turn defers',
    ask(TURN_SOURCES.TOUCH, { settlingTurns: 1 }), TURN_VERDICTS.DEFER);
expectVerdict('mouse during a settling turn defers',
    ask(TURN_SOURCES.MOUSE, { settlingTurns: 1 }), TURN_VERDICTS.DEFER);
expectVerdict('touch with several turns settling defers',
    ask(TURN_SOURCES.TOUCH, { settlingTurns: 3 }), TURN_VERDICTS.DEFER);

// A deferred turn is still going to happen — call sites must not treat it as a
// refusal and silently drop the gesture.
check('a deferred turn is not refused',
    ask(TURN_SOURCES.TOUCH, { settlingTurns: 1 }).allowed === true);
check('a deferred turn carries a reason',
    typeof ask(TURN_SOURCES.TOUCH, { settlingTurns: 1 }).reason === 'string');

// ---- User input against another live user gesture: defer ----
console.log('The other input device is mid-gesture');
expectVerdict('touch while a mouse drag is live defers',
    ask(TURN_SOURCES.TOUCH, { liveTurnSource: TURN_SOURCES.MOUSE }), TURN_VERDICTS.DEFER);
expectVerdict('mouse while a touch gesture is live defers',
    ask(TURN_SOURCES.MOUSE, { liveTurnSource: TURN_SOURCES.TOUCH }), TURN_VERDICTS.DEFER);

// Re-detecting the swiping finger mid-gesture goes through the same entry
// point, and must not be refused.
expectVerdict('touch while its own gesture is live allows',
    ask(TURN_SOURCES.TOUCH, { liveTurnSource: TURN_SOURCES.TOUCH }), TURN_VERDICTS.ALLOW);
expectVerdict('mouse while its own drag is live allows',
    ask(TURN_SOURCES.MOUSE, { liveTurnSource: TURN_SOURCES.MOUSE }), TURN_VERDICTS.ALLOW);

// ---- User input during a solve, scramble or step playback: reject ----
console.log('A solve, scramble or step playback is running');
[TURN_SOURCES.TOUCH, TURN_SOURCES.MOUSE].forEach(source => {
    const v = ask(source, { programmaticTurn: true });
    expectVerdict(`${source} during a sequence rejects`, v, TURN_VERDICTS.REJECT);
    check(`${source} during a sequence is not allowed`, v.allowed === false);
    check(`${source} during a sequence names the reason`,
        v.reason === REJECT_REASONS.SEQUENCE_RUNNING, `got "${v.reason}"`);
    check(`${source} during a sequence carries a message for the user`,
        typeof v.message === 'string' && v.message.length > 0);
});

// Rejection wins over deferral: a running sequence is not something to wait out.
expectVerdict('a running sequence outranks a settling turn',
    ask(TURN_SOURCES.TOUCH, { programmaticTurn: true, settlingTurns: 1 }), TURN_VERDICTS.REJECT);

// ---- Sequences against user turns: reject ----
console.log('A sequence wants to start');
[
    ['a live touch gesture', { liveTurnSource: TURN_SOURCES.TOUCH }],
    ['a live mouse drag', { liveTurnSource: TURN_SOURCES.MOUSE }],
    ['a settling turn', { settlingTurns: 1 }]
].forEach(([label, overrides]) => {
    const v = ask(TURN_SOURCES.PROGRAMMATIC, overrides);
    expectVerdict(`a sequence during ${label} rejects`, v, TURN_VERDICTS.REJECT);
    check(`a sequence during ${label} names the reason`,
        v.reason === REJECT_REASONS.USER_TURN_IN_PROGRESS, `got "${v.reason}"`);
});

// A sequence stepping through its own moves must not block itself — its moves
// arrive as programmatic requests while programmaticTurn is already true.
expectVerdict('a sequence does not block its own next move',
    ask(TURN_SOURCES.PROGRAMMATIC, { programmaticTurn: true }), TURN_VERDICTS.ALLOW);

// ---- Defensive shapes ----
console.log('Malformed input');
expectVerdict('an unknown source allows rather than wedging the cube',
    evaluateTurnRequest({ source: 'keyboard' }, IDLE), TURN_VERDICTS.ALLOW);
expectVerdict('a missing world is treated as idle',
    evaluateTurnRequest({ source: TURN_SOURCES.TOUCH }, undefined), TURN_VERDICTS.ALLOW);
expectVerdict('a missing request is treated as an unknown source',
    evaluateTurnRequest(undefined, IDLE), TURN_VERDICTS.ALLOW);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
