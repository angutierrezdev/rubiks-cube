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

// Touch rotation constants
const CENTER_CUBIE_THRESHOLD = 0.01; // Distance threshold to consider a cubie on the rotation axis
const TANGENT_ALIGNMENT_THRESHOLD = 0.1; // Threshold for tangent vector magnitude
const TOUCH_ROTATION_SCALE = 2.0; // Converts world units to radians for touch rotation sensitivity
const MIN_SWIPE_THRESHOLD = 1; // Minimum pixels of movement to register as a swipe
const CUBIE_POSITION_TOLERANCE = 0.1; // Tolerance for determining cubie face membership

// Move history for solving
let moveHistory = [];

/**
 * Gets cubie type and neighbor faces for special corner rotation behavior.
 * 
 * @param {string} clickedAxis - The axis of the clicked face ('x', 'y', or 'z')
 * @param {number} clickedLayer - The layer of the clicked face (1 or -1)
 * @param {THREE.Vector3} cubiePos - The position of the cubie in cubeGroup's local space
 * @returns {{cubieType: string, neighborFaces: Array}} - Cubie type ('center', 'edge', 'corner') and array of neighbor faces
 * 
 * Behavior:
 * - Center cubies (1 outer face): rotate the clicked face (unchanged)
 * - Edge cubies (2 outer faces): rotate the clicked face (unchanged)
 * - Corner cubies (3 outer faces): rotate neighbor based on swipe direction (handled later)
 */
function getCubieTypeAndNeighbors(clickedAxis, clickedLayer, cubiePos) {
    // Determine all outer faces this cubie belongs to based on its position
    const faces = [];
    
    // Check Y faces
    if (Math.abs(cubiePos.y - totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'y', layer: 1 });
    }
    if (Math.abs(cubiePos.y + totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'y', layer: -1 });
    }
    // Check X faces
    if (Math.abs(cubiePos.x - totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'x', layer: 1 });
    }
    if (Math.abs(cubiePos.x + totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'x', layer: -1 });
    }
    // Check Z faces
    if (Math.abs(cubiePos.z - totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'z', layer: 1 });
    }
    if (Math.abs(cubiePos.z + totalSize) < CUBIE_POSITION_TOLERANCE) {
        faces.push({ axis: 'z', layer: -1 });
    }
    
    // Filter out the clicked face to get neighbor faces
    const neighborFaces = faces.filter(f => !(f.axis === clickedAxis && f.layer === clickedLayer));
    
    // Determine cubie type based on number of outer faces
    let cubieType;
    if (faces.length === 1) {
        cubieType = 'center';
    } else if (faces.length === 2) {
        cubieType = 'edge';
    } else {
        cubieType = 'corner';
    }
    
    return { cubieType, neighborFaces };
}

/**
 * Selects which neighbor face to rotate for a corner cubie based on swipe direction.
 * 
 * @param {Array} neighborFaces - Array of neighbor faces [{axis, layer}, ...]
 * @param {number} deltaX - Horizontal swipe delta in screen pixels
 * @param {number} deltaY - Vertical swipe delta in screen pixels
 * @returns {{axis: string, layer: number}|null} - The selected neighbor face to rotate, or null if no neighbors
 * 
 * Logic: 
 * - Horizontal swipe (|deltaX| > |deltaY|) → rotate the Y-axis neighbor (top/bottom)
 * - Vertical swipe (|deltaY| >= |deltaX|) → rotate the non-Y neighbor (left/right/front/back)
 */
function selectCornerNeighborBySwipeDirection(neighborFaces, deltaX, deltaY) {
    // Handle empty array case
    if (!neighborFaces || neighborFaces.length === 0) {
        return null;
    }
    
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    
    // For horizontal swipe: prefer Y-axis neighbor (top/bottom faces)
    // For vertical swipe: prefer non-Y neighbor (side faces)
    if (isHorizontalSwipe) {
        // Find Y-axis neighbor
        const yNeighbor = neighborFaces.find(f => f.axis === 'y');
        if (yNeighbor) return yNeighbor;
    } else {
        // Find non-Y neighbor (X or Z axis)
        const sideNeighbor = neighborFaces.find(f => f.axis !== 'y');
        if (sideNeighbor) return sideNeighbor;
    }
    
    // Fallback to first neighbor if preferred not found
    return neighborFaces[0];
}

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

// Solve the cube (reset to solved state)
// Note: This function now has the same effect as reset() but provides different UX feedback
// to distinguish between "solving" (from scrambled state) and "resetting" (fresh start)
function solve() {
    if (isAnimating || animationQueue.length > 0) return;
    
    updateStatus('Solving...');
    disableButtons();
    
    // Reset cube to solved state
    initCube();
    
    updateStatus('Solved! ✨');
    enableButtons();
}

// Reset the cube (instant reset to solved state)
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

// State for modifier key-based face rotation (Ctrl/Cmd to lock cube and swipe faces)
let modifierKeyState = {
    isLocked: false,            // Whether cube rotation is locked (modifier key held)
    activeFaceRotation: null,   // Current active face rotation state
    swipeStartPos: null,        // Starting position of swipe
    swipeInitialPos: null,      // Initial position for direction detection (corners)
    swipeStartFace: null,       // Face being swiped
    swipeAxis: null,            // Axis of rotation
    swipeLayer: null,           // Layer being rotated
    currentRotation: 0,         // Current rotation angle in radians
    rotationGroup: null,        // Temporary group for rotation
    highlightedCubie: null,     // Currently highlighted cubie
    originalMaterials: null,    // Original materials for restoration
    cornerRotationStarted: false, // Whether corner rotation has started (after direction detected)
    selectedAxis: null,         // Selected axis for corner rotation
    selectedLayer: null         // Selected layer for corner rotation
};

