// Rubik's Cube Logic Module
// This module handles all cube-related functionality independent of rendering

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

// Cube configuration
const cubeSize = 1;
const gap = 0.05;
const totalSize = cubeSize + gap;

// Cubie position tolerance for determining face membership
const CUBIE_POSITION_TOLERANCE = 0.1;

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

/**
 * RubiksCube class - manages cube state and operations
 */
class RubiksCube {
    constructor(cubeGroup) {
        this.cubeGroup = cubeGroup;
        this.cubies = [];
        this.moveHistory = [];
        this.isAnimating = false;
        this.animationQueue = [];
    }

    /**
     * Gets cubie type and neighbor faces for special corner rotation behavior.
     */
    getCubieTypeAndNeighbors(clickedAxis, clickedLayer, cubiePos) {
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
     */
    selectCornerNeighborBySwipeDirection(neighborFaces, deltaX, deltaY) {
        if (!neighborFaces || neighborFaces.length === 0) {
            return null;
        }
        
        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
        
        if (isHorizontalSwipe) {
            const yNeighbor = neighborFaces.find(f => f.axis === 'y');
            if (yNeighbor) return yNeighbor;
        } else {
            const sideNeighbor = neighborFaces.find(f => f.axis !== 'y');
            if (sideNeighbor) return sideNeighbor;
        }
        
        return neighborFaces[0];
    }

    /**
     * Selects which middle slice to rotate for a center cubie based on swipe direction.
     * For center cubies, horizontal swipe rotates horizontal slice, vertical swipe rotates vertical slice.
     */
    selectCenterSliceBySwipeDirection(clickedAxis, clickedLayer, deltaX, deltaY) {
        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
        
        // For center cubies, determine which middle slice to rotate based on:
        // 1. Which face was clicked (in screen-relative coordinates)
        // 2. The swipe direction (horizontal or vertical)
        
        if (clickedAxis === 'y') {
            // Top or bottom face
            if (isHorizontalSwipe) {
                // Horizontal swipe on top/bottom -> rotate X-axis middle slice
                return { axis: 'x', layer: 0 };
            } else {
                // Vertical swipe on top/bottom -> rotate Z-axis middle slice
                return { axis: 'z', layer: 0 };
            }
        } else if (clickedAxis === 'x') {
            // Left or right face
            if (isHorizontalSwipe) {
                // Horizontal swipe on left/right -> rotate Y-axis middle slice
                return { axis: 'y', layer: 0 };
            } else {
                // Vertical swipe on left/right -> rotate Z-axis middle slice
                return { axis: 'z', layer: 0 };
            }
        } else if (clickedAxis === 'z') {
            // Front or back face
            if (isHorizontalSwipe) {
                // Horizontal swipe on front/back -> rotate Y-axis middle slice
                return { axis: 'y', layer: 0 };
            } else {
                // Vertical swipe on front/back -> rotate X-axis middle slice
                return { axis: 'x', layer: 0 };
            }
        }
        
        // Fallback to rotating the clicked face
        return { axis: clickedAxis, layer: clickedLayer };
    }

    /**
     * Create a single cubie at position (x, y, z)
     */
    createCubie(x, y, z) {
        const geometry = new THREE.BoxGeometry(cubeSize * 0.95, cubeSize * 0.95, cubeSize * 0.95);
        
        const materials = [
            new THREE.MeshLambertMaterial({ color: x === 1 ? COLORS.red : COLORS.black }),
            new THREE.MeshLambertMaterial({ color: x === -1 ? COLORS.orange : COLORS.black }),
            new THREE.MeshLambertMaterial({ color: y === 1 ? COLORS.white : COLORS.black }),
            new THREE.MeshLambertMaterial({ color: y === -1 ? COLORS.yellow : COLORS.black }),
            new THREE.MeshLambertMaterial({ color: z === 1 ? COLORS.blue : COLORS.black }),
            new THREE.MeshLambertMaterial({ color: z === -1 ? COLORS.green : COLORS.black })
        ];

        const cubie = new THREE.Mesh(geometry, materials);
        cubie.position.set(x * totalSize, y * totalSize, z * totalSize);
        cubie.userData.logicalPos = { x, y, z };
        
        return cubie;
    }

    /**
     * Initialize the cube
     */
    initCube() {
        this.cubies.forEach(cubie => this.cubeGroup.remove(cubie));
        this.cubies = [];
        this.moveHistory = [];
        this.animationQueue = [];

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const cubie = this.createCubie(x, y, z);
                    this.cubies.push(cubie);
                    this.cubeGroup.add(cubie);
                }
            }
        }
    }

    /**
     * Get cubies on a specific face
     */
    getCubiesOnFace(axis, value) {
        return this.cubies.filter(cubie => {
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

    /**
     * Rotate a face
     */
    rotateFace(axis, layer, direction, record = true, callback = null) {
        if (this.isAnimating) {
            this.animationQueue.push({ axis, layer, direction, record, callback });
            return;
        }

        this.isAnimating = true;
        const faceCubies = this.getCubiesOnFace(axis, layer);
        
        const rotationGroup = new THREE.Group();
        this.cubeGroup.add(rotationGroup);
        
        faceCubies.forEach(cubie => {
            const localPos = cubie.position.clone();
            this.cubeGroup.remove(cubie);
            rotationGroup.add(cubie);
            cubie.position.copy(localPos);
        });

        const angle = direction * Math.PI / 2;
        const duration = 200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentAngle = angle * eased;
            
            switch (axis) {
                case 'x': rotationGroup.rotation.x = currentAngle; break;
                case 'y': rotationGroup.rotation.y = currentAngle; break;
                case 'z': rotationGroup.rotation.z = currentAngle; break;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                faceCubies.forEach(cubie => {
                    const pos = new THREE.Vector3();
                    cubie.getWorldPosition(pos);
                    this.cubeGroup.worldToLocal(pos);
                    
                    pos.x = Math.round(pos.x / totalSize) * totalSize;
                    pos.y = Math.round(pos.y / totalSize) * totalSize;
                    pos.z = Math.round(pos.z / totalSize) * totalSize;
                    
                    const worldQuaternion = new THREE.Quaternion();
                    cubie.getWorldQuaternion(worldQuaternion);
                    
                    rotationGroup.remove(cubie);
                    this.cubeGroup.add(cubie);
                    cubie.position.copy(pos);
                    
                    const cubeGroupWorldQuaternion = new THREE.Quaternion();
                    this.cubeGroup.getWorldQuaternion(cubeGroupWorldQuaternion);
                    const invertedQuaternion = cubeGroupWorldQuaternion.clone().invert();
                    cubie.quaternion.copy(worldQuaternion).premultiply(invertedQuaternion);
                });
                
                this.cubeGroup.remove(rotationGroup);
                
                if (record) {
                    this.moveHistory.push({ axis, layer, direction });
                }
                
                this.isAnimating = false;
                
                if (callback) {
                    callback();
                }
                
                if (this.animationQueue.length > 0) {
                    const next = this.animationQueue.shift();
                    this.rotateFace(next.axis, next.layer, next.direction, next.record, next.callback);
                }
            }
        };

        animate();
    }

    /**
     * Execute a move by name
     */
    executeMove(moveName, record = true, callback = null) {
        const move = MOVES[moveName];
        if (move) {
            this.rotateFace(move.axis, move.layer, move.direction, record, callback);
        }
    }

    /**
     * Scramble the cube
     */
    scramble(onComplete = null) {
        if (this.isAnimating || this.animationQueue.length > 0) return;
        
        const moveNames = Object.keys(MOVES).filter(m => !m.includes("'"));
        const scrambleMoves = [];
        
        for (let i = 0; i < 20; i++) {
            const randomMove = moveNames[Math.floor(Math.random() * moveNames.length)];
            const move = Math.random() > 0.5 ? randomMove + "'" : randomMove;
            scrambleMoves.push(move);
        }
        
        let index = 0;
        const doNextMove = () => {
            if (index < scrambleMoves.length) {
                const move = scrambleMoves[index];
                this.executeMove(move, true, () => {
                    index++;
                    doNextMove();
                });
            } else {
                if (onComplete) onComplete();
            }
        };
        
        doNextMove();
    }

    /**
     * Solve the cube (reverse the moves)
     */
    solve(onComplete = null) {
        if (this.isAnimating || this.animationQueue.length > 0) return;
        if (this.moveHistory.length === 0) {
            if (onComplete) onComplete(true); // true indicates already solved
            return;
        }
        
        const solveMoves = [...this.moveHistory].reverse();
        this.moveHistory = [];
        
        let index = 0;
        const doNextMove = () => {
            if (index < solveMoves.length) {
                const move = solveMoves[index];
                this.rotateFace(move.axis, move.layer, -move.direction, false, () => {
                    index++;
                    doNextMove();
                });
            } else {
                if (onComplete) onComplete(false); // false indicates solving completed
            }
        };
        
        doNextMove();
    }

    /**
     * Reset the cube
     */
    reset() {
        if (this.isAnimating || this.animationQueue.length > 0) return;
        this.initCube();
    }

    /**
     * Get all cubies
     */
    getCubies() {
        return this.cubies;
    }

    /**
     * Check if animating
     */
    getIsAnimating() {
        return this.isAnimating;
    }

    /**
     * Get animation queue length
     */
    getAnimationQueueLength() {
        return this.animationQueue.length;
    }

    /**
     * Record a move in the history (for external rotations)
     */
    recordMove(axis, layer, direction) {
        this.moveHistory.push({ axis, layer, direction });
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.RubiksCube = RubiksCube;
    window.CUBE_COLORS = COLORS;
    window.CUBE_MOVES = MOVES;
    window.CUBE_TOTAL_SIZE = totalSize;
}
