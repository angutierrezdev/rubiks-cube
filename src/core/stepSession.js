// Step-by-step solve session
// Pure planner for step mode: tracks how far through the solving method the
// cube is, and turns step selections into move plans. It never animates and
// never touches the live cube — callers apply the returned moves themselves
// and report the user's own turns via recordManual(). No DOM or Three.js
// dependencies so it can run headless under Node for tests.
//
// The stage list comes from the solver's own getStageDefinitions(), so any
// steppable SolverStrategy works, not just the layered method.
//
// goTo(n) -> { kind: 'forward' | 'rewind' | 'none',
//              moves: [{ name, axis, layer, direction }],
//              stages: [{ index, stage, moves }] }   (stages only on 'forward')

const stepNotation = (typeof module !== 'undefined' && module.exports)
    ? require('../strategies/solverStrategy.js').moveNotation
    : window.solverMoveNotation;

class StepSession {
    /**
     * @param solver a stage-emitting SolverStrategy with stage definitions
     * @param startState CubeState at session start (cloned, not retained)
     */
    constructor(solver, startState) {
        this.solver = solver;
        this.stageDefs = solver.getStageDefinitions();
        if (this.stageDefs.length === 0) {
            throw new Error(`${solver.getName()} does not define step stages`);
        }
        this.stageNames = this.stageDefs.map(d => d.name);
        this.shadow = startState.clone();
        this.ledger = [];            // every move applied since session start
        this.checkpoints = { 0: 0 }; // step index -> ledger length at end of that stage
        this.step = 0;               // 0 = scrambled start, 1..N = completed stage
        this.dirty = false;          // user turned faces since the last plan
        this.alive = true;           // scramble/reset invalidates the session
    }

    /** Marks the session dead; called when the cube is scrambled or reset. */
    invalidate() {
        this.alive = false;
    }

    /**
     * Reports a move the user made by hand. The session absorbs it so that
     * rewinds undo the attempt and forward jumps re-plan around it.
     */
    recordManual(move) {
        if (!this.alive) return;
        this.shadow.applyMove(move);
        this.ledger.push({ axis: move.axis, layer: move.layer, direction: move.direction });
        this.dirty = true;
    }

    get currentStep() {
        return this.step;
    }

    getStages() {
        return this.stageNames.map((name, i) => {
            const index = i + 1;
            const status = index === this.step ? 'current'
                : index < this.step ? 'done'
                : 'pending';
            return { index, name, status };
        });
    }

    /** Stage definition ({ name, goal, algorithm }) for a 1-based step index. */
    getStageDefinition(index) {
        return this.stageDefs[index - 1] || null;
    }

    get stageCount() {
        return this.stageNames.length;
    }

    /**
     * Remaining solution from the current state, stage-grouped, without
     * changing the session — what the instruction panel shows before a jump.
     */
    preview() {
        const solved = this.solver.solve({ state: this.shadow.clone(), history: [] });
        const movesByStage = {};
        solved.forEach(st => { movesByStage[st.stage] = st.moves; });
        const from = this.dirty ? 0 : this.step;
        const stages = [];
        for (let i = from + 1; i <= this.stageNames.length; i++) {
            const moves = (movesByStage[this.stageNames[i - 1]] || []).map(m => ({ ...m }));
            stages.push({ index: i, stage: this.stageNames[i - 1], moves });
        }
        return stages;
    }

    goTo(target) {
        if (!this.alive) throw new Error('Step session is no longer valid');
        if (!Number.isInteger(target) || target < 0 || target > this.stageNames.length) {
            throw new Error(`Invalid step: ${target}`);
        }
        if (target === this.step && !this.dirty) return { kind: 'none', moves: [], stages: [] };
        return target <= this.step ? this.rewindTo(target) : this.forwardTo(target);
    }

    /** Inverts the ledger suffix back to the target stage's checkpoint. */
    rewindTo(target) {
        const cut = this.checkpoints[target];
        const moves = this.ledger.slice(cut).reverse().map(m => ({
            name: stepNotation(m.axis, m.layer, -m.direction),
            axis: m.axis,
            layer: m.layer,
            direction: -m.direction
        }));
        moves.forEach(m => this.shadow.applyMove(m));
        this.ledger.length = cut;
        Object.keys(this.checkpoints).forEach(k => {
            if (Number(k) > target) delete this.checkpoints[k];
        });
        this.step = target;
        this.dirty = false;
        return { kind: 'rewind', moves, stages: [] };
    }

    /** Solves from the current shadow state and plays stages up to target. */
    forwardTo(target) {
        const solved = this.solver.solve({ state: this.shadow.clone(), history: [] });
        const movesByStage = {};
        solved.forEach(st => {
            if (!this.stageNames.includes(st.stage)) {
                throw new Error(`Solver emitted unknown stage: ${st.stage}`);
            }
            movesByStage[st.stage] = st.moves;
        });
        // Manual moves may have regressed earlier stages, so a dirty forward
        // re-plans from stage 1 (untouched stages simply come back empty).
        const from = this.dirty ? 0 : this.step;
        for (let i = 1; i <= from; i++) {
            if ((movesByStage[this.stageNames[i - 1]] || []).length > 0) {
                throw new Error(`Stage ${i} regressed without recorded moves`);
            }
        }

        const stages = [];
        const flat = [];
        for (let i = from + 1; i <= target; i++) {
            const moves = (movesByStage[this.stageNames[i - 1]] || []).map(m => ({ ...m }));
            moves.forEach(m => {
                this.shadow.applyMove(m);
                this.ledger.push({ axis: m.axis, layer: m.layer, direction: m.direction });
                flat.push(m);
            });
            this.checkpoints[i] = this.ledger.length;
            stages.push({ index: i, stage: this.stageNames[i - 1], moves });
        }
        this.step = target;
        this.dirty = false;
        return { kind: 'forward', moves: flat, stages };
    }
}

if (typeof window !== 'undefined') {
    window.StepSession = StepSession;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StepSession };
}