// Get face information from a mouse position (reuses logic from getFaceFromTouch)
function getFaceFromMouse(mouseEvent) {
    mouse.x = (mouseEvent.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(mouseEvent.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check intersection with all cubies
    const intersects = raycaster.intersectObjects(cubies, true);
    
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const cubie = intersect.object;
        
        // Get local normal (before transformation) for face index determination
        const localNormal = intersect.face.normal.clone();
        
        // Get the cubie's position in cubeGroup's local space
        const cubiePos = cubie.position.clone();
        
        // Transform the face normal to cubeGroup's local space
        const normalInCubeSpace = localNormal.clone();
        normalInCubeSpace.applyQuaternion(cubie.quaternion);
        
        // Determine which face of the cube was hit based on normal in cube's local space
        const absX = Math.abs(normalInCubeSpace.x);
        const absY = Math.abs(normalInCubeSpace.y);
        const absZ = Math.abs(normalInCubeSpace.z);
        
        let axis, layer;
        if (absX >= absY && absX >= absZ) {
            axis = 'x';
            layer = normalInCubeSpace.x > 0 ? 1 : -1;
        } else if (absY >= absZ) {
            axis = 'y';
            layer = normalInCubeSpace.y > 0 ? 1 : -1;
        } else {
            axis = 'z';
            layer = normalInCubeSpace.z > 0 ? 1 : -1;
        }
        
        // Check if this cubie is on the determined layer
        const faceCubies = getCubiesOnFace(axis, layer);
        if (faceCubies.includes(cubie)) {
            // Get cubie type and neighbors
            const { cubieType, neighborFaces } = getCubieTypeAndNeighbors(axis, layer, cubiePos);
            
            // Transform normal to world space for rotation calculations
            const worldNormal = intersect.face.normal.clone();
            worldNormal.transformDirection(cubie.matrixWorld);
            
            // Return face info with cubie type and neighbors for corner handling
            return { 
                axis, 
                layer, 
                cubie, 
                normal: localNormal, 
                worldNormal: worldNormal, 
                cubiePos: cubiePos,
                cubieType,
                neighborFaces
            };
        }
    }
    
    return null;
}

// Start face rotation for modifier key mode
function startModifierFaceRotation(axis, layer) {
    if (modifierKeyState.rotationGroup) {
        cubeGroup.remove(modifierKeyState.rotationGroup);
    }
    
    const faceCubies = getCubiesOnFace(axis, layer);
    modifierKeyState.rotationGroup = new THREE.Group();
    cubeGroup.add(modifierKeyState.rotationGroup);
    
    faceCubies.forEach(cubie => {
        const localPos = cubie.position.clone();
        cubeGroup.remove(cubie);
        modifierKeyState.rotationGroup.add(cubie);
        cubie.position.copy(localPos);
    });
    
    modifierKeyState.swipeAxis = axis;
    modifierKeyState.swipeLayer = layer;
    modifierKeyState.currentRotation = 0;
}

// Update face rotation during mouse drag (modifier key mode)
function updateModifierFaceRotation(deltaAngle) {
    if (!modifierKeyState.rotationGroup || modifierKeyState.swipeAxis === null) return;
    
    modifierKeyState.currentRotation += deltaAngle;
    
    switch (modifierKeyState.swipeAxis) {
        case 'x':
            modifierKeyState.rotationGroup.rotation.x = modifierKeyState.currentRotation;
            break;
        case 'y':
            modifierKeyState.rotationGroup.rotation.y = modifierKeyState.currentRotation;
            break;
        case 'z':
            modifierKeyState.rotationGroup.rotation.z = modifierKeyState.currentRotation;
            break;
    }
}

// Complete face rotation for modifier key mode - snap to nearest 90 degrees
function completeModifierFaceRotation() {
    if (!modifierKeyState.rotationGroup || modifierKeyState.swipeAxis === null) return;
    
    const currentAngle = modifierKeyState.currentRotation;
    const snapAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
    const remainingAngle = snapAngle - currentAngle;
    
    if (Math.abs(remainingAngle) < 0.01) {
        finalizeModifierFaceRotation(snapAngle);
    } else {
        const duration = 200;
        const startTime = Date.now();
        const startAngle = currentAngle;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const angle = startAngle + remainingAngle * eased;
            modifierKeyState.currentRotation = angle;
            
            switch (modifierKeyState.swipeAxis) {
                case 'x':
                    modifierKeyState.rotationGroup.rotation.x = angle;
                    break;
                case 'y':
                    modifierKeyState.rotationGroup.rotation.y = angle;
                    break;
                case 'z':
                    modifierKeyState.rotationGroup.rotation.z = angle;
                    break;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeModifierFaceRotation(snapAngle);
            }
        }
        
        animate();
    }
}

// Finalize the rotation for modifier key mode
function finalizeModifierFaceRotation(finalAngle) {
    if (!modifierKeyState.rotationGroup || modifierKeyState.swipeAxis === null) return;
    
    switch (modifierKeyState.swipeAxis) {
        case 'x':
            modifierKeyState.rotationGroup.rotation.x = finalAngle;
            break;
        case 'y':
            modifierKeyState.rotationGroup.rotation.y = finalAngle;
            break;
        case 'z':
            modifierKeyState.rotationGroup.rotation.z = finalAngle;
            break;
    }
    
    const faceCubies = [];
    modifierKeyState.rotationGroup.children.forEach(cubie => {
        faceCubies.push(cubie);
    });
    
    const quarterTurns = Math.round(finalAngle / (Math.PI / 2));
    
    faceCubies.forEach(cubie => {
        const pos = new THREE.Vector3();
        cubie.getWorldPosition(pos);
        cubeGroup.worldToLocal(pos);
        
        pos.x = Math.round(pos.x / totalSize) * totalSize;
        pos.y = Math.round(pos.y / totalSize) * totalSize;
        pos.z = Math.round(pos.z / totalSize) * totalSize;
        
        const worldQuaternion = new THREE.Quaternion();
        cubie.getWorldQuaternion(worldQuaternion);
        
        modifierKeyState.rotationGroup.remove(cubie);
        cubeGroup.add(cubie);
        
        cubie.position.copy(pos);
        
        const cubeGroupWorldQuaternion = new THREE.Quaternion();
        cubeGroup.getWorldQuaternion(cubeGroupWorldQuaternion);
        const invertedQuaternion = cubeGroupWorldQuaternion.clone().invert();
        cubie.quaternion.copy(worldQuaternion).premultiply(invertedQuaternion);
    });
    
    cubeGroup.remove(modifierKeyState.rotationGroup);
    modifierKeyState.rotationGroup = null;
    
    // Record the move
    const normalizedTurns = ((quarterTurns % 4) + 4) % 4;
    if (normalizedTurns === 1) {
        moveHistory.push({ 
            axis: modifierKeyState.swipeAxis, 
            layer: modifierKeyState.swipeLayer, 
            direction: 1 
        });
    } else if (normalizedTurns === 3) {
        moveHistory.push({ 
            axis: modifierKeyState.swipeAxis, 
            layer: modifierKeyState.swipeLayer, 
            direction: -1 
        });
    } else if (normalizedTurns === 2) {
        moveHistory.push({ 
            axis: modifierKeyState.swipeAxis, 
            layer: modifierKeyState.swipeLayer, 
            direction: 1 
        });
        moveHistory.push({ 
            axis: modifierKeyState.swipeAxis, 
            layer: modifierKeyState.swipeLayer, 
            direction: 1 
        });
    }
    
    modifierKeyState.swipeAxis = null;
    modifierKeyState.swipeLayer = null;
    modifierKeyState.currentRotation = 0;
}

