// Arcball Rotation Module
// Pure rotation math for dragging the whole cube to orbit the view.
// Zero dependencies (no THREE.js) so it can be unit tested directly with
// `node tests/test-arcball.js` - the same pattern as src/core/cubeState.js.
//
// Replaces a pitch/yaw-only Euler composition (no roll axis) that, despite
// having no roll axis, still accumulated an uncontrolled roll-like drift when
// a drag path was diagonal or circular - a mathematical artifact of composing
// many small non-commuting rotations (SO(3) composition is non-abelian). A
// closed circular drag that returned to its exact starting pixel measured a
// spurious 148 degree rotation under the old model.
//
// This implements a Bell/Shoemake-style arcball: a screen point is projected
// onto a virtual sphere (using a hyperbolic sheet falloff past the sphere's
// edge so the mapping has no discontinuity at the edge), and each drag frame
// rotates by the angle between the previous and current sphere points. Small
// central drags feel like plain pitch/yaw; drags near the edge of the sphere
// naturally pick up roll (rotation around the view axis), which is what makes
// a circular drag behave like spinning a real ball instead of drifting.

/**
 * Project a 2D point (relative to the drag container's center) onto a
 * virtual arcball sphere.
 * @param {number} x - X offset from container center, in pixels
 * @param {number} y - Y offset from container center, in pixels
 * @param {number} radius - Virtual sphere radius, in pixels
 * @returns {{x: number, y: number, z: number}} Unit vector on the sphere
 */
function projectToSphere(x, y, radius) {
    const nx = x / radius;
    const ny = -y / radius;
    const distSq = nx * nx + ny * ny;

    let nz;
    if (distSq <= 0.5) {
        // Inside the sphere - project straight up onto its surface
        nz = Math.sqrt(1 - distSq);
    } else {
        // Outside the sphere - project onto a hyperbolic sheet so the
        // mapping stays smooth (no jump) as the drag crosses the sphere edge
        nz = 0.5 / Math.sqrt(distSq);
    }

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return { x: nx / len, y: ny / len, z: nz / len };
}

/**
 * Compute the incremental rotation for a single arcball drag step.
 * @param {{x: number, y: number}} prevScreenPos - Previous pointer position
 * @param {{x: number, y: number}} currScreenPos - Current pointer position
 * @param {{x: number, y: number}} center - Center of the drag container
 * @param {number} radius - Virtual sphere radius, in pixels
 * @returns {{x: number, y: number, z: number, w: number}} Incremental rotation quaternion to left-multiply onto the cube's quaternion
 */
function computeArcballDelta(prevScreenPos, currScreenPos, center, radius) {
    const p = projectToSphere(prevScreenPos.x - center.x, prevScreenPos.y - center.y, radius);
    const c = projectToSphere(currScreenPos.x - center.x, currScreenPos.y - center.y, radius);

    const axis = {
        x: p.y * c.z - p.z * c.y,
        y: p.z * c.x - p.x * c.z,
        z: p.x * c.y - p.y * c.x
    };
    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);

    if (axisLength < 1e-9) {
        return { x: 0, y: 0, z: 0, w: 1 };
    }

    axis.x /= axisLength;
    axis.y /= axisLength;
    axis.z /= axisLength;

    const dot = Math.min(1, Math.max(-1, p.x * c.x + p.y * c.y + p.z * c.z));
    const angle = Math.acos(dot);

    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(halfAngle) };
}

/**
 * Derive the virtual sphere radius from a container's dimensions.
 * @param {number} width - Container width, in pixels
 * @param {number} height - Container height, in pixels
 * @returns {number} Sphere radius, in pixels
 */
function getArcballRadius(width, height) {
    return Math.min(width, height) / 2;
}

const ArcballRotation = { computeArcballDelta, getArcballRadius, projectToSphere };

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ArcballRotation = ArcballRotation;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArcballRotation;
}
