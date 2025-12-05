// Rubik's Cube Simulation
const container = document.getElementById('container');
const scrambleBtn = document.getElementById('scrambleBtn');
const solveBtn = document.getElementById('solveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const frontFaceColorEl = document.getElementById('front-face-color');
const frontFaceNameEl = document.getElementById('front-face-name');

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
directionalLight2.position.set(-5, -5, -5);
scene.add(directionalLight2);

// Cube colors (standard Rubik's cube colors)
const COLORS = {
    white: 0xffffff,   // Up (Y+)
    yellow: 0xffff00, // Down (Y-)
    red: 0xff0000,    // Right (X+)
    orange: 0xff8c00, // Left (X-)
    blue: 0x0000ff,   // Front (Z+)
    green: 0x00ff00,  // Back (Z-)
    black: 0x111111   // Internal faces
};

// Cube group and cubies
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

let cubies = [];
const cubeSize = 1;
const gap = 0.05;
const totalSize = cubeSize + gap;

// Move history for solving
let moveHistory = [];
let isAnimating = false;
let animationQueue = [];

// Create a single cubie at position (x, y, z)
function createCubie(x, y, z) {
    const geometry = new THREE.BoxGeometry(cubeSize * 0.95, cubeSize * 0.95, cubeSize * 0.95);
    
    // Determine face colors based on position
    const materials = [
        new THREE.MeshLambertMaterial({ color: x === 1 ? COLORS.red : COLORS.black }),    // Right (+X)
        new THREE.MeshLambertMaterial({ color: x === -1 ? COLORS.orange : COLORS.black }), // Left (-X)
        new THREE.MeshLambertMaterial({ color: y === 1 ? COLORS.white : COLORS.black }),   // Up (+Y)
        new THREE.MeshLambertMaterial({ color: y === -1 ? COLORS.yellow : COLORS.black }), // Down (-Y)
        new THREE.MeshLambertMaterial({ color: z === 1 ? COLORS.blue : COLORS.black }),    // Front (+Z)
        new THREE.MeshLambertMaterial({ color: z === -1 ? COLORS.green : COLORS.black })   // Back (-Z)
    ];

    const cubie = new THREE.Mesh(geometry, materials);
    cubie.position.set(x * totalSize, y * totalSize, z * totalSize);
    
    // Store logical position
    cubie.userData.logicalPos = { x, y, z };
    
    return cubie;
}

// Initialize the cube
function initCube() {
    // Clear existing cubies
    cubies.forEach(cubie => cubeGroup.remove(cubie));
    cubies = [];
    moveHistory = [];
    animationQueue = [];

    // Create 27 cubies (3x3x3)
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const cubie = createCubie(x, y, z);
                cubies.push(cubie);
                cubeGroup.add(cubie);
            }
        }
    }
    
    updateStatus('Ready');
}

// Get cubies on a specific face
function getCubiesOnFace(axis, value) {
    return cubies.filter(cubie => {
        const pos = cubie.position;
        const tolerance = 0.1;
        switch (axis) {
            case 'x': return Math.abs(pos.x - value * totalSize) < tolerance;
            case 'y': return Math.abs(pos.y - value * totalSize) < tolerance;
            case 'z': return Math.abs(pos.z - value * totalSize) < tolerance;
        }
        return false;
    });
}

// Rotate a face
function rotateFace(axis, layer, direction, record = true, callback = null) {
    if (isAnimating) {
        animationQueue.push({ axis, layer, direction, record, callback });
        return;
    }

    isAnimating = true;
    const faceCubies = getCubiesOnFace(axis, layer);
    
    // Create a temporary group for rotation as a child of cubeGroup
    // This ensures rotations work correctly even when cubeGroup is rotated by user
    const rotationGroup = new THREE.Group();
    cubeGroup.add(rotationGroup);
    
    // Add cubies to rotation group, preserving their local positions
    faceCubies.forEach(cubie => {
        const localPos = cubie.position.clone();
        cubeGroup.remove(cubie);
        rotationGroup.add(cubie);
        cubie.position.copy(localPos);
    });

    const angle = direction * Math.PI / 2;
    const duration = 200; // ms
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const currentAngle = angle * eased;
        
        switch (axis) {
            case 'x':
                rotationGroup.rotation.x = currentAngle;
                break;
            case 'y':
                rotationGroup.rotation.y = currentAngle;
                break;
            case 'z':
                rotationGroup.rotation.z = currentAngle;
                break;
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete - update cubie positions
            faceCubies.forEach(cubie => {
                // Get the cubie's position in cubeGroup's local space
                const pos = new THREE.Vector3();
                cubie.getWorldPosition(pos);
                cubeGroup.worldToLocal(pos);
                
                // Round to nearest grid position
                pos.x = Math.round(pos.x / totalSize) * totalSize;
                pos.y = Math.round(pos.y / totalSize) * totalSize;
                pos.z = Math.round(pos.z / totalSize) * totalSize;
                
                // Get the cubie's world quaternion before moving it
                const worldQuaternion = new THREE.Quaternion();
                cubie.getWorldQuaternion(worldQuaternion);
                
                // Move cubie back to cubeGroup
                rotationGroup.remove(cubie);
                cubeGroup.add(cubie);
                
                // Set position and rotation
                cubie.position.copy(pos);
                
                // Convert world quaternion to local quaternion relative to cubeGroup
                const cubeGroupWorldQuaternion = new THREE.Quaternion();
                cubeGroup.getWorldQuaternion(cubeGroupWorldQuaternion);
                const invertedQuaternion = cubeGroupWorldQuaternion.clone().invert();
                cubie.quaternion.copy(worldQuaternion).premultiply(invertedQuaternion);
            });
            
            cubeGroup.remove(rotationGroup);
            
            if (record) {
                moveHistory.push({ axis, layer, direction });
            }
            
            isAnimating = false;
            
            if (callback) {
                callback();
            }
            
            // Process queue
            if (animationQueue.length > 0) {
                const next = animationQueue.shift();
                rotateFace(next.axis, next.layer, next.direction, next.record, next.callback);
            }
        }
    }

    animate();
}