// Highlight a cubie for modifier key mode
function highlightCubieForModifier(cubie, faceNormal) {
    removeModifierHighlight();
    
    if (!cubie) return;
    
    modifierKeyState.highlightedCubie = cubie;
    modifierKeyState.originalMaterials = [];
    
    const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
    
    let touchedFaceIndex = -1;
    if (faceNormal) {
        const absX = Math.abs(faceNormal.x);
        const absY = Math.abs(faceNormal.y);
        const absZ = Math.abs(faceNormal.z);
        
        if (absX >= absY && absX >= absZ) {
            touchedFaceIndex = faceNormal.x > 0 ? 0 : 1;
        } else if (absY >= absZ) {
            touchedFaceIndex = faceNormal.y > 0 ? 2 : 3;
        } else {
            touchedFaceIndex = faceNormal.z > 0 ? 4 : 5;
        }
    }
    
    materials.forEach((material, index) => {
        modifierKeyState.originalMaterials.push({
            color: material.color.clone(),
            emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
            emissiveIntensity: material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0
        });
        
        if (index === touchedFaceIndex) {
            const lightenedColor = new THREE.Color().lerpColors(
                material.color,
                new THREE.Color(0xffffff),
                0.15
            );
            material.color.copy(lightenedColor);
            
            if (!material.emissive) {
                material.emissive = new THREE.Color(0x000000);
            }
            material.emissive.setHex(0xffffff);
            material.emissiveIntensity = 0.4;
        } else {
            const dimmedColor = new THREE.Color().lerpColors(
                material.color,
                new THREE.Color(0x000000),
                0.3
            );
            material.color.copy(dimmedColor);
        }
        
        material.needsUpdate = true;
    });
    
    cubie.material.needsUpdate = true;
}

// Remove highlighting for modifier key mode
function removeModifierHighlight() {
    if (modifierKeyState.highlightedCubie && modifierKeyState.originalMaterials) {
        const cubie = modifierKeyState.highlightedCubie;
        const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
        
        materials.forEach((material, index) => {
            if (modifierKeyState.originalMaterials[index]) {
                const original = modifierKeyState.originalMaterials[index];
                material.color.copy(original.color);
                
                if (material.emissive) {
                    material.emissive.copy(original.emissive);
                    material.emissiveIntensity = original.emissiveIntensity;
                }
                
                material.needsUpdate = true;
            }
        });
        
        cubie.material.needsUpdate = true;
        modifierKeyState.highlightedCubie = null;
        modifierKeyState.originalMaterials = null;
    }
}

// Calculate rotation angle for modifier key mode using proper 3D geometry
function calculateModifierRotationAngle(deltaX, deltaY, axis, layer, cubiePos) {
    let rotationAxisLocal = new THREE.Vector3();
    if (axis === 'x') rotationAxisLocal.set(1, 0, 0);
    else if (axis === 'y') rotationAxisLocal.set(0, 1, 0);
    else rotationAxisLocal.set(0, 0, 1);
    
    const rotationAxisWorld = rotationAxisLocal.clone().transformDirection(cubeGroup.matrixWorld);
    
    const cubieWorldPos = cubiePos.clone();
    cubeGroup.localToWorld(cubieWorldPos);
    
    const screenPoint = cubieWorldPos.clone().project(camera);
    
    const screenPointMoved = new THREE.Vector3(
        screenPoint.x + (deltaX / window.innerWidth) * 2,
        screenPoint.y - (deltaY / window.innerHeight) * 2,
        screenPoint.z
    );
    
    const worldPoint = screenPoint.clone().unproject(camera);
    const worldPointMoved = screenPointMoved.clone().unproject(camera);
    
    const swipeVec = new THREE.Vector3().subVectors(worldPointMoved, worldPoint);
    
    const axisCenter = new THREE.Vector3();
    if (axis === 'x') axisCenter.set(layer * totalSize, 0, 0);
    else if (axis === 'y') axisCenter.set(0, layer * totalSize, 0);
    else axisCenter.set(0, 0, layer * totalSize);
    cubeGroup.localToWorld(axisCenter);
    
    const radiusVec = new THREE.Vector3().subVectors(cubieWorldPos, axisCenter);
    
    const radiusLength = radiusVec.length();
    let tangent;
    
    if (radiusLength < CENTER_CUBIE_THRESHOLD) {
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, cameraRight).normalize();
        if (tangent.length() < TANGENT_ALIGNMENT_THRESHOLD) {
            const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, cameraUp).normalize();
        }
    } else {
        tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, radiusVec).normalize();
    }
    
    const tangentComponent = swipeVec.dot(tangent);
    const angle = tangentComponent * TOUCH_ROTATION_SCALE;
    
    return angle;
}

container.addEventListener('mousedown', (e) => {
    // Check if modifier key (Ctrl or Cmd/Meta) is held
    if (e.ctrlKey || e.metaKey) {
        // Modifier key held - enable face rotation mode
        modifierKeyState.isLocked = true;
        isDragging = false;
        
        // Detect which face is being clicked
        const faceInfo = getFaceFromMouse(e);
        if (faceInfo) {
            modifierKeyState.swipeStartFace = faceInfo;
            modifierKeyState.swipeStartPos = { x: e.clientX, y: e.clientY };
            modifierKeyState.swipeInitialPos = { x: e.clientX, y: e.clientY };
            highlightCubieForModifier(faceInfo.cubie, faceInfo.normal);
            
            // For corner cubies, delay rotation start until swipe direction is known
            if (faceInfo.cubieType === 'corner') {
                modifierKeyState.cornerRotationStarted = false;
                // Don't start rotation yet - wait for first move
            } else {
                // For center and edge cubies, start rotation immediately with clicked face
                modifierKeyState.cornerRotationStarted = true; // Not a corner, mark as started
                startModifierFaceRotation(faceInfo.axis, faceInfo.layer);
            }
        }
    } else {
        // Normal cube rotation mode
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    }
});

