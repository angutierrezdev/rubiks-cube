// Logical Cube State Module
// Pure JS model of the cube: 27 cubies with integer positions and sticker normals.
// This is the source of truth for solvers; the Three.js meshes are only a view.
// No DOM or Three.js dependencies so it can run headless under Node for tests.

const STATE_COLORS = {
    xPos: 'red',
    xNeg: 'orange',
    yPos: 'white',
    yNeg: 'yellow',
    zPos: 'blue',
    zNeg: 'green'
};

/**
 * Rotates an integer vector 90° * direction around an axis.
 * Matches the Three.js convention used by RubiksCube.rotateFace
 * (right-handed axes, angle = direction * PI/2).
 */
function rotateVec(v, axis, direction) {
    const d = direction;
    switch (axis) {
        case 'x': return { x: v.x, y: -d * v.z, z: d * v.y };
        case 'y': return { x: d * v.z, y: v.y, z: -d * v.x };
        case 'z': return { x: -d * v.y, y: d * v.x, z: v.z };
    }
    return v;
}

/**
 * CubeState - logical cube model.
 * Each cubie: { x, y, z, stickers: [{ nx, ny, nz, color }] }
 * Positions and normals use integer coordinates in {-1, 0, 1}.
 */
class CubeState {
    constructor() {
        this.reset();
    }

    reset() {
        this.cubies = [];
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    if (x === 0 && y === 0 && z === 0) continue;
                    const stickers = [];
                    if (x === 1) stickers.push({ nx: 1, ny: 0, nz: 0, color: STATE_COLORS.xPos });
                    if (x === -1) stickers.push({ nx: -1, ny: 0, nz: 0, color: STATE_COLORS.xNeg });
                    if (y === 1) stickers.push({ nx: 0, ny: 1, nz: 0, color: STATE_COLORS.yPos });
                    if (y === -1) stickers.push({ nx: 0, ny: -1, nz: 0, color: STATE_COLORS.yNeg });
                    if (z === 1) stickers.push({ nx: 0, ny: 0, nz: 1, color: STATE_COLORS.zPos });
                    if (z === -1) stickers.push({ nx: 0, ny: 0, nz: -1, color: STATE_COLORS.zNeg });
                    this.cubies.push({ x, y, z, stickers });
                }
            }
        }
    }

    clone() {
        const copy = new CubeState();
        copy.cubies = this.cubies.map(c => ({
            x: c.x, y: c.y, z: c.z,
            stickers: c.stickers.map(s => ({ nx: s.nx, ny: s.ny, nz: s.nz, color: s.color }))
        }));
        return copy;
    }

    /**
     * Applies a 90° * direction rotation of the given layer (-1, 0, 1) around an axis.
     * Same signature and conventions as RubiksCube.rotateFace / recordMove.
     */
    applyRotation(axis, layer, direction) {
        this.cubies.forEach(cubie => {
            if (cubie[axis] !== layer) return;
            const pos = rotateVec(cubie, axis, direction);
            cubie.x = pos.x;
            cubie.y = pos.y;
            cubie.z = pos.z;
            cubie.stickers.forEach(s => {
                const n = rotateVec({ x: s.nx, y: s.ny, z: s.nz }, axis, direction);
                s.nx = n.x;
                s.ny = n.y;
                s.nz = n.z;
            });
        });
    }

    applyMove(move) {
        this.applyRotation(move.axis, move.layer, move.direction);
    }

    getCubieAt(x, y, z) {
        return this.cubies.find(c => c.x === x && c.y === y && c.z === z) || null;
    }

    /**
     * Color of the sticker at position (x,y,z) facing direction (nx,ny,nz),
     * or null if there is no sticker on that side.
     */
    getStickerColor(x, y, z, nx, ny, nz) {
        const cubie = this.getCubieAt(x, y, z);
        if (!cubie) return null;
        const sticker = cubie.stickers.find(s => s.nx === nx && s.ny === ny && s.nz === nz);
        return sticker ? sticker.color : null;
    }

    /**
     * Finds the cubie whose sticker colors are exactly the given set.
     * E.g. findCubie(['white', 'red']) returns the white/red edge.
     */
    findCubie(colors) {
        const wanted = [...colors].sort().join(',');
        return this.cubies.find(c =>
            c.stickers.length === colors.length &&
            c.stickers.map(s => s.color).sort().join(',') === wanted
        ) || null;
    }

    /**
     * Direction vector { x, y, z } of the center piece with the given color.
     */
    findCenter(color) {
        const center = this.cubies.find(c => c.stickers.length === 1 && c.stickers[0].color === color);
        return center ? { x: center.x, y: center.y, z: center.z } : null;
    }

    /**
     * Color of the center piece facing direction (nx,ny,nz).
     */
    getCenterColor(nx, ny, nz) {
        return this.getStickerColor(nx, ny, nz, nx, ny, nz);
    }

    /**
     * True when every face shows a single uniform color (any orientation).
     */
    isSolved() {
        const dirs = [
            { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
            { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
        ];
        return dirs.every(d => {
            let faceColor = null;
            for (const cubie of this.cubies) {
                for (const s of cubie.stickers) {
                    if (s.nx !== d.x || s.ny !== d.y || s.nz !== d.z) continue;
                    if (faceColor === null) faceColor = s.color;
                    else if (s.color !== faceColor) return false;
                }
            }
            return true;
        });
    }
}

if (typeof window !== 'undefined') {
    window.CubeState = CubeState;
    window.rotateStateVec = rotateVec;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CubeState, rotateVec, STATE_COLORS };
}
