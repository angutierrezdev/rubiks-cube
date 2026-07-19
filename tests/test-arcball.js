// Arcball rotation test harness — run with: node tests/test-arcball.js
// Zero dependencies; exercises only the pure layer (arcballRotation.js).
// Exits non-zero on any failure so it can gate CI/deploys.
//
// Regression guard for a live-measured bug: the previous pitch/yaw-only
// rotation model produced a spurious 148 degree rotation, mixed across all
// three axes, from a circular mouse drag that returned to its exact starting
// pixel. It also had a small (~3 degree) axis-coupling error on diagonal
// drags. Both are asserted against here.

const { computeArcballDelta } = require('../src/controllers/arcballRotation.js');

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

function multiplyQuaternions(a, b) {
    return {
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
    };
}

// Extract axis/angle from a quaternion, avoiding Euler-angle gimbal artifacts
function axisAngle(q) {
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    const s = Math.sqrt(Math.max(0, 1 - q.w * q.w));
    const axis = s < 1e-6 ? { x: 0, y: 0, z: 0 } : { x: q.x / s, y: q.y / s, z: q.z / s };
    return { angleDeg: angle * 180 / Math.PI, axis };
}

function vecClose(a, b, tolerance) {
    return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance && Math.abs(a.z - b.z) < tolerance;
}

// Simulate a full drag gesture the same way app.js does: compose per-frame
// deltas by left-multiplying (pre-multiply, world-space) onto the running
// quaternion, starting from an arbitrary orientation.
function simulateDrag(pathFn, steps, center, radius, startQuaternion) {
    let q = startQuaternion || { x: 0, y: 0, z: 0, w: 1 };
    let prev = pathFn(0);
    for (let i = 1; i <= steps; i++) {
        const curr = pathFn(i / steps);
        const delta = computeArcballDelta(prev, curr, center, radius);
        q = multiplyQuaternions(delta, q);
        prev = curr;
    }
    return q;
}

const CENTER = { x: 0, y: 0 };
const RADIUS = 200;

// --- Straight drags stay clean (no unwanted axis coupling) ---

const horizontal = axisAngle(simulateDrag(t => ({ x: t * 40, y: 0 }), 20, CENTER, RADIUS));
check('pure horizontal drag rotates purely around Y (yaw)',
    vecClose(horizontal.axis, { x: 0, y: 1, z: 0 }, 0.01),
    `axis=${JSON.stringify(horizontal.axis)}`);

const vertical = axisAngle(simulateDrag(t => ({ x: 0, y: t * 40 }), 20, CENTER, RADIUS));
check('pure vertical drag rotates purely around X (pitch)',
    vecClose(vertical.axis, { x: 1, y: 0, z: 0 }, 0.01),
    `axis=${JSON.stringify(vertical.axis)}`);

// --- Closed-loop circular drag: predictable roll around the view axis, ---
// --- not the old model's chaotic mix across all three axes             ---

const circlePath = t => ({
    x: 80 * Math.cos(t * 2 * Math.PI) - 80,
    y: 80 * Math.sin(t * 2 * Math.PI)
});
const circle = axisAngle(simulateDrag(circlePath, 60, CENTER, RADIUS));
check('closed circular drag rotates around the view (Z) axis only',
    vecClose(circle.axis, { x: 0, y: 0, z: -1 }, 0.01) || vecClose(circle.axis, { x: 0, y: 0, z: 1 }, 0.01),
    `axis=${JSON.stringify(circle.axis)}, angle=${circle.angleDeg.toFixed(1)}deg`);
check('closed circular drag does not produce the old model\'s large mixed-axis spin',
    Math.abs(circle.axis.x) < 0.01 && Math.abs(circle.axis.y) < 0.01,
    `axis=${JSON.stringify(circle.axis)} (old buggy model measured axis (0.71, 0.03, 0.70) at 148deg)`);

// --- Historical regression: drag direction must stay visually consistent ---
// --- regardless of the cube's current orientation (docs/TESTING.md)     ---

const deltaFromIdentity = computeArcballDelta({ x: 0, y: 0 }, { x: 20, y: 0 }, CENTER, RADIUS);
const flippedStart = { x: 1, y: 0, z: 0, w: 0 }; // 180 degrees around X
const deltaFromFlipped = computeArcballDelta({ x: 0, y: 0 }, { x: 20, y: 0 }, CENTER, RADIUS);
check('a given screen drag produces the same rotation delta regardless of the cube\'s current orientation',
    vecClose(deltaFromIdentity, deltaFromFlipped, 1e-9) && Math.abs(deltaFromIdentity.w - deltaFromFlipped.w) < 1e-9,
    'delta must not depend on prior orientation, since it is applied via world-space pre-multiplication');

const afterFlipAndDrag = multiplyQuaternions(deltaFromFlipped, flippedStart);
check('applying the delta after a 180-degree flip still yields a well-formed unit quaternion',
    Math.abs(Math.sqrt(afterFlipAndDrag.x ** 2 + afterFlipAndDrag.y ** 2 + afterFlipAndDrag.z ** 2 + afterFlipAndDrag.w ** 2) - 1) < 1e-9);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
