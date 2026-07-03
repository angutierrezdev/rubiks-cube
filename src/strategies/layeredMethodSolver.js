// Layered Method Solver
// Implements the beginner Layer-by-Layer method from docs/rubiks_3x3_solution.md:
// Daisy -> White Cross -> White Corners -> Middle Layer -> Yellow Cross ->
// Orient Yellow Corners -> Position Yellow Corners -> Position Yellow Edges.
//
// The solver is center-relative: it reads the current center positions and
// solves in that frame, so cubes scrambled with middle-slice moves work too.
// Case algorithms were derived and verified by search against CubeState
// (see tests/test-solver.js for the property test that guards them).

(function () {
    const Base = typeof SolverStrategy !== 'undefined'
        ? SolverStrategy
        : require('./solverStrategy.js').SolverStrategy;

    const vec = (x, y, z) => ({ x, y, z });
    const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
    const neg = (a) => vec(-a.x, -a.y, -a.z);
    const eq = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const cross = (a, b) => vec(
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    );
    const axisOf = (v) => (v.x !== 0 ? 'x' : v.y !== 0 ? 'y' : 'z');
    const signOf = (v) => v.x + v.y + v.z;

    const SIDE_LETTERS = ['F', 'R', 'B', 'L'];

    class LayeredEngine {
        constructor(state) {
            this.s = state;
            this.stages = [];
            this.cur = null;
            this.buildFrame();
        }

        buildFrame() {
            const d = this.s.findCenter('white');
            if (!d) throw new Error('No white center found');
            const D = vec(d.x, d.y, d.z);
            const U = neg(D);
            const sideCenter = this.s.cubies.find(c =>
                c.stickers.length === 1 &&
                dot(vec(c.x, c.y, c.z), D) === 0
            );
            const F = vec(sideCenter.x, sideCenter.y, sideCenter.z);
            const R = cross(U, F);
            this.frame = { U, D, F, R, B: neg(F), L: neg(R) };
        }

        makeFrame(localF) {
            const U = this.frame.U;
            const R = cross(U, localF);
            return { U, D: this.frame.D, F: localF, R, B: neg(localF), L: neg(R) };
        }

        begin(stageName) {
            this.cur = { stage: stageName, moves: [] };
            this.stages.push(this.cur);
        }

        /**
         * Applies an algorithm string of face letters (U D L R F B with ' and 2)
         * interpreted in the given frame (default: solver frame), recording moves.
         */
        alg(seq, frame = this.frame) {
            seq.trim().split(/\s+/).forEach(token => {
                const letter = token[0];
                const prime = token.includes("'");
                const twice = token.includes('2');
                const v = frame[letter];
                const layer = signOf(v);
                const direction = prime ? layer : -layer;
                const times = twice ? 2 : 1;
                for (let i = 0; i < times; i++) {
                    this.s.applyRotation(axisOf(v), layer, direction);
                    this.cur.moves.push({ name: token, axis: axisOf(v), layer, direction });
                }
            });
        }

        centerColor(letter, frame = this.frame) {
            const v = frame[letter];
            return this.s.getCenterColor(v.x, v.y, v.z);
        }

        posOf(cubie) {
            return vec(cubie.x, cubie.y, cubie.z);
        }

        stickerDir(cubie, color) {
            const st = cubie.stickers.find(t => t.color === color);
            return st ? vec(st.nx, st.ny, st.nz) : null;
        }

        /** Side letter (F/R/B/L) whose direction equals v, or null. */
        sideLetterOf(v) {
            return SIDE_LETTERS.find(l => eq(this.frame[l], v)) || null;
        }

        /**
         * Rotates U (emitting moves) until pred() is true. Tries k = 0..3
         * quarter turns on a simulation first; emits U' instead of U U U.
         */
        alignU(pred) {
            for (let k = 0; k <= 3; k++) {
                const sim = this.s.clone();
                const v = this.frame.U;
                for (let i = 0; i < k; i++) sim.applyRotation(axisOf(v), signOf(v), -signOf(v));
                const saved = this.s;
                this.s = sim;
                const ok = pred();
                this.s = saved;
                if (ok) {
                    if (k === 3) this.alg("U'");
                    else if (k === 2) this.alg('U2');
                    else if (k === 1) this.alg('U');
                    return true;
                }
            }
            return false;
        }

        whiteEdges() {
            return this.s.cubies.filter(c =>
                c.stickers.length === 2 && c.stickers.some(t => t.color === 'white')
            );
        }

        daisyCount() {
            return this.whiteEdges().filter(e => eq(this.stickerDir(e, 'white'), this.frame.U)).length;
        }

        /** True if a white edge with white facing U sits at U+side position. */
        daisySlotTaken(sideLetter) {
            const p = add(this.frame.U, this.frame[sideLetter]);
            const c = this.s.getCubieAt(p.x, p.y, p.z);
            if (!c || c.stickers.length !== 2) return false;
            const w = this.stickerDir(c, 'white');
            return w !== null && eq(w, this.frame.U);
        }

        // ---- Stage: Daisy (white edges around the yellow center) ----
        solveDaisy() {
            this.begin('Daisy');
            let guard = 0;
            while (this.daisyCount() < 4 && guard++ < 24) {
                const e = this.whiteEdges().find(c => !eq(this.stickerDir(c, 'white'), this.frame.U));
                const pos = this.posOf(e);
                const w = this.stickerDir(e, 'white');
                const uComp = dot(pos, this.frame.U);

                if (uComp === 1) {
                    // U layer, white facing a side: push into middle layer
                    const g = this.sideLetterOf(w);
                    this.alg(g);
                } else if (uComp === 0) {
                    // Middle layer: rotate the non-white-facing side face to lift it to U
                    const hDir = SIDE_LETTERS.map(l => this.frame[l])
                        .find(v => dot(pos, v) === 1 && !eq(v, w));
                    const h = this.sideLetterOf(hDir);
                    this.alignU(() => !this.daisySlotTaken(h));
                    // pick the quarter of h that lands the edge at U+h with white up
                    const target = add(this.frame.U, hDir);
                    for (const t of [h, h + "'"]) {
                        const sim = this.s.clone();
                        const v = this.frame[h];
                        const dir = t.includes("'") ? signOf(v) : -signOf(v);
                        sim.applyRotation(axisOf(v), signOf(v), dir);
                        const moved = sim.cubies.find(c =>
                            c.stickers.length === 2 &&
                            c.stickers.some(st => st.color === 'white') &&
                            c.stickers.map(st => st.color).sort().join() === e.stickers.map(st => st.color).sort().join()
                        );
                        if (eq(this.posOf(moved), target)) { this.alg(t); break; }
                    }
                } else {
                    // D layer
                    const gDir = SIDE_LETTERS.map(l => this.frame[l]).find(v => dot(pos, v) === 1);
                    const g = this.sideLetterOf(gDir);
                    this.alignU(() => !this.daisySlotTaken(g));
                    if (eq(w, this.frame.D)) {
                        this.alg(g + '2');
                    } else {
                        this.alg(g); // into middle layer; next iteration lifts it
                    }
                }
            }
            if (this.daisyCount() < 4) throw new Error('Daisy stage failed');
        }

        // ---- Stage: White Cross (drop daisy edges onto matching centers) ----
        solveWhiteCross() {
            this.begin('White Cross');
            for (let i = 0; i < 4; i++) {
                const e = this.whiteEdges().find(c => eq(this.stickerDir(c, 'white'), this.frame.U));
                if (!e) break;
                const colors = e.stickers.map(t => t.color);
                const side = colors.find(c => c !== 'white');
                const ok = this.alignU(() => {
                    const cur = this.s.findCubie(colors);
                    const sideDir = this.stickerDir(cur, side);
                    const letter = this.sideLetterOf(sideDir);
                    return letter !== null && this.centerColor(letter) === side;
                });
                if (!ok) throw new Error('White cross alignment failed');
                const cur = this.s.findCubie(colors);
                const letter = this.sideLetterOf(this.stickerDir(cur, side));
                this.alg(letter + '2');
            }
        }

        cornerSolved(colors, slotPos) {
            const c = this.s.findCubie(colors);
            return eq(this.posOf(c), slotPos) && eq(this.stickerDir(c, 'white'), this.frame.D);
        }

        // ---- Stage: White Corners ----
        solveWhiteCorners() {
            this.begin('White Corners');
            const slots = [];
            SIDE_LETTERS.forEach(f => {
                const fDir = this.frame[f];
                const gDir = cross(this.frame.U, fDir); // right neighbor of f
                const g = this.sideLetterOf(gDir);
                slots.push({
                    f, g, fDir, gDir,
                    pos: add(this.frame.D, add(fDir, gDir)),
                    colors: ['white', this.centerColor(f), this.centerColor(g)]
                });
            });

            for (const slot of slots) {
                let guard = 0;
                while (!this.cornerSolved(slot.colors, slot.pos) && guard++ < 6) {
                    const c = this.s.findCubie(slot.colors);
                    const pos = this.posOf(c);

                    if (dot(pos, this.frame.U) === -1) {
                        // In the D layer but not solved: pop it to U
                        const faces = SIDE_LETTERS.filter(l => dot(pos, this.frame[l]) === 1);
                        let done = false;
                        for (const p of faces) {
                            for (const t of [p, p + "'"]) {
                                const sim = this.s.clone();
                                const v = this.frame[p];
                                const dir = t.includes("'") ? signOf(v) : -signOf(v);
                                sim.applyRotation(axisOf(v), signOf(v), dir);
                                const moved = sim.findCubie(slot.colors);
                                if (dot(vec(moved.x, moved.y, moved.z), this.frame.U) === 1) {
                                    this.alg(t + ' U ' + (t.includes("'") ? p : p + "'"));
                                    done = true;
                                    break;
                                }
                            }
                            if (done) break;
                        }
                        continue;
                    }

                    // In U layer: bring above its slot
                    const above = add(this.frame.U, add(slot.fDir, slot.gDir));
                    this.alignU(() => eq(this.posOf(this.s.findCubie(slot.colors)), above));

                    // Local frame: R_local = cross(U, F_local) must hold for the slot pair
                    const localF = eq(cross(this.frame.U, slot.fDir), slot.gDir) ? slot.fDir : slot.gDir;
                    const lf = this.makeFrame(localF);
                    const w = this.stickerDir(this.s.findCubie(slot.colors), 'white');
                    if (eq(w, this.frame.U)) {
                        this.alg("R F R2 F' R'", lf);
                    } else if (eq(w, lf.F)) {
                        this.alg("F' U' F", lf);
                    } else {
                        this.alg("R U R'", lf);
                    }
                }
                if (!this.cornerSolved(slot.colors, slot.pos)) throw new Error('White corner stage failed');
            }
        }

        // ---- Stage: Middle Layer ----
        solveMiddleLayer() {
            this.begin('Middle Layer');
            const slots = SIDE_LETTERS.map(f => {
                const fDir = this.frame[f];
                const gDir = cross(this.frame.U, fDir);
                const g = this.sideLetterOf(gDir);
                return {
                    f, g, fDir, gDir,
                    pos: add(fDir, gDir),
                    colors: [this.centerColor(f), this.centerColor(g)]
                };
            });
            const edgeSolved = (slot) => {
                const e = this.s.findCubie(slot.colors);
                return eq(this.posOf(e), slot.pos) && eq(this.stickerDir(e, slot.colors[0]), slot.fDir);
            };

            for (const slot of slots) {
                let guard = 0;
                while (!edgeSolved(slot) && guard++ < 4) {
                    const e = this.s.findCubie(slot.colors);
                    const pos = this.posOf(e);

                    if (dot(pos, this.frame.U) === 0) {
                        // Stuck in the middle layer: eject via a right insert on its current slot
                        const own = slots.find(sl => eq(sl.pos, pos)) ||
                            slots.find(sl => eq(add(sl.fDir, sl.gDir), pos));
                        const lf = this.makeFrame(own.fDir);
                        this.alg("U R U' R' U' F' U F", lf);
                        continue;
                    }

                    // In U layer: align side sticker with its center
                    const sideColor = e.stickers.find(t => !eq(this.stickerDir(e, t.color), this.frame.U)).color;
                    const topColor = slot.colors.find(c => c !== sideColor);
                    this.alignU(() => {
                        const cur = this.s.findCubie(slot.colors);
                        const sd = this.stickerDir(cur, sideColor);
                        const letter = this.sideLetterOf(sd);
                        return letter !== null && this.centerColor(letter) === sideColor;
                    });
                    const cur = this.s.findCubie(slot.colors);
                    const faceDir = this.stickerDir(cur, sideColor);
                    const lf = this.makeFrame(faceDir);
                    const rightColor = this.s.getCenterColor(lf.R.x, lf.R.y, lf.R.z);
                    if (rightColor === topColor) {
                        this.alg("U R U' R' U' F' U F", lf);
                    } else {
                        this.alg("U' L' U L U F U' F'", lf);
                    }
                }
                if (!edgeSolved(slot)) throw new Error('Middle layer stage failed');
            }
        }

        yellowUpEdgeCount(state = this.s) {
            return SIDE_LETTERS.filter(l => {
                const p = add(this.frame.U, this.frame[l]);
                return state.getStickerColor(p.x, p.y, p.z, this.frame.U.x, this.frame.U.y, this.frame.U.z) === 'yellow';
            }).length;
        }

        // ---- Stage: Yellow Cross ----
        solveYellowCross() {
            if (this.yellowUpEdgeCount() === 4) return;
            this.begin('Yellow Cross');
            // BFS over (pre-AUF, F R U R' U' F') applications, depth <= 4
            const applySim = (state, k) => {
                const sim = state.clone();
                const u = this.frame.U;
                for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
                "F R U R' U' F'".split(/\s+/).forEach(token => {
                    const v = this.frame[token[0]];
                    const layer = signOf(v);
                    sim.applyRotation(axisOf(v), layer, token.includes("'") ? layer : -layer);
                });
                return sim;
            };
            let frontier = [{ state: this.s.clone(), path: [] }];
            let found = null;
            for (let depth = 0; depth < 4 && !found; depth++) {
                const next = [];
                for (const node of frontier) {
                    for (let k = 0; k < 4 && !found; k++) {
                        const sim = applySim(node.state, k);
                        const path = [...node.path, k];
                        if (this.yellowUpEdgeCount(sim) === 4) { found = path; break; }
                        next.push({ state: sim, path });
                    }
                    if (found) break;
                }
                frontier = next;
            }
            if (!found) throw new Error('Yellow cross stage failed');
            found.forEach(k => {
                if (k === 1) this.alg('U');
                else if (k === 2) this.alg('U2');
                else if (k === 3) this.alg("U'");
                this.alg("F R U R' U' F'");
            });
        }

        uCornerPositions() {
            return [
                add(this.frame.U, add(this.frame.F, this.frame.R)),
                add(this.frame.U, add(this.frame.R, this.frame.B)),
                add(this.frame.U, add(this.frame.B, this.frame.L)),
                add(this.frame.U, add(this.frame.L, this.frame.F))
            ];
        }

        // ---- Stage: Orient Yellow Corners ----
        orientYellowCorners() {
            const unoriented = () => this.uCornerPositions().filter(p => {
                return this.s.getStickerColor(p.x, p.y, p.z, this.frame.U.x, this.frame.U.y, this.frame.U.z) !== 'yellow';
            });
            if (unoriented().length === 0) return;
            this.begin('Orient Yellow Corners');
            const ufr = add(this.frame.U, add(this.frame.F, this.frame.R));
            let guard = 0;
            while (unoriented().length > 0 && guard++ < 10) {
                this.alignU(() => {
                    const c = this.s.getCubieAt(ufr.x, ufr.y, ufr.z);
                    const w = c.stickers.find(t => t.color === 'yellow');
                    return !(w.nx === this.frame.U.x && w.ny === this.frame.U.y && w.nz === this.frame.U.z);
                });
                let inner = 0;
                const yellowUpAtUFR = () => {
                    const c = this.s.getCubieAt(ufr.x, ufr.y, ufr.z);
                    const w = c.stickers.find(t => t.color === 'yellow');
                    return w.nx === this.frame.U.x && w.ny === this.frame.U.y && w.nz === this.frame.U.z;
                };
                while (!yellowUpAtUFR() && inner++ < 3) {
                    this.alg("R' D' R D R' D' R D");
                }
            }
            if (unoriented().length > 0) throw new Error('Orient yellow corners stage failed');
        }

        cornerAtHome(p) {
            const c = this.s.getCubieAt(p.x, p.y, p.z);
            const sideLetters = SIDE_LETTERS.filter(l => dot(p, this.frame[l]) === 1);
            const wanted = ['yellow', ...sideLetters.map(l => this.centerColor(l))].sort().join();
            return c.stickers.map(t => t.color).sort().join() === wanted;
        }

        /** Applies an alg string to a bare state (no recording) in a frame. */
        simAlg(state, seq, frame) {
            seq.trim().split(/\s+/).forEach(token => {
                const v = frame[token[0]];
                const layer = signOf(v);
                const direction = token.includes("'") ? layer : -layer;
                const times = token.includes('2') ? 2 : 1;
                for (let i = 0; i < times; i++) state.applyRotation(axisOf(v), layer, direction);
            });
        }

        /** Number of U turns (0-3) after which all U corners are home, or -1. */
        cornersHomeAfterAUF(state) {
            const u = this.frame.U;
            const sim = state.clone();
            for (let k = 0; k < 4; k++) {
                const saved = this.s;
                this.s = sim;
                const allHome = this.uCornerPositions().every(p => this.cornerAtHome(p));
                this.s = saved;
                if (allHome) return k;
                sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
            }
            return -1;
        }

        emitAUF(k) {
            if (k === 1) this.alg('U');
            else if (k === 2) this.alg('U2');
            else if (k === 3) this.alg("U'");
        }

        // ---- Stage: Position Yellow Corners ----
        // The corner permutation may be odd (single swap), which no 3-cycle can fix,
        // so the search combines the Aa-perm (3-cycle) with the T-perm (corner swap
        // + edge swap; edges are not solved yet, so that is allowed). BFS over
        // (pre-AUF, algorithm, frame) finds a plan of at most 3 algorithms.
        positionYellowCorners() {
            const ALGS = ["R' F R' B2 R F' R' B2 R2", "R U R' U' R' F R2 U' R' U' R U R' F'"];
            const finalK = this.cornersHomeAfterAUF(this.s);
            if (finalK === 0) return;
            this.begin('Position Yellow Corners');
            if (finalK > 0) {
                this.emitAUF(finalK);
                return;
            }

            const frames = SIDE_LETTERS.map(l => this.makeFrame(this.frame[l]));
            const u = this.frame.U;
            const ser = (st) => st.cubies.map(c =>
                `${c.x},${c.y},${c.z}:` + c.stickers.map(t => t.nx + '' + t.ny + t.nz + t.color).sort().join('|')
            ).join(';');

            let frontier = [{ state: this.s.clone(), path: [] }];
            const seen = new Set([ser(this.s)]);
            let plan = null;
            for (let depth = 0; depth < 3 && !plan; depth++) {
                const next = [];
                for (const node of frontier) {
                    for (let k = 0; k < 4 && !plan; k++) {
                        for (let a = 0; a < ALGS.length && !plan; a++) {
                            for (let f = 0; f < frames.length && !plan; f++) {
                                const sim = node.state.clone();
                                for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
                                this.simAlg(sim, ALGS[a], frames[f]);
                                const key = ser(sim);
                                if (seen.has(key)) continue;
                                seen.add(key);
                                const path = [...node.path, { k, a, f }];
                                const kk = this.cornersHomeAfterAUF(sim);
                                if (kk >= 0) plan = { path, finalAUF: kk };
                                else next.push({ state: sim, path });
                            }
                        }
                    }
                    if (plan) break;
                }
                frontier = next;
            }
            if (!plan) throw new Error('Position yellow corners stage failed');
            plan.path.forEach(step => {
                this.emitAUF(step.k);
                this.alg(ALGS[step.a], frames[step.f]);
            });
            this.emitAUF(plan.finalAUF);
        }

        // ---- Stage: Position Yellow Edges ----
        positionYellowEdges() {
            const correctEdges = () => SIDE_LETTERS.filter(l => {
                const p = add(this.frame.U, this.frame[l]);
                const c = this.s.getCubieAt(p.x, p.y, p.z);
                const side = c.stickers.find(t => t.color !== 'yellow');
                return eq(vec(side.nx, side.ny, side.nz), this.frame[l]) && side.color === this.centerColor(l);
            });
            if (correctEdges().length === 4) return;
            this.begin('Position Yellow Edges');
            let guard = 0;
            while (correctEdges().length < 4 && guard++ < 5) {
                const good = correctEdges();
                if (good.length === 0) {
                    this.alg("R U' R U R U R U' R' U' R2");
                    continue;
                }
                // Ua-perm keeps the UB edge fixed: point local B at the solved edge
                const lf = this.makeFrame(neg(this.frame[good[0]]));
                this.alg("R U' R U R U R U' R' U' R2", lf);
            }
            if (correctEdges().length < 4) throw new Error('Position yellow edges stage failed');
        }

        run() {
            this.solveDaisy();
            this.solveWhiteCross();
            this.solveWhiteCorners();
            this.solveMiddleLayer();
            this.solveYellowCross();
            this.orientYellowCorners();
            this.positionYellowCorners();
            this.positionYellowEdges();
            if (!this.s.isSolved()) throw new Error('Layered method finished without solving the cube');
            return this.stages.filter(st => st.moves.length > 0);
        }
    }

    class LayeredMethodSolver extends Base {
        getName() {
            return 'Layered Method';
        }

        solve(context) {
            if (!context.state) throw new Error('Cube state unavailable');
            if (context.state.isSolved()) return [];
            const engine = new LayeredEngine(context.state.clone());
            return engine.run();
        }
    }

    if (typeof window !== 'undefined') {
        window.LayeredMethodSolver = LayeredMethodSolver;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { LayeredMethodSolver, LayeredEngine };
    }
})();
