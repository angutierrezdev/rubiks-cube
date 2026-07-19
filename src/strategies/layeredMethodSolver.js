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
    const engineExports = typeof SolverEngineBase !== 'undefined'
        ? { SolverEngineBase, SolverVec, SIDE_LETTERS: SOLVER_SIDE_LETTERS }
        : require('./solverEngineBase.js');
    const EngineBase = engineExports.SolverEngineBase;
    const { vec, add, neg, eq, dot, cross, axisOf, signOf } = engineExports.SolverVec;
    const SIDE_LETTERS = engineExports.SIDE_LETTERS;
    const Stages = typeof SharedStages !== 'undefined' ? SharedStages : require('./sharedStages.js');

    class LayeredEngine extends EngineBase {

        // ---- Stage: Daisy (white edges around the yellow center) ----
        solveDaisy() {
            this.begin('Daisy');
            Stages.buildDaisy(this);
        }

        // ---- Stage: White Cross (drop daisy edges onto matching centers) ----
        solveWhiteCross() {
            this.begin('White Cross');
            Stages.dropCrossEdges(this);
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

        // ---- Stage: Yellow Cross ----
        solveYellowCross() {
            if (Stages.yellowUpEdgeCount(this) === 4) return;
            this.begin('Yellow Cross');
            Stages.orientEdgesToCross(this);
        }

        // ---- Stage: Orient Yellow Corners ----
        orientYellowCorners() {
            const unoriented = () => Stages.uCornerPositions(this).filter(p => {
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

        // ---- Stage: Position Yellow Corners ----
        positionYellowCorners() {
            if (Stages.cornersHomeAfterAUF(this, this.s) === 0) return;
            this.begin('Position Yellow Corners');
            Stages.positionUCorners(this);
        }

        // ---- Stage: Position Yellow Edges ----
        positionYellowEdges() {
            if (Stages.correctUEdges(this).length === 4) return;
            this.begin('Position Yellow Edges');
            Stages.positionUEdges(this);
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

        supportsSteps() {
            return true;
        }

        getStageDefinitions() {
            return [
                { name: 'Daisy', goal: 'Bring the four white edges up around the yellow center, like the petals of a daisy.', algorithm: 'No fixed algorithm — move each white edge up case by case' },
                { name: 'White Cross', goal: 'Turn the top until each petal’s side color matches its center, then drop it with a double turn.', algorithm: 'U (align) + F2' },
                { name: 'White Corners', goal: 'Put each white corner above its slot (between its two matching centers) and insert it.', algorithm: "R U R'  ·  F' U' F  ·  R F R2 F' R'" },
                { name: 'Middle Layer', goal: 'Find top edges without white or yellow, match their side color to a center, and insert left or right.', algorithm: "U R U' R' U' F' U F (right)  ·  U' L' U L U F U' F' (left)" },
                { name: 'Yellow Cross', goal: 'Make a yellow cross on top: dot → L-shape → line → cross.', algorithm: "F R U R' U' F'" },
                { name: 'Orient Yellow Corners', goal: 'Twist each yellow corner at the front-right until yellow faces up, then turn U to bring the next one.', algorithm: "R' D' R D (repeat in pairs)" },
                { name: 'Position Yellow Corners', goal: 'Move the yellow corners to the slots matching their colors.', algorithm: "R' F R' B2 R F' R' B2 R2  ·  T-perm for a swap" },
                { name: 'Position Yellow Edges', goal: 'Cycle the last yellow edges into place. The cube ends solved!', algorithm: "R U' R U R U R U' R' U' R2" }
            ];
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