container.addEventListener('mousemove', (e) => {
    // Check if we're in modifier key face rotation mode
    if (modifierKeyState.isLocked && modifierKeyState.swipeStartFace) {
        const faceInfo = modifierKeyState.swipeStartFace;
        
        const deltaX = e.clientX - modifierKeyState.swipeStartPos.x;
        const deltaY = e.clientY - modifierKeyState.swipeStartPos.y;
        const screenLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (screenLength > MIN_SWIPE_THRESHOLD) {
            // For corner cubies, determine rotation axis from swipe direction on first move
            if (faceInfo.cubieType === 'corner' && !modifierKeyState.cornerRotationStarted) {
                // Use total delta from initial position to determine direction
                const totalDeltaX = e.clientX - modifierKeyState.swipeInitialPos.x;
                const totalDeltaY = e.clientY - modifierKeyState.swipeInitialPos.y;
                
                // Select neighbor face based on swipe direction
                const selectedFace = selectCornerNeighborBySwipeDirection(
                    faceInfo.neighborFaces,
                    totalDeltaX,
                    totalDeltaY
                );
                
                // Only proceed if a valid neighbor was found
                if (selectedFace) {
                    // Store selected face in a separate property to avoid mutating original faceInfo
                    modifierKeyState.selectedAxis = selectedFace.axis;
                    modifierKeyState.selectedLayer = selectedFace.layer;
                    
                    // Now start the rotation with the selected face
                    startModifierFaceRotation(selectedFace.axis, selectedFace.layer);
                    modifierKeyState.cornerRotationStarted = true;
                }
            }
            
            // Only rotate if rotation group has been created
            if (modifierKeyState.rotationGroup) {
                // Use selected axis/layer for corners, original for others
                const rotationAxis = modifierKeyState.selectedAxis || faceInfo.axis;
                const rotationLayer = modifierKeyState.selectedLayer || faceInfo.layer;
                
                const deltaAngle = calculateModifierRotationAngle(
                    deltaX, 
                    deltaY, 
                    rotationAxis, 
                    rotationLayer, 
                    faceInfo.cubiePos
                );
                
                modifierKeyState.currentRotation += deltaAngle;
                
                switch (rotationAxis) {
                    case 'x':
                        modifierKeyState.rotationGroup.rotation.x = modifierKeyState.currentRotation;
                        break;
                    case 'y':
                        modifierKeyState.rotationGroup.rotation.y = modifierKeyState.currentRotation;
                        break;
                    case 'z':
                        modifierKeyState.rotationGroup.rotation.z = modifierKeyState.currentRotation;
                        break;
                }
            }
        }
        
        // Update position for next frame's incremental calculation
        modifierKeyState.swipeStartPos = { x: e.clientX, y: e.clientY };
        return;
    }
    
    // Normal cube rotation
    if (!isDragging) return;
    
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    
    cubeGroup.rotation.y += deltaX * 0.01;
    cubeGroup.rotation.x += deltaY * 0.01;
    
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

container.addEventListener('mouseup', () => {
    if (modifierKeyState.isLocked) {
        // Complete face rotation if we were in modifier key mode
        if (modifierKeyState.rotationGroup) {
            completeModifierFaceRotation();
        }
        modifierKeyState.isLocked = false;
        modifierKeyState.swipeStartPos = null;
        modifierKeyState.swipeInitialPos = null;
        modifierKeyState.swipeStartFace = null;
        modifierKeyState.selectedAxis = null;
        modifierKeyState.selectedLayer = null;
        modifierKeyState.cornerRotationStarted = false;
        removeModifierHighlight();
    }
    isDragging = false;
});

container.addEventListener('mouseleave', () => {
    if (modifierKeyState.isLocked) {
        if (modifierKeyState.rotationGroup) {
            completeModifierFaceRotation();
        }
        modifierKeyState.isLocked = false;
        modifierKeyState.swipeStartPos = null;
        modifierKeyState.swipeInitialPos = null;
        modifierKeyState.swipeStartFace = null;
        modifierKeyState.cornerRotationStarted = false;
        modifierKeyState.selectedAxis = null;
        modifierKeyState.selectedLayer = null;
        removeModifierHighlight();
    }
    isDragging = false;
});

// Touch controls for mobile
let touchState = {
    lockTouch: null,      // First touch that locks the cube
    swipeTouch: null,     // Second touch that swipes faces
    isLocked: false,      // Whether cube rotation is locked
    activeFaceRotation: null, // Current active face rotation state
    swipeStartPos: null,  // Starting position of swipe (initial)
    swipeInitialPos: null, // Initial touch position (for total distance calculation)
    swipeStartFace: null, // Face being swiped
    swipeAxis: null,      // Axis of rotation
    swipeLayer: null,     // Layer being rotated
    swipeDirection: null, // Direction of swipe
    currentRotation: 0,   // Current rotation angle in radians
    rotationGroup: null,  // Temporary group for rotation
    highlightedCubie: null, // Currently highlighted cubie
    originalMaterials: null, // Original materials for restoration
    cornerRotationStarted: false, // Whether corner rotation has started (after direction detected)
    selectedAxis: null,   // Selected axis for corner rotation
    selectedLayer: null   // Selected layer for corner rotation
};

// Raycaster for detecting which face is touched
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Highlight a cubie - only the touched face, dim others
function highlightCubie(cubie, faceNormal) {
    // Remove previous highlight
    removeHighlight();
    
    if (!cubie) return;
    
    // Store reference and original material properties
    touchState.highlightedCubie = cubie;
    touchState.originalMaterials = [];
    
    // Get materials array (handle both single material and array)
    const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
    
    // Determine which face index was touched based on normal
    // Material order: [Right(+X), Left(-X), Up(+Y), Down(-Y), Front(+Z), Back(-Z)]
    let touchedFaceIndex = -1;
    if (faceNormal) {
        const absX = Math.abs(faceNormal.x);
        const absY = Math.abs(faceNormal.y);
        const absZ = Math.abs(faceNormal.z);
        
        if (absX >= absY && absX >= absZ) {
            touchedFaceIndex = faceNormal.x > 0 ? 0 : 1; // Right or Left
        } else if (absY >= absZ) {
            touchedFaceIndex = faceNormal.y > 0 ? 2 : 3; // Up or Down
        } else {
            touchedFaceIndex = faceNormal.z > 0 ? 4 : 5; // Front or Back
        }
    }
    
    // Store original properties and apply highlight
    materials.forEach((material, index) => {
        // Store original values
        touchState.originalMaterials.push({
            color: material.color.clone(),
            emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
            emissiveIntensity: material.emissiveIntensity !== undefined ? material.emissiveIntensity : 0
        });
        
        if (index === touchedFaceIndex) {
            // Highlight the touched face - lighten and add glow
            const lightenedColor = new THREE.Color().lerpColors(
                material.color,
                new THREE.Color(0xffffff),
                0.15
            );
            material.color.copy(lightenedColor);
            
            // Add subtle white emissive glow
            if (!material.emissive) {
                material.emissive = new THREE.Color(0x000000);
            }
            material.emissive.setHex(0xffffff);
            material.emissiveIntensity = 0.4;
        } else {
            // Dim the other faces slightly
            const dimmedColor = new THREE.Color().lerpColors(
                material.color,
                new THREE.Color(0x000000),
                0.3
            );
            material.color.copy(dimmedColor);
        }
        
        // Force material update
        material.needsUpdate = true;
    });
    
    // Ensure the mesh updates
    cubie.material.needsUpdate = true;
}

// Remove highlighting from cubie
function removeHighlight() {
    if (touchState.highlightedCubie && touchState.originalMaterials) {
        const cubie = touchState.highlightedCubie;
        const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
        
        // Restore original material properties
        materials.forEach((material, index) => {
            if (touchState.originalMaterials[index]) {
                const original = touchState.originalMaterials[index];
                material.color.copy(original.color);
                
                // Restore emissive
                if (material.emissive) {
                    material.emissive.copy(original.emissive);
                    material.emissiveIntensity = original.emissiveIntensity;
                }
                
                material.needsUpdate = true;
            }
        });
        
        cubie.material.needsUpdate = true;
        touchState.highlightedCubie = null;
        touchState.originalMaterials = null;
    }
}

// Get face information from a touch position
function getFaceFromTouch(touch) {
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check intersection with all cubies
    const intersects = raycaster.intersectObjects(cubies, true);
    
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const cubie = intersect.object;
        
        // Get local normal (before transformation) for face index determination
        const localNormal = intersect.face.normal.clone();
        
        // Get the cubie's position in cubeGroup's local space
        const cubiePos = cubie.position.clone();
        
        // Transform the face normal to cubeGroup's local space (not world space)
        // This ensures axis/layer determination works correctly regardless of cube rotation
        const normalInCubeSpace = localNormal.clone();
        
        // Transform from cubie's local space to cubeGroup's local space
        // We need to apply the cubie's rotation (which changes as layers rotate)
        normalInCubeSpace.applyQuaternion(cubie.quaternion);
        
        // Determine which face of the cube was hit based on normal in cube's local space
        const absX = Math.abs(normalInCubeSpace.x);
        const absY = Math.abs(normalInCubeSpace.y);
        const absZ = Math.abs(normalInCubeSpace.z);
        
        let axis, layer;
        if (absX >= absY && absX >= absZ) {
            axis = 'x';
            layer = normalInCubeSpace.x > 0 ? 1 : -1;
        } else if (absY >= absZ) {
            axis = 'y';
            layer = normalInCubeSpace.y > 0 ? 1 : -1;
        } else {
            axis = 'z';
            layer = normalInCubeSpace.z > 0 ? 1 : -1;
        }
        
        // Check if this cubie is on the determined layer
        const faceCubies = getCubiesOnFace(axis, layer);
        if (faceCubies.includes(cubie)) {
            // Get cubie type and neighbors
            const { cubieType, neighborFaces } = getCubieTypeAndNeighbors(axis, layer, cubiePos);
            
            // Transform normal to world space for rotation calculations
            const worldNormal = intersect.face.normal.clone();
            worldNormal.transformDirection(cubie.matrixWorld);
            
            // Return face info with cubie type and neighbors for corner handling
            return { 
                axis, 
                layer, 
                cubie, 
                normal: localNormal, 
                worldNormal: worldNormal, 
                cubiePos: cubiePos,
                cubieType,
                neighborFaces
            };
        }
    }
    
    return null;
}

// Start face rotation with continuous control
function startFaceRotation(axis, layer, startAngle = 0) {
    if (touchState.rotationGroup) {
        // Clean up existing rotation group
        cubeGroup.remove(touchState.rotationGroup);
    }
    
    const faceCubies = getCubiesOnFace(axis, layer);
    touchState.rotationGroup = new THREE.Group();
    cubeGroup.add(touchState.rotationGroup);
    
    faceCubies.forEach(cubie => {
        const localPos = cubie.position.clone();
        cubeGroup.remove(cubie);
        touchState.rotationGroup.add(cubie);
        cubie.position.copy(localPos);
    });
    
    touchState.swipeAxis = axis;
    touchState.swipeLayer = layer;
    touchState.currentRotation = startAngle;
    
    // Set initial rotation
    switch (axis) {
        case 'x':
            touchState.rotationGroup.rotation.x = startAngle;
            break;
        case 'y':
            touchState.rotationGroup.rotation.y = startAngle;
            break;
        case 'z':
            touchState.rotationGroup.rotation.z = startAngle;
            break;
    }
}

// Update face rotation during swipe
function updateFaceRotation(deltaAngle) {
    if (!touchState.rotationGroup || touchState.swipeAxis === null) return;
    
    touchState.currentRotation += deltaAngle;
    
    switch (touchState.swipeAxis) {
        case 'x':
            touchState.rotationGroup.rotation.x = touchState.currentRotation;
            break;
        case 'y':
            touchState.rotationGroup.rotation.y = touchState.currentRotation;
            break;
        case 'z':
            touchState.rotationGroup.rotation.z = touchState.currentRotation;
            break;
    }
}

// Complete face rotation - snap to nearest 90 degrees
function completeFaceRotation() {
    if (!touchState.rotationGroup || touchState.swipeAxis === null) return;
    
    const currentAngle = touchState.currentRotation;
    // Snap to nearest 90 degrees (π/2)
    const snapAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
    const remainingAngle = snapAngle - currentAngle;
    
    if (Math.abs(remainingAngle) < 0.01) {
        // Already at snap position, just finalize
        finalizeFaceRotation(snapAngle);
    } else {
        // Animate to snap position
        const duration = 200;
        const startTime = Date.now();
        const startAngle = currentAngle;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const angle = startAngle + remainingAngle * eased;
            touchState.currentRotation = angle;
            
            switch (touchState.swipeAxis) {
                case 'x':
                    touchState.rotationGroup.rotation.x = angle;
                    break;
                case 'y':
                    touchState.rotationGroup.rotation.y = angle;
                    break;
                case 'z':
                    touchState.rotationGroup.rotation.z = angle;
                    break;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeFaceRotation(snapAngle);
            }
        }
        
        animate();
    }
}