// Move definitions (standard notation)
const MOVES = {
    'R': { axis: 'x', layer: 1, direction: -1 },
    "R'": { axis: 'x', layer: 1, direction: 1 },
    'L': { axis: 'x', layer: -1, direction: 1 },
    "L'": { axis: 'x', layer: -1, direction: -1 },
    'U': { axis: 'y', layer: 1, direction: -1 },
    "U'": { axis: 'y', layer: 1, direction: 1 },
    'D': { axis: 'y', layer: -1, direction: 1 },
    "D'": { axis: 'y', layer: -1, direction: -1 },
    'F': { axis: 'z', layer: 1, direction: -1 },
    "F'": { axis: 'z', layer: 1, direction: 1 },
    'B': { axis: 'z', layer: -1, direction: 1 },
    "B'": { axis: 'z', layer: -1, direction: -1 }
};

// Execute a move by name
function executeMove(moveName, record = true, callback = null) {
    const move = MOVES[moveName];
    if (move) {
        rotateFace(move.axis, move.layer, move.direction, record, callback);
    }
}

// Scramble the cube
function scramble() {
    if (isAnimating || animationQueue.length > 0) return;
    
    moveHistory = [];
    const moveNames = Object.keys(MOVES).filter(m => !m.includes("'"));
    const scrambleMoves = [];
    
    // Generate 20 random moves
    for (let i = 0; i < 20; i++) {
        const randomMove = moveNames[Math.floor(Math.random() * moveNames.length)];
        // Randomly add prime or not (50% chance each)
        const move = Math.random() > 0.5 ? randomMove + "'" : randomMove;
        scrambleMoves.push(move);
    }
    
    updateStatus('Scrambling...');
    disableButtons();
    
    let index = 0;
    function doNextMove() {
        if (index < scrambleMoves.length) {
            const move = scrambleMoves[index];
            executeMove(move, true, () => {
                index++;
                doNextMove();
            });
        } else {
            updateStatus('Scrambled! Click Solve to auto-solve');
            enableButtons();
        }
    }
    
    doNextMove();
}

// Solve the cube (reverse the moves)
function solve() {
    if (isAnimating || animationQueue.length > 0) return;
    if (moveHistory.length === 0) {
        updateStatus('Cube is already solved!');
        return;
    }
    
    updateStatus('Solving...');
    disableButtons();
    
    // Reverse the move history
    const solveMoves = [...moveHistory].reverse();
    moveHistory = [];
    
    let index = 0;
    function doNextMove() {
        if (index < solveMoves.length) {
            const move = solveMoves[index];
            // Reverse the direction
            rotateFace(move.axis, move.layer, -move.direction, false, () => {
                index++;
                doNextMove();
            });
        } else {
            updateStatus('Solved! ✨');
            enableButtons();
        }
    }
    
    doNextMove();
}

// Reset the cube
function reset() {
    if (isAnimating || animationQueue.length > 0) return;
    initCube();
}

// UI helpers
function updateStatus(text) {
    statusEl.textContent = text;
}

function disableButtons() {
    scrambleBtn.disabled = true;
    solveBtn.disabled = true;
    resetBtn.disabled = true;
}

function enableButtons() {
    scrambleBtn.disabled = false;
    solveBtn.disabled = false;
    resetBtn.disabled = false;
}

// Event listeners
scrambleBtn.addEventListener('click', scramble);
solveBtn.addEventListener('click', solve);
resetBtn.addEventListener('click', reset);

// Mouse controls for rotating the view
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

container.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    
    cubeGroup.rotation.y += deltaX * 0.01;
    cubeGroup.rotation.x += deltaY * 0.01;
    
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

