// Solver test harness — run with: node tests/test-solver.js
// Zero dependencies; exercises only the pure layer (CubeState + solver strategies).
// Exits non-zero on any failure so it can gate CI/deploys.

const { CubeState } = require('../src/core/cubeState.js');
const { RetraceSolver, SolverStrategy, canRetrace } = require('../src/strategies/solverStrategy.js');
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

// ---------- canRetrace guard ----------
console.log('canRetrace guard');
{
    // Intact history: every applied move was recorded
    const rng = mulberry32(11);
    const s = new CubeState();
    const history = randomScramble(s, 25, rng);
    check('intact history is retraceable', canRetrace(s, history));

    // Divergence: moves applied without recording (step-mode playback)
    const unrecorded = randomScramble(s, 5, rng);
    check('unrecorded moves break retraceability', !canRetrace(s, history));

    // Re-validation: undoing the unrecorded moves (step-mode rewind) repairs it
    [...unrecorded].reverse().forEach(m => s.applyRotation(m.axis, m.layer, -m.direction));
    check('rewinding unrecorded moves restores retraceability', canRetrace(s, history));

    // Empty history is consistent only with a solved cube
    check('empty history on a solved cube is retraceable', canRetrace(new CubeState(), []));
    const wiped = new CubeState();
    randomScramble(wiped, 10, rng);
    check('empty history on a scrambled cube is not retraceable', !canRetrace(wiped, []));

    // Step-mode capability flags drive the Steps button
    check('base strategy does not support steps', !new SolverStrategy().supportsSteps());
    check('RetraceSolver does not support steps', !new RetraceSolver().supportsSteps());
    check('LayeredMethodSolver supports steps', new LayeredMethodSolver().supportsSteps());
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

// ---------- StepSession engine (step-by-step solve mode) ----------
console.log('StepSession engine');
{
    const { StepSession, STEP_STAGES } = require('../src/core/stepSession.js');
    const STAGE_ORDER = ['Daisy', 'White Cross', 'White Corners', 'Middle Layer', 'Yellow Cross',
        'Orient Yellow Corners', 'Position Yellow Corners', 'Position Yellow Edges'];
    const serialize = st => JSON.stringify(st.cubies);

    const solver = new LayeredMethodSolver();
    const rng = mulberry32(99);
    const start = new CubeState();
    randomScramble(start, 20, rng);
    const startSnap = serialize(start);

    // Cycle 1 — fresh session
    const session = new StepSession(solver, start);
    const fresh = session.getStages();
    check('session exposes the 8 method stages in order',
        fresh.map(s => s.name).join('|') === STAGE_ORDER.join('|'));
    check('exported STEP_STAGES matches method order', STEP_STAGES.join('|') === STAGE_ORDER.join('|'));
    check('fresh session: all stages pending', fresh.every(s => s.status === 'pending'));
    check('fresh session: current step is 0', session.currentStep === 0);

    // The live mirror plays every plan, exactly as the on-screen cube would.
    const live = start.clone();
    const applyPlan = plan => plan.moves.forEach(m => live.applyMove(m));

    // Reference states: the one-shot full solution cut at stage boundaries.
    const refStages = solver.solve({ state: start.clone(), history: [] });
    const refAt = n => {
        const s = start.clone();
        refStages.forEach(st => {
            if (STAGE_ORDER.indexOf(st.stage) + 1 <= n) st.moves.forEach(m => s.applyMove(m));
        });
        return serialize(s);
    };

    // Cycle 2 — first forward jump
    const p1 = session.goTo(1);
    check('goTo(1) is a forward plan', p1.kind === 'forward');
    check('goTo(1) covers exactly stage 1', p1.stages.length === 1 && p1.stages[0].index === 1);
    applyPlan(p1);
    check('state after goTo(1) equals reference end-of-Daisy', serialize(live) === refAt(1));
    check('stage 1 becomes current', session.getStages()[0].status === 'current');
    check('current step is 1', session.currentStep === 1);

    // Cycle 3 — multi-stage jump
    const p3 = session.goTo(3);
    check('goTo(3) is a forward plan', p3.kind === 'forward');
    check('goTo(3) covers stages 2..3', p3.stages.map(s => s.index).join(',') === '2,3');
    applyPlan(p3);
    check('state after goTo(3) equals reference end-of-White-Corners', serialize(live) === refAt(3));
    const st3 = session.getStages();
    check('stages 1-2 done, 3 current, rest pending',
        st3[0].status === 'done' && st3[1].status === 'done' && st3[2].status === 'current' &&
        st3.slice(3).every(s => s.status === 'pending'));

    // Cycle 4 — pure rewind
    const back1 = session.goTo(1);
    check('goTo(1) from step 3 is a rewind plan', back1.kind === 'rewind');
    applyPlan(back1);
    check('rewind restores exact end-of-Daisy state', serialize(live) === refAt(1));
    check('current step back to 1', session.currentStep === 1);
    const same = session.goTo(1);
    check('goTo(current step) with no changes is a no-op plan', same.kind === 'none' && same.moves.length === 0);
    const back0 = session.goTo(0);
    applyPlan(back0);
    check('goTo(0) restores the original scramble exactly', serialize(live) === startSnap);
    check('after full rewind all stages pending again',
        session.getStages().every(s => s.status === 'pending'));

    // Cycle 5 — rewind swallows the user's manual attempt
    applyPlan(session.goTo(1));
    randomScramble(live, 3, rng).forEach(m => session.recordManual(m));
    const redo = session.goTo(1);
    check('goTo(current step) after manual moves is a rewind', redo.kind === 'rewind');
    check('rewind plan undoes exactly the manual moves', redo.moves.length === 3);
    applyPlan(redo);
    check('manual attempt undone: state equals end-of-Daisy again', serialize(live) === refAt(1));

    // Cycle 6 — forward after manual moves recomputes from the current state
    randomScramble(live, 4, rng).forEach(m => session.recordManual(m));
    const p5 = session.goTo(5);
    check('dirty forward is a forward plan', p5.kind === 'forward');
    check('dirty forward re-plans all stages from 1', p5.stages.map(s => s.index).join(',') === '1,2,3,4,5');
    let snapAt2 = null;
    p5.stages.forEach(st => {
        st.moves.forEach(m => live.applyMove(m));
        if (st.index === 2) snapAt2 = serialize(live);
    });
    const oracle = solver.solve({ state: live.clone(), history: [] });
    check('solver oracle confirms stages 1-5 complete after dirty forward',
        oracle.every(st => STAGE_ORDER.indexOf(st.stage) + 1 > 5));
    const back2 = session.goTo(2);
    applyPlan(back2);
    check('rewind lands exactly on the rewritten stage-2 checkpoint', serialize(live) === snapAt2);

    // Cycle 7 — the user completes a stage entirely by hand (zero-move stage)
    const probe = solver.solve({ state: live.clone(), history: [] });
    const stage3Moves = (probe.find(st => st.stage === 'White Corners') || { moves: [] }).moves;
    stage3Moves.forEach(m => { live.applyMove(m); session.recordManual(m); });
    const p3b = session.goTo(3);
    check('stage solved by hand: forward plan with zero moves',
        p3b.kind === 'forward' && p3b.moves.length === 0);
    check('hand-solved stage counts as reached', session.currentStep === 3);
    const backAll = session.goTo(0);
    applyPlan(backAll);
    check('full rewind through manual play restores the scramble exactly', serialize(live) === startSnap);

    // Cycle 8 — preview and the full jump (Solve button semantics)
    const pv1 = session.preview();
    const pv2 = session.preview();
    check('preview covers all remaining stages', pv1.map(s => s.index).join(',') === '1,2,3,4,5,6,7,8');
    check('preview is repeatable (does not mutate the session)', JSON.stringify(pv1) === JSON.stringify(pv2));
    const p8 = session.goTo(8);
    check('goTo(8) plays exactly what preview promised',
        JSON.stringify(p8.moves) === JSON.stringify(pv1.flatMap(s => s.moves)));
    check('full solve stays under the move ceiling', p8.moves.length <= MOVE_CEILING);
    applyPlan(p8);
    check('goTo(8) solves the cube', live.isSolved());
    check('current step is 8 after full jump', session.currentStep === 8);
    const st8 = session.getStages();
    check('stages 1-7 done, 8 current after full jump',
        st8.slice(0, 7).every(s => s.status === 'done') && st8[7].status === 'current');
    check('preview at step 8 is empty', session.preview().length === 0);

    // Cycle 9 — invalidation (scramble/reset kills the session)
    session.invalidate();
    check('dead session is not alive', session.alive === false);
    let threw = false;
    try { session.goTo(1); } catch (e) { threw = true; }
    check('goTo on a dead session throws', threw);
    let manualThrew = false;
    try { session.recordManual({ axis: 'x', layer: 1, direction: -1 }); } catch (e) { manualThrew = true; }
    check('recordManual on a dead session is a safe no-op', !manualThrew);
}

// ---------- StepSession property test: random step walks ----------
const WALK_TRIALS = 100;
console.log(`StepSession property test: ${WALK_TRIALS} random step walks`);
{
    const { StepSession } = require('../src/core/stepSession.js');
    const serialize = st => JSON.stringify(st.cubies);
    const solver = new LayeredMethodSolver();
    let failures = 0;

    for (let seed = 1; seed <= WALK_TRIALS; seed++) {
        const rng = mulberry32(seed * 7919);
        const live = new CubeState();
        randomScramble(live, 15 + Math.floor(rng() * 20), rng);
        const session = new StepSession(solver, live);
        const snaps = { 0: serialize(live) };

        try {
            for (let op = 0; op < 10; op++) {
                if (rng() < 0.4) {
                    // the user fiddles with the cube by hand
                    randomScramble(live, 1 + Math.floor(rng() * 4), rng)
                        .forEach(m => session.recordManual(m));
                    continue;
                }
                const target = Math.floor(rng() * 9); // 0..8
                const prev = session.currentStep;
                const plan = session.goTo(target);
                if (plan.moves.length > MOVE_CEILING) {
                    throw new Error(`plan of ${plan.moves.length} moves exceeds ceiling`);
                }
                if (plan.kind === 'forward') {
                    plan.stages.forEach(st => {
                        st.moves.forEach(m => live.applyMove(m));
                        snaps[st.index] = serialize(live);
                    });
                } else {
                    plan.moves.forEach(m => live.applyMove(m));
                }
                if (session.currentStep !== target) {
                    throw new Error(`currentStep ${session.currentStep} after goTo(${target})`);
                }
                if (plan.kind === 'rewind' && serialize(live) !== snaps[target]) {
                    throw new Error(`rewind from ${prev} to ${target} missed its checkpoint`);
                }
            }
            const final = session.goTo(8);
            final.moves.forEach(m => live.applyMove(m));
            if (!live.isSolved()) throw new Error('walk did not end solved');
        } catch (err) {
            failures++;
            console.error(`  ✗ walk seed ${seed}: ${err.message}`);
        }
    }
    check(`all ${WALK_TRIALS} random step walks stay exact and end solved`, failures === 0, `${failures} failures`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