// Finalize the rotation and update cubie positions
function finalizeFaceRotation(finalAngle) {
    if (!touchState.rotationGroup || touchState.swipeAxis === null) return;
    
    // Apply final rotation to the group
    switch (touchState.swipeAxis) {
        case 'x':
            touchState.rotationGroup.rotation.x = finalAngle;
            break;
        case 'y':
            touchState.rotationGroup.rotation.y = finalAngle;
            break;
        case 'z':
            touchState.rotationGroup.rotation.z = finalAngle;
            break;
    }
    
    const faceCubies = [];
    touchState.rotationGroup.children.forEach(cubie => {
        faceCubies.push(cubie);
    });
    
    // Calculate how many quarter turns this represents
    const quarterTurns = Math.round(finalAngle / (Math.PI / 2));
    
    // Update cubie positions
    faceCubies.forEach(cubie => {
        const pos = new THREE.Vector3();
        cubie.getWorldPosition(pos);
        cubeGroup.worldToLocal(pos);
        
        // Round to nearest grid position
        pos.x = Math.round(pos.x / totalSize) * totalSize;
        pos.y = Math.round(pos.y / totalSize) * totalSize;
        pos.z = Math.round(pos.z / totalSize) * totalSize;
        
        const worldQuaternion = new THREE.Quaternion();
        cubie.getWorldQuaternion(worldQuaternion);
        
        touchState.rotationGroup.remove(cubie);
        cubeGroup.add(cubie);
        
        cubie.position.copy(pos);
        
        const cubeGroupWorldQuaternion = new THREE.Quaternion();
        cubeGroup.getWorldQuaternion(cubeGroupWorldQuaternion);
        const invertedQuaternion = cubeGroupWorldQuaternion.clone().invert();
        cubie.quaternion.copy(worldQuaternion).premultiply(invertedQuaternion);
    });
    
    cubeGroup.remove(touchState.rotationGroup);
    touchState.rotationGroup = null;
    
    // Record the move if it was a full quarter turn
    // Normalize quarterTurns to -1, 0, 1, 2, 3 (where 2 = 180°, 3 = -90°)
    const normalizedTurns = ((quarterTurns % 4) + 4) % 4;
    if (normalizedTurns === 1) {
        // 90° rotation
        moveHistory.push({ 
            axis: touchState.swipeAxis, 
            layer: touchState.swipeLayer, 
            direction: 1 
        });
    } else if (normalizedTurns === 3) {
        // 270° rotation = -90° rotation
        moveHistory.push({ 
            axis: touchState.swipeAxis, 
            layer: touchState.swipeLayer, 
            direction: -1 
        });
    } else if (normalizedTurns === 2) {
        // 180° rotation = two 90° rotations
        moveHistory.push({ 
            axis: touchState.swipeAxis, 
            layer: touchState.swipeLayer, 
            direction: 1 
        });
        moveHistory.push({ 
            axis: touchState.swipeAxis, 
            layer: touchState.swipeLayer, 
            direction: 1 
        });
    }
    // normalizedTurns === 0 means no rotation, so no move recorded
    
    // Reset state
    touchState.swipeAxis = null;
    touchState.swipeLayer = null;
    touchState.currentRotation = 0;
}