container.addEventListener('mouseup', () => {
    isDragging = false;
});

container.addEventListener('mouseleave', () => {
    isDragging = false;
});

// Touch controls for mobile
container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
});

container.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;
    
    cubeGroup.rotation.y += deltaX * 0.01;
    cubeGroup.rotation.x += deltaY * 0.01;
    
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});

container.addEventListener('touchend', () => {
    isDragging = false;
});

// Zoom with scroll
container.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.multiplyScalar(e.deltaY > 0 ? 1.05 : 0.95);
    // Clamp zoom
    const dist = camera.position.length();
    if (dist < 5) camera.position.normalize().multiplyScalar(5);
    if (dist > 20) camera.position.normalize().multiplyScalar(20);
}, { passive: false });

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

// Initialize and start
initCube();
render();

// Face color names and hex values for the indicator
const FACE_COLORS = {
    'white': { hex: '#ffffff', name: 'White' },
    'yellow': { hex: '#ffff00', name: 'Yellow' },
    'red': { hex: '#ff0000', name: 'Red' },
    'orange': { hex: '#ff8c00', name: 'Orange' },
    'blue': { hex: '#0000ff', name: 'Blue' },
    'green': { hex: '#00ff00', name: 'Green' }
};

// Helper to get inverse quaternion from cube rotation
function getCubeInverseQuaternion() {
    const rotation = cubeGroup.rotation;
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(rotation);
    return quaternion.invert();
}

// Helper to determine which face a transformed vector points to
function getFaceFromVector(vec) {
    const absX = Math.abs(vec.x);
    const absY = Math.abs(vec.y);
    const absZ = Math.abs(vec.z);
    
    if (absZ >= absX && absZ >= absY) {
        return { color: vec.z > 0 ? 'blue' : 'green', move: vec.z > 0 ? 'F' : 'B' };
    } else if (absX >= absY) {
        return { color: vec.x > 0 ? 'red' : 'orange', move: vec.x > 0 ? 'R' : 'L' };
    } else {
        return { color: vec.y > 0 ? 'white' : 'yellow', move: vec.y > 0 ? 'U' : 'D' };
    }
}

// Determine which face is currently facing front based on cube rotation
function getCurrentFrontFace() {
    const frontVector = new THREE.Vector3(0, 0, 1);
    frontVector.applyQuaternion(getCubeInverseQuaternion());
    return getFaceFromVector(frontVector).color;
}

// Update the front face indicator
function updateFrontFaceIndicator() {
    const face = getCurrentFrontFace();
    const faceInfo = FACE_COLORS[face];
    frontFaceColorEl.style.backgroundColor = faceInfo.hex;
    frontFaceNameEl.textContent = faceInfo.name;
}

// Call update on mouse/touch movements
container.addEventListener('mousemove', () => {
    if (isDragging) {
        updateFrontFaceIndicator();
    }
});

container.addEventListener('touchmove', () => {
    if (isDragging) {
        updateFrontFaceIndicator();
    }
});

// Get the current face orientation based on cube rotation
// Returns an object mapping relative directions to actual cube faces
function getCurrentFaceMapping() {
    const inverseQuaternion = getCubeInverseQuaternion();
    
    // Define the 6 direction vectors
    const directions = {
        front: new THREE.Vector3(0, 0, 1),
        back: new THREE.Vector3(0, 0, -1),
        right: new THREE.Vector3(1, 0, 0),
        left: new THREE.Vector3(-1, 0, 0),
        up: new THREE.Vector3(0, 1, 0),
        down: new THREE.Vector3(0, -1, 0)
    };
    
    // Transform each direction to find which original face is in that position
    const mapping = {};
    
    for (const [dir, vec] of Object.entries(directions)) {
        const transformed = vec.clone().applyQuaternion(inverseQuaternion);
        mapping[dir] = getFaceFromVector(transformed).move;
    }
    
    return mapping;
}

// Static mapping of keyboard keys to relative directions
const KEY_TO_RELATIVE = {
    'F': 'front',
    'B': 'back',
    'R': 'right',
    'L': 'left',
    'U': 'up',
    'D': 'down'
};

// Map keyboard input to actual move based on current orientation
function getOrientedMove(key, isPrime) {
    const mapping = getCurrentFaceMapping();
    const relativeDir = KEY_TO_RELATIVE[key];
    if (!relativeDir) return null;
    
    const actualFace = mapping[relativeDir];
    return isPrime ? actualFace + "'" : actualFace;
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const key = e.key.toUpperCase();
    const validMoves = ['R', 'U', 'D', 'L', 'F', 'B'];
    
    if (validMoves.includes(key)) {
        e.preventDefault();
        const moveName = getOrientedMove(key, e.shiftKey);
        if (moveName) {
            executeMove(moveName, true);
        }
    }
});

// Initialize the front face indicator
updateFrontFaceIndicator();
