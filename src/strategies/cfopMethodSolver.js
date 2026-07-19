// Beginner CFOP (2-Look) Solver
// Cross -> F2L -> Orient Edges -> Orient Corners -> Permute Corners -> Permute Edges.
//
// Cross, edge orientation, and both permutation stages are the shared routines
// in sharedStages.js (composition with the layered method). F2L uses a reduced
// beginner case set: a bounded search over insert triggers with pop-to-top
// fallbacks, guarded so unrecognized configurations fail fast instead of
// looping. Sune/Antisune coverage for Orient Corners was verified exhaustively
// against CubeState over all 27 legal corner-twist states (<= 2 applications
// always suffice); the property test in tests/test-solver.js guards all of it.

(function () {
    const Base = typeof SolverStrategy !== 'undefined'
        ? SolverStrategy
        : require('./solverStrategy.js').SolverStrategy;
    const engineExports = typeof SolverEngineBase !== 'undefined'
        ? { SolverEngineBase, SolverVec, SIDE_LETTERS: SOLVER_SIDE_LETTERS }
        : require('./solverEngineBase.js');
    const EngineBase = engineExports.SolverEngineBase;
    const { add, eq, dot, cross, axisOf, signOf } = engineExports.SolverVec;
    const SIDE_LETTERS = engineExports.SIDE_LETTERS;
    const Stages = typeof SharedStages !== 'undefined' ? SharedStages : require('./sharedStages.js');

    const SUNE = "R U R' U R U2 R'";
    const ANTISUNE = "R U2 R' U' R U' R'";

    // Insert triggers tried (with pre-AUFs) by the bounded F2L search,
    // in the slot's local frame (slot at the F/R intersection).
    const F2L_TRIGGERS = ["R U R'", "R U' R'", "R U2 R'", "F' U F", "F' U' F", "F' U2 F"];

    class CFOPEngine extends EngineBase {
        // ---- Stage: Cross ----
        solveCross() {
            this.begin('Cross');
            Stages.buildDaisy(this);
            Stages.dropCrossEdges(this);
        }

        // ---- Stage: F2L ----
        f2lSlots() {
            return SIDE_LETTERS.map(f => {
                const fDir = this.frame[f];
                const gDir = cross(this.frame.U, fDir); // right neighbor of f
                const g = this.sideLetterOf(gDir);
                return {
                    f, g, fDir, gDir,
                    cornerPos: add(this.frame.D, add(fDir, gDir)),
                    edgePos: add(fDir, gDir),
                    cornerColors: ['white', this.centerColor(f), this.centerColor(g)],
                    edgeColors: [this.centerColor(f), this.centerColor(g)]
                };
            });
        }

        pairSolved(slot) {
            const c = this.s.findCubie(slot.cornerColors);
            if (!eq(this.posOf(c), slot.cornerPos) || !eq(this.stickerDir(c, 'white'), this.frame.D)) return false;
            const e = this.s.findCubie(slot.edgeColors);
            return eq(this.posOf(e), slot.edgePos) && eq(this.stickerDir(e, slot.edgeColors[0]), slot.fDir);
        }

        /** Evaluates pred with this.s temporarily pointed at a bare state. */
        onState(state, pred) {
            const saved = this.s;
            this.s = state;
            const out = pred();
            this.s = saved;
            return out;
        }

        /** Cross intact + every already-solved pair still solved, on a state. */
        f2lInvariantsOk(state, solvedSlots) {
            return this.onState(state, () =>
                Stages.whiteEdges(this).every(e => Stages.crossEdgeSolved(this, e)) &&
                solvedSlots.every(sl => this.pairSolved(sl))
            );
        }

        /** Pops a D-layer corner up to U without disturbing solved pairs. */
        popCorner(slot) {
            const c = this.s.findCubie(slot.cornerColors);
            const pos = this.posOf(c);
            const faces = SIDE_LETTERS.filter(l => dot(pos, this.frame[l]) === 1);
            for (const p of faces) {
                for (const t of [p, p + "'"]) {
                    const sim = this.s.clone();
                    const v = this.frame[p];
                    const dir = t.includes("'") ? signOf(v) : -signOf(v);
                    sim.applyRotation(axisOf(v), signOf(v), dir);
                    const moved = sim.findCubie(slot.cornerColors);
                    if (dot(this.posOf(moved), this.frame.U) === 1) {
                        this.alg(t + ' U ' + (t.includes("'") ? p : p + "'"));
                        return;
                    }
                }
            }
        }

        /** Ejects a middle-layer edge up to U via a first-layer-safe insert. */
        ejectEdge(slot, slots) {
            const e = this.s.findCubie(slot.edgeColors);
            const pos = this.posOf(e);
            const own = slots.find(sl => eq(sl.edgePos, pos));
            const lf = this.makeFrame(own.fDir);
            this.alg("U R U' R' U' F' U F", lf);
        }

        /**
         * Bounded search over (pre-AUF, trigger) sequences in the slot's local
         * frame; applies and returns true on the first sequence that solves the
         * pair while keeping the cross and previously solved pairs intact.
         */
        searchInsert(slot, solvedSlots, maxDepth) {
            const lf = this.makeFrame(slot.fDir);
            const u = this.frame.U;
            let frontier = [{ state: this.s.clone(), path: [] }];
            for (let depth = 1; depth <= maxDepth; depth++) {
                const next = [];
                for (const node of frontier) {
                    for (let k = 0; k < 4; k++) {
                        for (const trig of F2L_TRIGGERS) {
                            const sim = node.state.clone();
                            for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
                            this.simAlg(sim, trig, lf);
                            const path = [...node.path, { k, trig }];
                            const solved = this.onState(sim, () => this.pairSolved(slot));
                            if (solved && this.f2lInvariantsOk(sim, solvedSlots)) {
                                path.forEach(step => {
                                    this.emitAUF(step.k);
                                    this.alg(step.trig, lf);
                                });
                                return true;
                            }
                            if (depth < maxDepth) next.push({ state: sim, path });
                        }
                    }
                }
                frontier = next;
            }
            return false;
        }

        solveF2L() {
            this.begin('F2L');
            const slots = this.f2lSlots();
            const solvedSlots = [];
            for (const slot of slots) {
                let guard = 0;
                while (!this.pairSolved(slot) && guard++ < 8) {
                    const c = this.s.findCubie(slot.cornerColors);
                    const cornerInU = dot(this.posOf(c), this.frame.U) === 1;
                    const cornerHome = eq(this.posOf(c), slot.cornerPos) && eq(this.stickerDir(c, 'white'), this.frame.D);
                    if (!cornerInU && !cornerHome) {
                        this.popCorner(slot);
                        continue;
                    }
                    const e = this.s.findCubie(slot.edgeColors);
                    const edgeInU = dot(this.posOf(e), this.frame.U) === 1;
                    if (!edgeInU && !this.pairSolved(slot)) {
                        const edgeHome = eq(this.posOf(e), slot.edgePos) && eq(this.stickerDir(e, slot.edgeColors[0]), slot.fDir);
                        if (!edgeHome || !cornerHome) {
                            this.ejectEdge(slot, slots);
                            continue;
                        }
                    }
                    if (this.searchInsert(slot, solvedSlots, 2)) continue;
                    if (this.searchInsert(slot, solvedSlots, 3)) continue;
                    // Unrecognized configuration: pop the slot's corner out and retry
                    this.alg("R U R'", this.makeFrame(slot.fDir));
                }
                if (!this.pairSolved(slot)) throw new Error('F2L stage failed');
                solvedSlots.push(slot);
            }
        }

        // ---- Stage: Orient Edges (OLL part 1) ----
        orientEdges() {
            if (Stages.yellowUpEdgeCount(this) === 4) return;
            this.begin('Orient Edges');
            Stages.orientEdgesToCross(this);
        }

        // ---- Stage: Orient Corners (OLL part 2) ----
        // BFS over (pre-AUF, Sune/Antisune): every legal corner-twist state
        // orients within 2 applications (verified exhaustively over all 27).
        uCornersOriented(state = this.s) {
            return Stages.uCornerPositions(this).every(p =>
                state.getStickerColor(p.x, p.y, p.z, this.frame.U.x, this.frame.U.y, this.frame.U.z) === 'yellow');
        }

        orientCorners() {
            if (this.uCornersOriented()) return;
            this.begin('Orient Corners');
            const u = this.frame.U;
            let frontier = [{ state: this.s.clone(), path: [] }];
            let plan = null;
            for (let depth = 0; depth < 2 && !plan; depth++) {
                const next = [];
                for (const node of frontier) {
                    for (let k = 0; k < 4 && !plan; k++) {
                        for (const A of [SUNE, ANTISUNE]) {
                            const sim = node.state.clone();
                            for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
                            this.simAlg(sim, A, this.frame);
                            const path = [...node.path, { k, A }];
                            if (this.uCornersOriented(sim)) { plan = path; break; }
                            next.push({ state: sim, path });
                        }
                    }
                    if (plan) break;
                }
                frontier = next;
            }
            if (!plan) throw new Error('Orient corners stage failed');
            plan.forEach(step => {
                this.emitAUF(step.k);
                this.alg(step.A);
            });
        }

        // ---- Stage: Permute Corners (PLL part 1) ----
        permuteCorners() {
            if (Stages.cornersHomeAfterAUF(this, this.s) === 0) return;
            this.begin('Permute Corners');
            Stages.positionUCorners(this);
        }

        // ---- Stage: Permute Edges (PLL part 2) ----
        permuteEdges() {
            if (Stages.correctUEdges(this).length === 4) return;
            this.begin('Permute Edges');
            Stages.positionUEdges(this);
        }

        run() {
            this.solveCross();
            this.solveF2L();
            this.orientEdges();
            this.orientCorners();
            this.permuteCorners();
            this.permuteEdges();
            if (!this.s.isSolved()) throw new Error('CFOP method finished without solving the cube');
            return this.stages.filter(st => st.moves.length > 0);
        }
    }

    class CFOPMethodSolver extends Base {
        getName() {
            return 'Beginner CFOP (2-Look)';
        }

        supportsSteps() {
            return true;
        }

        getStageDefinitions() {
            return [
                { name: 'Cross', goal: 'Solve the white cross in one step: form the daisy, then drop each edge onto its matching center.', algorithm: 'Daisy + U (align) + F2 per edge' },
                { name: 'F2L', goal: 'Pair each white corner with its matching middle edge and insert them together into their slot.', algorithm: "R U R'  ·  F' U F  + pairing setups" },
                { name: 'Orient Edges', goal: 'Make the yellow cross on top: dot → L-shape → line → cross.', algorithm: "F R U R' U' F'" },
                { name: 'Orient Corners', goal: 'Turn the whole top face yellow with Sune and Antisune.', algorithm: "R U R' U R U2 R'  ·  R U2 R' U' R U' R'" },
                { name: 'Permute Corners', goal: 'Move the yellow corners to the slots matching their colors.', algorithm: "R' F R' B2 R F' R' B2 R2  ·  T-perm for a swap" },
                { name: 'Permute Edges', goal: 'Cycle the last yellow edges into place. The cube ends solved!', algorithm: "R U' R U R U R U' R' U' R2" }
            ];
        }

        solve(context) {
            if (!context.state) throw new Error('Cube state unavailable');
            if (context.state.isSolved()) return [];
            const engine = new CFOPEngine(context.state.clone());
            return engine.run();
        }
    }

    if (typeof window !== 'undefined') {
        window.CFOPMethodSolver = CFOPMethodSolver;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CFOPMethodSolver, CFOPEngine };
    }
})();