// Calculate swipe direction relative to face
function calculateSwipeDirection(touch, faceInfo) {
    if (!touchState.swipeInitialPos) return 0;
    
    // Use initial position for total distance calculation
    const totalDeltaX = touch.clientX - touchState.swipeInitialPos.x;
    const totalDeltaY = touch.clientY - touchState.swipeInitialPos.y;
    
    // Also calculate incremental delta for smooth updates
    const deltaX = touch.clientX - touchState.swipeStartPos.x;
    const deltaY = touch.clientY - touchState.swipeStartPos.y;
    
    const screenLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (screenLength < 2) return 0; // Minimum movement threshold
    
    const { axis, layer, normal } = faceInfo;
    
    // Get the face normal in world space
    const faceNormal = normal.clone();
    faceNormal.transformDirection(cubeGroup.matrixWorld);
    
    // Get the center of the face in world space
    const faceCenter = new THREE.Vector3();
    if (axis === 'x') faceCenter.set(layer * totalSize, 0, 0);
    else if (axis === 'y') faceCenter.set(0, layer * totalSize, 0);
    else faceCenter.set(0, 0, layer * totalSize);
    faceCenter.applyMatrix4(cubeGroup.matrixWorld);
    
    // Convert screen coordinates to 3D ray
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    const startMouse = new THREE.Vector2();
    startMouse.x = (touchState.swipeStartPos.x / window.innerWidth) * 2 - 1;
    startMouse.y = -(touchState.swipeStartPos.y / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const currentRay = raycaster.ray.clone();
    
    raycaster.setFromCamera(startMouse, camera);
    const startRay = raycaster.ray.clone();
    
    // Find intersection points on the face plane
    const plane = new THREE.Plane(faceNormal, -faceNormal.dot(faceCenter));
    
    const currentIntersect = new THREE.Vector3();
    const startIntersect = new THREE.Vector3();
    
    currentRay.intersectPlane(plane, currentIntersect);
    startRay.intersectPlane(plane, startIntersect);
    
    if (!currentIntersect || !startIntersect) {
        // Fallback to simple calculation
        return calculateSimpleSwipeDirection(deltaX, deltaY, axis, layer);
    }
    
    // Calculate swipe vector on the face plane
    const swipeVector = new THREE.Vector3().subVectors(currentIntersect, startIntersect);
    const swipeLength = swipeVector.length();
    
    if (swipeLength < 0.01) return 0;
    
    // Determine rotation axis vector
    let rotationAxis = new THREE.Vector3();
    if (axis === 'x') rotationAxis.set(1, 0, 0);
    else if (axis === 'y') rotationAxis.set(0, 1, 0);
    else rotationAxis.set(0, 0, 1);
    rotationAxis.transformDirection(cubeGroup.matrixWorld);
    
    // Calculate rotation direction using cross product
    // The rotation should follow the swipe direction
    const cross = new THREE.Vector3().crossVectors(swipeVector, rotationAxis);
    const dot = faceNormal.dot(cross);
    
    // Rotation speed - adjust for sensitivity (increased significantly)
    // Use screen space delta for more direct control
    const screenDelta = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
    const rotationSpeed = 0.002; // Per pixel rotation speed
    const angle = screenDelta * rotationSpeed * (dot > 0 ? 1 : -1) * layer;
    
    return angle;
}

// Fallback simple swipe direction calculation
function calculateSimpleSwipeDirection(deltaX, deltaY, axis, layer) {
    const rotationSpeed = 0.015; // Increased from 0.003 for more responsive rotation
    let angle = 0;
    
    // Determine rotation direction based on axis and swipe direction
    if (axis === 'x') {
        // Rotating around X axis - swipe up/down rotates
        angle = -deltaY * rotationSpeed * layer;
    } else if (axis === 'y') {
        // Rotating around Y axis - swipe left/right rotates
        angle = deltaX * rotationSpeed * layer;
    } else if (axis === 'z') {
        // Rotating around Z axis
        angle = deltaX * rotationSpeed * layer;
    }
    
    return angle;
}

// Calculate incremental rotation angle from touch swipe using proper 3D geometry
// This correctly handles all faces and all positions on each face
// Uses incremental deltas to avoid 180-degree jumps when swiping in circular motions
function calculateTouchRotationAngle(deltaX, deltaY, axis, layer, cubiePos) {
    // Get the rotation axis in world space
    let rotationAxisLocal = new THREE.Vector3();
    if (axis === 'x') rotationAxisLocal.set(1, 0, 0);
    else if (axis === 'y') rotationAxisLocal.set(0, 1, 0);
    else rotationAxisLocal.set(0, 0, 1);
    
    // Transform rotation axis to world space
    const rotationAxisWorld = rotationAxisLocal.clone().transformDirection(cubeGroup.matrixWorld);
    
    // Get the cubie's world position
    const cubieWorldPos = cubiePos.clone();
    cubeGroup.localToWorld(cubieWorldPos);
    
    // Project the cubie position onto screen space to get the touch point
    const screenPoint = cubieWorldPos.clone().project(camera);
    
    // Create a point offset by the swipe delta in screen space
    const screenPointMoved = new THREE.Vector3(
        screenPoint.x + (deltaX / window.innerWidth) * 2,
        screenPoint.y - (deltaY / window.innerHeight) * 2,
        screenPoint.z
    );
    
    // Unproject both points to world space at the cubie's depth
    const worldPoint = screenPoint.clone().unproject(camera);
    const worldPointMoved = screenPointMoved.clone().unproject(camera);
    
    // Calculate the swipe vector in world space (not normalized, to preserve magnitude)
    const swipeVec = new THREE.Vector3().subVectors(worldPointMoved, worldPoint);
    
    // Get the vector from rotation axis center to cubie position in world space
    // The axis center is the center of the face being rotated, on the rotation axis
    const axisCenter = new THREE.Vector3();
    if (axis === 'x') axisCenter.set(layer * totalSize, 0, 0);
    else if (axis === 'y') axisCenter.set(0, layer * totalSize, 0);
    else axisCenter.set(0, 0, layer * totalSize);
    cubeGroup.localToWorld(axisCenter);
    
    // Vector from axis center to cubie
    const radiusVec = new THREE.Vector3().subVectors(cubieWorldPos, axisCenter);
    
    // For center cubies (on the rotation axis), radiusVec is zero or very small
    // In this case, we need a different approach: use the camera's view direction
    const radiusLength = radiusVec.length();
    let tangent;
    
    if (radiusLength < CENTER_CUBIE_THRESHOLD) {
        // Center cubie - create a tangent based on camera right direction
        // The camera's right direction projected onto the face gives us a reasonable tangent
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        // Make tangent perpendicular to the rotation axis
        tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, cameraRight).normalize();
        // If the cross product is too small (rotation axis aligned with camera right), use camera up
        if (tangent.length() < TANGENT_ALIGNMENT_THRESHOLD) {
            const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, cameraUp).normalize();
        }
    } else {
        // Normal case - calculate tangent from cross product
        tangent = new THREE.Vector3().crossVectors(rotationAxisWorld, radiusVec).normalize();
    }
    
    // Project the swipe vector onto the tangent direction
    // This gives us the component of swipe that contributes to rotation
    // Using dot product preserves the sign based on direction alignment
    const tangentComponent = swipeVec.dot(tangent);
    
    // Convert the tangent component to an angle increment
    // The tangent component is in world units, we scale it appropriately
    const angle = tangentComponent * TOUCH_ROTATION_SCALE;
    
    return angle;
}

