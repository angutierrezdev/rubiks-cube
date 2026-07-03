// Solver test harness — run with: node tests/test-solver.js
// Zero dependencies; exercises only the pure layer (CubeState + solver strategies).
// Exits non-zero on any failure so it can gate CI/deploys.

const { CubeState } = require('../src/core/cubeState.js');
const { RetraceSolver, SolverStrategy } = require('../src/strategies/solverStrategy.js');
const { LayeredMethodSolver } = require('../src/strategies/layeredMethodSolver.js');

const MOVE_CEILING = 300;          // no single solution may exceed this
const PROPERTY_TRIALS = 500;

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

function randomScramble(state, length, rng, includeSlices = true) {
    const axes = ['x', 'y', 'z'];
    const layers = includeSlices ? [-1, 0, 1] : [-1, 1];
    const moves = [];
    for (let i = 0; i < length; i++) {
        const m = {
            axis: axes[Math.floor(rng() * 3)],
            layer: layers[Math.floor(rng() * layers.length)],
            direction: rng() > 0.5 ? 1 : -1
        };
        moves.push(m);
        state.applyMove(m);
    }
    return moves;
}

// Deterministic PRNG so failures are reproducible by seed
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function applySolution(state, stages) {
    const s = state.clone();
    let count = 0;
    stages.forEach(st => st.moves.forEach(m => { s.applyMove(m); count++; }));
    return { state: s, count };
}

// ---------- CubeState model ----------
console.log('CubeState model');
{
    const s = new CubeState();
    check('new cube is solved', s.isSolved());

    const r = s.clone();
    for (let i = 0; i < 4; i++) r.applyRotation('x', 1, -1);
    check('R applied 4x returns to solved', r.isSolved());

    const one = s.clone();
    one.applyRotation('x', 1, -1);
    check('R applied once is not solved', !one.isSolved());
    check('R carries FR edge sticker to UR facing up', one.getStickerColor(1, 1, 0, 0, 1, 0) === 'blue');

    const sl = s.clone();
    sl.applyRotation('y', 0, 1);
    check('slice move displaces a center', sl.getCenterColor(0, 0, 1) !== 'blue');
    check('slice move alone does not solve-break uniformity check', !sl.isSolved());

    const rng = mulberry32(42);
    const sc = s.clone();
    const hist = randomScramble(sc, 50, rng);
    check('50-move scramble is not solved', !sc.isSolved());
    [...hist].reverse().forEach(m => sc.applyRotation(m.axis, m.layer, -m.direction));
    check('inverse scramble restores solved', sc.isSolved());
}

// ---------- RetraceSolver ----------
console.log('RetraceSolver');
{
    const solver = new RetraceSolver();
    check('is a SolverStrategy', solver instanceof SolverStrategy);
    check('empty history yields no stages', solver.solve({ state: new CubeState(), history: [] }).length === 0);

    const rng = mulberry32(7);
    const s = new CubeState();
    const history = randomScramble(s, 30, rng);
    const stages = solver.solve({ state: s, history });
    const { state: done } = applySolution(s, stages);
    check('retracing recorded history solves the cube', done.isSolved());
    check('retrace emits one stage', stages.length === 1);
    check('retrace move count equals history length', stages[0].moves.length === 30);
}

// ---------- LayeredMethodSolver unit cases ----------
console.log('LayeredMethodSolver unit cases');
{
    const solver = new LayeredMethodSolver();

    check('solved cube yields empty solution', solver.solve({ state: new CubeState(), history: [] }).length === 0);

    // Single face turn
    const single = new CubeState();
    single.applyRotation('x', 1, -1);
    const singleStages = solver.solve({ state: single, history: [] });
    check('single R scramble is solved', applySolution(single, singleStages).state.isSolved());

    // Slice-only scramble (centers displaced) — solver must be center-relative
    const slices = new CubeState();
    slices.applyRotation('y', 0, 1);
    slices.applyRotation('x', 0, -1);
    slices.applyRotation('z', 0, 1);
    const sliceStages = solver.solve({ state: slices, history: [] });
    check('slice-only scramble (moved centers) is solved', applySolution(slices, sliceStages).state.isSolved());

    // Superflip-ish hard orientation case: checkerboard from double turns
    const checker = new CubeState();
    ['x', 'y', 'z'].forEach(axis => { checker.applyRotation(axis, 0, 1); checker.applyRotation(axis, 0, 1); });
    const checkerStages = solver.solve({ state: checker, history: [] });
    check('checkerboard pattern is solved', applySolution(checker, checkerStages).state.isSolved());

    // Last-layer parity case: T-perm-like state (odd corner + odd edge permutation)
    const tState = new CubeState();
    const T = [
        ['x', 1, -1], ['y', 1, -1], ['x', 1, 1], ['y', 1, 1], ['x', 1, 1], ['z', 1, -1],
        ['x', 1, -1], ['x', 1, -1], ['y', 1, 1], ['x', 1, 1], ['y', 1, 1],
        ['x', 1, -1], ['y', 1, -1], ['x', 1, 1], ['z', 1, 1]
    ];
    T.forEach(([a, l, d]) => tState.applyRotation(a, l, d));
    const tStages = solver.solve({ state: tState, history: [] });
    check('T-perm parity case is solved', applySolution(tState, tStages).state.isSolved());

    // Stage labels follow the documented method order
    const rng = mulberry32(1234);
    const labeled = new CubeState();
    randomScramble(labeled, 25, rng);
    const stages = solver.solve({ state: labeled, history: [] });
    const order = ['Daisy', 'White Cross', 'White Corners', 'Middle Layer', 'Yellow Cross',
        'Orient Yellow Corners', 'Position Yellow Corners', 'Position Yellow Edges'];
    const indices = stages.map(st => order.indexOf(st.stage));
    check('all stage labels are documented stages', indices.every(i => i >= 0));
    check('stages appear in method order', indices.every((v, i, a) => i === 0 || v > a[i - 1]));
}

// ---------- Property test ----------
console.log(`Property test: ${PROPERTY_TRIALS} random scrambles`);
{
    const solver = new LayeredMethodSolver();
    let worst = 0;
    let failures = 0;
    for (let seed = 1; seed <= PROPERTY_TRIALS; seed++) {
        const rng = mulberry32(seed);
        const s = new CubeState();
        randomScramble(s, 15 + Math.floor(rng() * 25), rng);
        try {
            const stages = solver.solve({ state: s, history: [] });
            const { state: done, count } = applySolution(s, stages);
            worst = Math.max(worst, count);
            if (!done.isSolved()) {
                failures++;
                console.error(`  ✗ seed ${seed}: solution did not solve the cube`);
            } else if (count > MOVE_CEILING) {
                failures++;
                console.error(`  ✗ seed ${seed}: ${count} moves exceeds ceiling ${MOVE_CEILING}`);
            }
        } catch (err) {
            failures++;
            console.error(`  ✗ seed ${seed}: threw "${err.message}"`);
        }
    }
    check(`all ${PROPERTY_TRIALS} scrambles solved within ${MOVE_CEILING} moves`, failures === 0, `${failures} failures`);
    console.log(`  worst-case solution length: ${worst} moves`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
