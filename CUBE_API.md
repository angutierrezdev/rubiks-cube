# RubiksCube Class API Documentation

## Overview

The `RubiksCube` class provides a complete interface for managing a 3D Rubik's Cube simulation. It handles cube state, moves, animations, and solving algorithms independently of the rendering system.

## Installation

Include `cube.js` in your HTML before your main script:

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="cube.js"></script>
<script src="your-script.js"></script>
```

## Creating an Instance

```javascript
// Create a THREE.Group to hold the cube
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// Create the RubiksCube instance
const rubiksCube = new RubiksCube(cubeGroup);

// Initialize the cube
rubiksCube.initCube();
```

## Exported Constants

### CUBE_COLORS
Object containing standard Rubik's cube colors:
```javascript
{
    white: 0xffffff,   // Up (Y+)
    yellow: 0xffff00,  // Down (Y-)
    red: 0xff0000,     // Right (X+)
    orange: 0xff8c00,  // Left (X-)
    blue: 0x0000ff,    // Front (Z+)
    green: 0x00ff00    // Back (Z-)
}
```

### CUBE_MOVES
Object containing move definitions:
```javascript
{
    'R': { axis: 'x', layer: 1, direction: -1 },
    "R'": { axis: 'x', layer: 1, direction: 1 },
    'L': { axis: 'x', layer: -1, direction: 1 },
    // ... etc
}
```

### CUBE_TOTAL_SIZE
Number representing the size of each cubie including the gap (default: 1.05)

### CUBE_CUBIE_POSITION_TOLERANCE
Number for tolerance when determining face membership (default: 0.1)

## Public Methods

### initCube()
Initialize or reset the cube to its solved state.

```javascript
rubiksCube.initCube();
```

**Returns:** `void`

---

### getCubies()
Get an array of all cubie meshes.

```javascript
const cubies = rubiksCube.getCubies();
// Returns: Array<THREE.Mesh>
```

**Returns:** `Array<THREE.Mesh>` - Array of 27 cubie meshes

---

### getCubiesOnFace(axis, value)
Get all cubies on a specific face.

```javascript
const rightFaceCubies = rubiksCube.getCubiesOnFace('x', 1);
const topFaceCubies = rubiksCube.getCubiesOnFace('y', 1);
const frontFaceCubies = rubiksCube.getCubiesOnFace('z', 1);
```

**Parameters:**
- `axis` (string): 'x', 'y', or 'z'
- `value` (number): 1 or -1 (positive or negative side)

**Returns:** `Array<THREE.Mesh>` - Array of cubies on the specified face

---

### rotateFace(axis, layer, direction, record, callback)
Rotate a face of the cube with animation.

```javascript
// Rotate right face clockwise
rubiksCube.rotateFace('x', 1, -1, true, () => {
    console.log('Rotation complete!');
});