container.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
        // Single touch - normal cube rotation
        if (!touchState.isLocked) {
            isDragging = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    } else if (e.touches.length === 2) {
        // Two touches - lock cube and enable face swiping
        touchState.isLocked = true;
        isDragging = false;
        
        // First touch locks the cube
        touchState.lockTouch = {
            id: e.touches[0].identifier,
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
        
        // Second touch is for swiping
        touchState.swipeTouch = {
            id: e.touches[1].identifier,
            x: e.touches[1].clientX,
            y: e.touches[1].clientY
        };
        
        // Detect which face is being touched
        const faceInfo = getFaceFromTouch(e.touches[1]);
        if (faceInfo) {
            touchState.swipeStartFace = faceInfo;
            const initialPos = {
                x: e.touches[1].clientX,
                y: e.touches[1].clientY
            };
            touchState.swipeStartPos = initialPos;
            touchState.swipeInitialPos = initialPos; // Store initial position
            // Highlight the touched cubie - pass the face normal to highlight only that face
            highlightCubie(faceInfo.cubie, faceInfo.normal);
            
            // For corner cubies, delay rotation start until swipe direction is known
            if (faceInfo.cubieType === 'corner') {
                touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
                // Don't start rotation yet - wait for first move
            } else {
                // For center and edge cubies, start rotation immediately with clicked face
                touchState.cornerRotationStarted = true;
                startFaceRotation(faceInfo.axis, faceInfo.layer, 0);
            }
        }
    }
});

