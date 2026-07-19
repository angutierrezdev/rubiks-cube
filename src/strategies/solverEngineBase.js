// Solver Engine Base
// Shared infrastructure for stage-emitting solver engines: 3D vector helpers,
// the solving frame, and move application/recording. Contains no method-specific
// stage logic — solvers extend this and add their own stages.
//
// Note: buildFrame() anchors the frame white-down (findCenter('white')), so this
// is a white-down frame engine, not a fully method-agnostic one. Both current
// methods (Layered, CFOP) solve white-first, so that is the shared convention.

(function () {
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

    class SolverEngineBase {
        /**
         * Color of the side center a solver built from this state treats as
         * Front — the same pick buildFrame() makes. Lets the UI tell the user
         * which face the solution's move letters are relative to.
         */
        static frontCenterColor(state) {
            const d = state.findCenter('white');
            if (!d) return null;
            const D = vec(d.x, d.y, d.z);
            const sideCenter = state.cubies.find(c =>
                c.stickers.length === 1 &&
                dot(vec(c.x, c.y, c.z), D) === 0
            );
            return sideCenter ? sideCenter.stickers[0].color : null;
        }

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

        emitAUF(k) {
            if (k === 1) this.alg('U');
            else if (k === 2) this.alg('U2');
            else if (k === 3) this.alg("U'");
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
    }

    const SolverVec = { vec, add, neg, eq, dot, cross, axisOf, signOf };

    if (typeof window !== 'undefined') {
        window.SolverEngineBase = SolverEngineBase;
        window.SolverVec = SolverVec;
        window.SOLVER_SIDE_LETTERS = SIDE_LETTERS;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SolverEngineBase, SolverVec, SIDE_LETTERS };
    }
})();
