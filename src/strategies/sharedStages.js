// Shared solving-stage routines used by more than one method engine.
// Free functions over a SolverEngineBase instance (composition, not
// inheritance): the base stays pure infrastructure, engines stay
// method-specific, and the common stage logic lives here.
//
// - buildDaisy / dropCrossEdges: white cross via the daisy technique
//   (LBL's "Daisy" + "White Cross" stages; CFOP's "Cross" stage)
// - orientEdgesToCross: top-edge orientation via F R U R' U' F'
//   (LBL's "Yellow Cross" stage; CFOP's "Orient Edges" OLL stage)
// - positionUCorners: corner permutation via Aa-perm/T-perm BFS
//   (LBL's "Position Yellow Corners"; CFOP's "Permute Corners" PLL stage)
// - positionUEdges: edge permutation via Ua-perm cycling
//   (LBL's "Position Yellow Edges"; CFOP's "Permute Edges" PLL stage)

(function () {
    const engineExports = typeof SolverEngineBase !== 'undefined'
        ? { SolverVec, SIDE_LETTERS: SOLVER_SIDE_LETTERS }
        : require('./solverEngineBase.js');
    const { vec, add, neg, eq, dot, axisOf, signOf } = engineExports.SolverVec;
    const SIDE_LETTERS = engineExports.SIDE_LETTERS;

    function whiteEdges(engine) {
        return engine.s.cubies.filter(c =>
            c.stickers.length === 2 && c.stickers.some(t => t.color === 'white')
        );
    }

    function daisyCount(engine) {
        return whiteEdges(engine).filter(e => eq(engine.stickerDir(e, 'white'), engine.frame.U)).length;
    }

    /** True if a white edge with white facing U sits at U+side position. */
    function daisySlotTaken(engine, sideLetter) {
        const p = add(engine.frame.U, engine.frame[sideLetter]);
        const c = engine.s.getCubieAt(p.x, p.y, p.z);
        if (!c || c.stickers.length !== 2) return false;
        const w = engine.stickerDir(c, 'white');
        return w !== null && eq(w, engine.frame.U);
    }

    /** True when a white edge already sits correctly in the white cross. */
    function crossEdgeSolved(engine, e) {
        if (!eq(engine.stickerDir(e, 'white'), engine.frame.D)) return false;
        const side = e.stickers.find(t => t.color !== 'white').color;
        const letter = engine.sideLetterOf(engine.stickerDir(e, side));
        return letter !== null && engine.centerColor(letter) === side;
    }

    /** Brings white edges up around the yellow center (daisy). */
    function buildDaisy(engine) {
        // A finished white cross must not be popped back up into a daisy
        // (matters when solving resumes from a partially solved cube).
        if (whiteEdges(engine).every(e => crossEdgeSolved(engine, e))) return;
        let guard = 0;
        while (daisyCount(engine) < 4 && guard++ < 24) {
            const e = whiteEdges(engine).find(c => !eq(engine.stickerDir(c, 'white'), engine.frame.U));
            const pos = engine.posOf(e);
            const w = engine.stickerDir(e, 'white');
            const uComp = dot(pos, engine.frame.U);

            if (uComp === 1) {
                // U layer, white facing a side: push into middle layer
                const g = engine.sideLetterOf(w);
                engine.alg(g);
            } else if (uComp === 0) {
                // Middle layer: rotate the non-white-facing side face to lift it to U
                const hDir = SIDE_LETTERS.map(l => engine.frame[l])
                    .find(v => dot(pos, v) === 1 && !eq(v, w));
                const h = engine.sideLetterOf(hDir);
                engine.alignU(() => !daisySlotTaken(engine, h));
                // pick the quarter of h that lands the edge at U+h with white up
                const target = add(engine.frame.U, hDir);
                for (const t of [h, h + "'"]) {
                    const sim = engine.s.clone();
                    const v = engine.frame[h];
                    const dir = t.includes("'") ? signOf(v) : -signOf(v);
                    sim.applyRotation(axisOf(v), signOf(v), dir);
                    const moved = sim.cubies.find(c =>
                        c.stickers.length === 2 &&
                        c.stickers.some(st => st.color === 'white') &&
                        c.stickers.map(st => st.color).sort().join() === e.stickers.map(st => st.color).sort().join()
                    );
                    if (eq(engine.posOf(moved), target)) { engine.alg(t); break; }
                }
            } else {
                // D layer
                const gDir = SIDE_LETTERS.map(l => engine.frame[l]).find(v => dot(pos, v) === 1);
                const g = engine.sideLetterOf(gDir);
                engine.alignU(() => !daisySlotTaken(engine, g));
                if (eq(w, engine.frame.D)) {
                    engine.alg(g + '2');
                } else {
                    engine.alg(g); // into middle layer; next iteration lifts it
                }
            }
        }
        if (daisyCount(engine) < 4) throw new Error('Daisy stage failed');
    }

    /** Drops daisy edges onto their matching centers, completing the cross. */
    function dropCrossEdges(engine) {
        for (let i = 0; i < 4; i++) {
            const e = whiteEdges(engine).find(c => eq(engine.stickerDir(c, 'white'), engine.frame.U));
            if (!e) break;
            const colors = e.stickers.map(t => t.color);
            const side = colors.find(c => c !== 'white');
            const ok = engine.alignU(() => {
                const cur = engine.s.findCubie(colors);
                const sideDir = engine.stickerDir(cur, side);
                const letter = engine.sideLetterOf(sideDir);
                return letter !== null && engine.centerColor(letter) === side;
            });
            if (!ok) throw new Error('White cross alignment failed');
            const cur = engine.s.findCubie(colors);
            const letter = engine.sideLetterOf(engine.stickerDir(cur, side));
            engine.alg(letter + '2');
        }
    }

    function yellowUpEdgeCount(engine, state = engine.s) {
        return SIDE_LETTERS.filter(l => {
            const p = add(engine.frame.U, engine.frame[l]);
            return state.getStickerColor(p.x, p.y, p.z, engine.frame.U.x, engine.frame.U.y, engine.frame.U.z) === 'yellow';
        }).length;
    }

    /**
     * Orients top edges to a yellow cross (dot/L/line cases) by BFS over
     * (pre-AUF, F R U R' U' F') applications, depth <= 4.
     */
    function orientEdgesToCross(engine) {
        const applySim = (state, k) => {
            const sim = state.clone();
            const u = engine.frame.U;
            for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
            engine.simAlg(sim, "F R U R' U' F'", engine.frame);
            return sim;
        };
        let frontier = [{ state: engine.s.clone(), path: [] }];
        let found = null;
        for (let depth = 0; depth < 4 && !found; depth++) {
            const next = [];
            for (const node of frontier) {
                for (let k = 0; k < 4 && !found; k++) {
                    const sim = applySim(node.state, k);
                    const path = [...node.path, k];
                    if (yellowUpEdgeCount(engine, sim) === 4) { found = path; break; }
                    next.push({ state: sim, path });
                }
                if (found) break;
            }
            frontier = next;
        }
        if (!found) throw new Error('Edge orientation stage failed');
        found.forEach(k => {
            engine.emitAUF(k);
            engine.alg("F R U R' U' F'");
        });
    }

    function uCornerPositions(engine) {
        return [
            add(engine.frame.U, add(engine.frame.F, engine.frame.R)),
            add(engine.frame.U, add(engine.frame.R, engine.frame.B)),
            add(engine.frame.U, add(engine.frame.B, engine.frame.L)),
            add(engine.frame.U, add(engine.frame.L, engine.frame.F))
        ];
    }

    /** True when the corner at U-layer position p carries that slot's colors. */
    function cornerAtHome(engine, p) {
        const c = engine.s.getCubieAt(p.x, p.y, p.z);
        const sideLetters = SIDE_LETTERS.filter(l => dot(p, engine.frame[l]) === 1);
        const wanted = ['yellow', ...sideLetters.map(l => engine.centerColor(l))].sort().join();
        return c.stickers.map(t => t.color).sort().join() === wanted;
    }

    /** Number of U turns (0-3) after which all U corners are home, or -1. */
    function cornersHomeAfterAUF(engine, state) {
        const u = engine.frame.U;
        const sim = state.clone();
        for (let k = 0; k < 4; k++) {
            const saved = engine.s;
            engine.s = sim;
            const allHome = uCornerPositions(engine).every(p => cornerAtHome(engine, p));
            engine.s = saved;
            if (allHome) return k;
            sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
        }
        return -1;
    }

    /**
     * Permutes U-layer corners into their slots. The corner permutation may be
     * odd (single swap), which no 3-cycle can fix, so the search combines the
     * Aa-perm (3-cycle) with the T-perm (corner swap + edge swap; edges are
     * not solved yet, so that is allowed — corners must permute before edges).
     * BFS over (pre-AUF, algorithm, frame) finds a plan of at most 3 algorithms.
     */
    function positionUCorners(engine) {
        const ALGS = ["R' F R' B2 R F' R' B2 R2", "R U R' U' R' F R2 U' R' U' R U R' F'"];
        const finalK = cornersHomeAfterAUF(engine, engine.s);
        if (finalK > 0) {
            engine.emitAUF(finalK);
            return;
        }
        if (finalK === 0) return;

        const frames = SIDE_LETTERS.map(l => engine.makeFrame(engine.frame[l]));
        const u = engine.frame.U;
        const ser = (st) => st.cubies.map(c =>
            `${c.x},${c.y},${c.z}:` + c.stickers.map(t => t.nx + '' + t.ny + t.nz + t.color).sort().join('|')
        ).join(';');

        let frontier = [{ state: engine.s.clone(), path: [] }];
        const seen = new Set([ser(engine.s)]);
        let plan = null;
        for (let depth = 0; depth < 3 && !plan; depth++) {
            const next = [];
            for (const node of frontier) {
                for (let k = 0; k < 4 && !plan; k++) {
                    for (let a = 0; a < ALGS.length && !plan; a++) {
                        for (let f = 0; f < frames.length && !plan; f++) {
                            const sim = node.state.clone();
                            for (let i = 0; i < k; i++) sim.applyRotation(axisOf(u), signOf(u), -signOf(u));
                            engine.simAlg(sim, ALGS[a], frames[f]);
                            const key = ser(sim);
                            if (seen.has(key)) continue;
                            seen.add(key);
                            const path = [...node.path, { k, a, f }];
                            const kk = cornersHomeAfterAUF(engine, sim);
                            if (kk >= 0) plan = { path, finalAUF: kk };
                            else next.push({ state: sim, path });
                        }
                    }
                }
                if (plan) break;
            }
            frontier = next;
        }
        if (!plan) throw new Error('Corner permutation stage failed');
        plan.path.forEach(step => {
            engine.emitAUF(step.k);
            engine.alg(ALGS[step.a], frames[step.f]);
        });
        engine.emitAUF(plan.finalAUF);
    }

    /** Side letters whose U edge is fully solved (right place, right facing). */
    function correctUEdges(engine) {
        return SIDE_LETTERS.filter(l => {
            const p = add(engine.frame.U, engine.frame[l]);
            const c = engine.s.getCubieAt(p.x, p.y, p.z);
            const side = c.stickers.find(t => t.color !== 'yellow');
            return eq(vec(side.nx, side.ny, side.nz), engine.frame[l]) && side.color === engine.centerColor(l);
        });
    }

    /** Cycles U-layer edges into their slots with the Ua-perm. */
    function positionUEdges(engine) {
        let guard = 0;
        while (correctUEdges(engine).length < 4 && guard++ < 5) {
            const good = correctUEdges(engine);
            if (good.length === 0) {
                engine.alg("R U' R U R U R U' R' U' R2");
                continue;
            }
            // Ua-perm keeps the UB edge fixed: point local B at the solved edge
            const lf = engine.makeFrame(neg(engine.frame[good[0]]));
            engine.alg("R U' R U R U R U' R' U' R2", lf);
        }
        if (correctUEdges(engine).length < 4) throw new Error('Edge permutation stage failed');
    }

    const SharedStages = {
        buildDaisy, dropCrossEdges, crossEdgeSolved, whiteEdges,
        yellowUpEdgeCount, orientEdgesToCross,
        uCornerPositions, cornerAtHome, cornersHomeAfterAUF, positionUCorners,
        correctUEdges, positionUEdges
    };

    if (typeof window !== 'undefined') {
        window.SharedStages = SharedStages;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SharedStages;
    }
})();