// Rotate top face counter-clockwise without recording
rubiksCube.rotateFace('y', 1, 1, false);
```

**Parameters:**
- `axis` (string): 'x', 'y', or 'z'
- `layer` (number): 1 or -1 (which face)
- `direction` (number): 1 or -1 (rotation direction)
- `record` (boolean, optional): Whether to record in move history (default: true)
- `callback` (function, optional): Called when animation completes

**Returns:** `void`

**Note:** If an animation is in progress, the move is queued automatically.

---

### executeMove(moveName, record, callback)
Execute a move using standard Rubik's cube notation.

```javascript
// Execute moves with standard notation
rubiksCube.executeMove('R');   // Right face clockwise
rubiksCube.executeMove("R'");  // Right face counter-clockwise
rubiksCube.executeMove('U', true, () => {
    console.log('Move complete!');
});
```

**Parameters:**
- `moveName` (string): Move notation (R, L, U, D, F, B or R', L', U', D', F', B')
- `record` (boolean, optional): Whether to record in move history (default: true)
- `callback` (function, optional): Called when animation completes

**Returns:** `void`

**Valid moves:** R, R', L, L', U, U', D, D', F, F', B, B'

---

### scramble(onComplete)
Scramble the cube with 20 random moves.

```javascript
rubiksCube.scramble(() => {
    console.log('Scrambling complete!');
    console.log('Ready to solve');
});
```

**Parameters:**
- `onComplete` (function, optional): Called when scrambling is complete

**Returns:** `void`

---

### solve(onComplete)
Solve the cube by reversing the move history.

```javascript
rubiksCube.solve((alreadySolved) => {
    if (alreadySolved) {
        console.log('Cube was already solved!');
    } else {
        console.log('Cube solved successfully!');
    }
});
```

**Parameters:**
- `onComplete` (function, optional): Called when solving is complete
  - Receives `alreadySolved` (boolean): true if there were no moves to reverse

**Returns:** `void`

**Note:** This only works if moves were recorded in history.

---

### reset()
Reset the cube to its solved state immediately (no animation).

```javascript
rubiksCube.reset();
```

**Returns:** `void`

**Note:** This is different from `initCube()` - it checks animation state first.

---

### getIsAnimating()
Check if the cube is currently animating.

```javascript
if (!rubiksCube.getIsAnimating()) {
    rubiksCube.scramble();
}
```

**Returns:** `boolean` - true if animating, false otherwise

---

### getAnimationQueueLength()
Get the number of queued animations.

```javascript
const queueLength = rubiksCube.getAnimationQueueLength();
console.log(`${queueLength} moves queued`);
```

**Returns:** `number` - Number of queued animations

---

### getCubieTypeAndNeighbors(clickedAxis, clickedLayer, cubiePos)
Determine cubie type and get neighboring faces (for corner handling).

```javascript
const cubiePos = cubie.position.clone();
const { cubieType, neighborFaces } = rubiksCube.getCubieTypeAndNeighbors('z', 1, cubiePos);
// cubieType: 'center', 'edge', or 'corner'
// neighborFaces: Array of {axis, layer} objects
```

**Parameters:**
- `clickedAxis` (string): 'x', 'y', or 'z'
- `clickedLayer` (number): 1 or -1
- `cubiePos` (THREE.Vector3): Position of the cubie

**Returns:** `Object`
- `cubieType` (string): 'center', 'edge', or 'corner'
- `neighborFaces` (Array): Array of {axis, layer} objects for adjacent faces

---

### selectCornerNeighborBySwipeDirection(neighborFaces, deltaX, deltaY)
Select which neighbor face to rotate for a corner cubie based on swipe direction.

```javascript
const selectedFace = rubiksCube.selectCornerNeighborBySwipeDirection(
    neighborFaces,
    50,  // horizontal swipe
    10   // vertical swipe
);
// Returns: {axis: 'y', layer: 1} for horizontal swipe
```

**Parameters:**
- `neighborFaces` (Array): Array of {axis, layer} objects
- `deltaX` (number): Horizontal swipe delta in pixels
- `deltaY` (number): Vertical swipe delta in pixels

**Returns:** `Object|null`
- Returns {axis, layer} object for the selected face
- Returns null if no neighbors available

**Logic:**
- Horizontal swipe (|deltaX| > |deltaY|): Selects Y-axis neighbor (top/bottom)
- Vertical swipe: Selects non-Y neighbor (side faces)

## Usage Examples

### Basic Setup
```javascript
// Create and initialize cube
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const rubiksCube = new RubiksCube(cubeGroup);
rubiksCube.initCube();
```

### Execute a Sequence of Moves
```javascript
// Execute multiple moves in sequence
const moves = ['R', 'U', "R'", "U'"];
let index = 0;

function executeNext() {
    if (index < moves.length) {
        rubiksCube.executeMove(moves[index], true, () => {
            index++;
            executeNext();
        });
    }
}

executeNext();
```

### Scramble and Solve Cycle
```javascript
function scrambleAndSolve() {
    console.log('Scrambling...');
    rubiksCube.scramble(() => {
        console.log('Scrambled! Waiting 2 seconds...');
        setTimeout(() => {
            console.log('Solving...');
            rubiksCube.solve(() => {
                console.log('Solved!');
            });
        }, 2000);
    });
}

scrambleAndSolve();
```

### Custom Move Sequence
```javascript
// Perform a specific algorithm
const algorithm = ['R', 'U', "R'", "U'", 'R', 'U', "R'", "U'"];

function performAlgorithm(moves, callback) {
    let i = 0;
    function next() {
        if (i < moves.length) {
            rubiksCube.executeMove(moves[i], true, () => {
                i++;
                next();
            });
        } else if (callback) {
            callback();
        }
    }
    next();
}

performAlgorithm(algorithm, () => {
    console.log('Algorithm complete!');
});
```

## Notes

- All rotation methods are asynchronous and use callbacks
- Animations are queued automatically if one is already in progress
- The cube uses Three.js for 3D representation but logic is independent
- Move history is maintained for solving
- Animation duration is 200ms per quarter turn
- The coordinate system follows Three.js conventions (Y-up, right-handed)

## Coordinate System

- **X-axis**: Red (positive) / Orange (negative)
- **Y-axis**: White (positive) / Yellow (negative)
- **Z-axis**: Blue (positive) / Green (negative)

## Dependencies

- **Three.js** (tested with v0.128.0)
  - THREE.Group
  - THREE.Mesh
  - THREE.BoxGeometry
  - THREE.MeshLambertMaterial
  - THREE.Vector3
  - THREE.Quaternion