container.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && !touchState.isLocked) {
        // Single touch rotation (normal mode)
        if (isDragging) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            
            cubeGroup.rotation.y += deltaX * 0.01;
            cubeGroup.rotation.x += deltaY * 0.01;
            
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            updateFrontFaceIndicator();
        }
    } else if (e.touches.length === 2 && touchState.isLocked) {
        // Two touches - update swipe
        let swipeTouch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchState.swipeTouch?.id) {
                swipeTouch = e.touches[i];
                break;
            }
        }
        
        if (swipeTouch && touchState.swipeStartFace) {
            const faceInfo = touchState.swipeStartFace;
            
            // Calculate incremental delta from last position (not total from initial)
            // This prevents 180-degree jumps when swiping in circular motions
            const deltaX = swipeTouch.clientX - touchState.swipeStartPos.x;
            const deltaY = swipeTouch.clientY - touchState.swipeStartPos.y;
            const screenLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (screenLength > MIN_SWIPE_THRESHOLD) {
                // For corner cubies, determine rotation axis from swipe direction on first move
                if (faceInfo.cubieType === 'corner' && !touchState.cornerRotationStarted) {
                    // Use total delta from initial position to determine direction
                    const totalDeltaX = swipeTouch.clientX - touchState.swipeInitialPos.x;
                    const totalDeltaY = swipeTouch.clientY - touchState.swipeInitialPos.y;
                    
                    // Select neighbor face based on swipe direction
                    const selectedFace = selectCornerNeighborBySwipeDirection(
                        faceInfo.neighborFaces,
                        totalDeltaX,
                        totalDeltaY
                    );
                    
                    // Only proceed if a valid neighbor was found
                    if (selectedFace) {
                        // Store selected face in a separate property to avoid mutating original faceInfo
                        touchState.selectedAxis = selectedFace.axis;
                        touchState.selectedLayer = selectedFace.layer;
                        
                        // Now start the rotation with the selected face
                        startFaceRotation(selectedFace.axis, selectedFace.layer, 0);
                        touchState.cornerRotationStarted = true;
                    }
                }
                
                // Only rotate if rotation group has been created
                if (touchState.rotationGroup) {
                    // Use selected axis/layer for corners, original for others
                    const rotationAxis = touchState.selectedAxis || faceInfo.axis;
                    const rotationLayer = touchState.selectedLayer || faceInfo.layer;
                    
                    // Calculate incremental angle using proper 3D geometry
                    // This works for all faces and all positions on each face
                    const deltaAngle = calculateTouchRotationAngle(
                        deltaX, 
                        deltaY, 
                        rotationAxis, 
                        rotationLayer, 
                        faceInfo.cubiePos
                    );
                    
                    // Accumulate rotation incrementally
                    touchState.currentRotation += deltaAngle;
                    
                    switch (rotationAxis) {
                        case 'x':
                            touchState.rotationGroup.rotation.x = touchState.currentRotation;
                            break;
                        case 'y':
                            touchState.rotationGroup.rotation.y = touchState.currentRotation;
                            break;
                        case 'z':
                            touchState.rotationGroup.rotation.z = touchState.currentRotation;
                            break;
                    }
                }
            }
            
            // Update swipe start position for next frame's incremental calculation
            touchState.swipeStartPos = {
                x: swipeTouch.clientX,
                y: swipeTouch.clientY
            };
        }
    }
});

container.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        // All touches ended
        isDragging = false;
        touchState.isLocked = false;
        touchState.lockTouch = null;
        
        if (touchState.swipeTouch && touchState.rotationGroup) {
            // Complete the face rotation
            completeFaceRotation();
        }
        
        touchState.swipeTouch = null;
        touchState.swipeStartPos = null;
        touchState.swipeInitialPos = null;
        touchState.swipeStartFace = null;
        touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
        removeHighlight();
    } else if (e.touches.length === 1) {
        // One touch remains - check if it's the lock or swipe
        const remainingId = e.touches[0].identifier;
        
        if (touchState.lockTouch && remainingId === touchState.lockTouch.id) {
            // Lock touch remains, swipe ended
            if (touchState.rotationGroup) {
                completeFaceRotation();
            }
            touchState.swipeTouch = null;
            touchState.swipeStartPos = null;
            touchState.swipeInitialPos = null;
            touchState.swipeStartFace = null;
            touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
            touchState.isLocked = false;
            removeHighlight();
        } else if (touchState.swipeTouch && remainingId === touchState.swipeTouch.id) {
            // Swipe touch remains, lock ended - switch roles
            touchState.lockTouch = touchState.swipeTouch;
            touchState.swipeTouch = null;
            touchState.swipeStartPos = null;
            touchState.swipeInitialPos = null;
            touchState.swipeStartFace = null;
            touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
            if (touchState.rotationGroup) {
                completeFaceRotation();
            }
            touchState.isLocked = false;
            removeHighlight();
        }
    } else if (e.touches.length === 2) {
        // Still two touches - update which is which
        const touchIds = [e.touches[0].identifier, e.touches[1].identifier];
        
        if (touchState.lockTouch && !touchIds.includes(touchState.lockTouch.id)) {
            // Lock touch ended, promote swipe to lock
            touchState.lockTouch = touchState.swipeTouch;
            touchState.swipeTouch = {
                id: touchIds.find(id => id !== touchState.lockTouch.id),
                x: e.touches[touchIds.indexOf(touchIds.find(id => id !== touchState.lockTouch.id))].clientX,
                y: e.touches[touchIds.indexOf(touchIds.find(id => id !== touchState.lockTouch.id))].clientY
            };
            
            // Detect new face
            const newSwipeTouch = e.touches[touchIds.indexOf(touchState.swipeTouch.id)];
            const faceInfo = getFaceFromTouch(newSwipeTouch);
            if (faceInfo) {
                if (touchState.rotationGroup) {
                    completeFaceRotation();
                }
                const initialPos = {
                    x: newSwipeTouch.clientX,
                    y: newSwipeTouch.clientY
                };
                touchState.swipeStartFace = faceInfo;
                touchState.swipeStartPos = initialPos;
                touchState.swipeInitialPos = initialPos;
                highlightCubie(faceInfo.cubie, faceInfo.normal);
                
                // For corner cubies, delay rotation start
                if (faceInfo.cubieType === 'corner') {
                    touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
                } else {
                    touchState.cornerRotationStarted = true;
                    startFaceRotation(faceInfo.axis, faceInfo.layer, 0);
                }
            } else {
                touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
                removeHighlight();
            }
        } else if (touchState.swipeTouch && !touchIds.includes(touchState.swipeTouch.id)) {
            // Swipe touch ended
            if (touchState.rotationGroup) {
                completeFaceRotation();
            }
            touchState.swipeTouch = {
                id: touchIds.find(id => id !== touchState.lockTouch?.id),
                x: e.touches[touchIds.indexOf(touchIds.find(id => id !== touchState.lockTouch?.id))].clientX,
                y: e.touches[touchIds.indexOf(touchIds.find(id => id !== touchState.lockTouch?.id))].clientY
            };
            
            // Detect new face
            const newSwipeTouch = e.touches[touchIds.indexOf(touchState.swipeTouch.id)];
            const faceInfo = getFaceFromTouch(newSwipeTouch);
            if (faceInfo) {
                const initialPos = {
                    x: newSwipeTouch.clientX,
                    y: newSwipeTouch.clientY
                };
                touchState.swipeStartFace = faceInfo;
                touchState.swipeStartPos = initialPos;
                touchState.swipeInitialPos = initialPos;
                highlightCubie(faceInfo.cubie, faceInfo.normal);
                
                // For corner cubies, delay rotation start
                if (faceInfo.cubieType === 'corner') {
                    touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
                } else {
                    touchState.cornerRotationStarted = true;
                    startFaceRotation(faceInfo.axis, faceInfo.layer, 0);
                }
            } else {
                touchState.swipeTouch = null;
                touchState.swipeStartPos = null;
                touchState.swipeInitialPos = null;
                touchState.swipeStartFace = null;
                touchState.cornerRotationStarted = false;
        touchState.selectedAxis = null;
        touchState.selectedLayer = null;
                removeHighlight();
            }
        }
    }
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
