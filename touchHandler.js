// Touch and Mouse Handler Module
// This module handles all touch and mouse gesture interactions,
// following the Single Responsibility Principle (SRP)
//
// SOLID Principles Applied:
// - SRP: Single responsibility - touch/mouse gesture handling
// - ISP: Focused interface for gesture operations
// - DIP: Depends on cube abstraction, not concrete implementation

/**
 * TouchHandler class - manages touch and mouse input for face rotation
 */
class TouchHandler {
    constructor(cube, renderer, getFaceCallback) {
        this.cube = cube;
        this.renderer = renderer;
        this.getFaceCallback = getFaceCallback;
        this.touchState = this.createInitialState();
        this.listeners = [];
    }

    createInitialState() {
        return {
            activeFaceRotation: null,
            swipeStartPos: null,
            swipeInitialPos: null,
            swipeStartFace: null,
            swipeAxis: null,
            swipeLayer: null,
            currentRotation: 0,
            rotationGroup: null,
            highlightedCubie: null,
            originalMaterials: null,
            cornerRotationStarted: false,
            selectedAxis: null,
            selectedLayer: null
        };
    }

    reset() {
        this.touchState = this.createInitialState();
    }

    /**
     * Handle touch/mouse start event
     */
    onTouchStart(event, camera) {
        const touch = event.touches ? event.touches[0] : event;
        
        const faceInfo = this.getFaceCallback(touch, camera);
        if (!faceInfo) return;

        this.touchState.swipeStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchState.swipeInitialPos = { x: touch.clientX, y: touch.clientY };
        this.touchState.swipeStartFace = faceInfo;
        this.touchState.activeFaceRotation = true;
        
        // Highlight the cubie
        this.highlightCubie(faceInfo.cubie);
    }

    /**
     * Handle touch/mouse move event
     */
    onTouchMove(event, camera, cubeGroup, totalSize) {
        if (!this.touchState.activeFaceRotation || !this.touchState.swipeStartFace) return;

        const touch = event.touches ? event.touches[0] : event;
        const deltaX = touch.clientX - this.touchState.swipeStartPos.x;
        const deltaY = touch.clientY - this.touchState.swipeStartPos.y;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Minimum swipe threshold
        if (distance < 10) return;

        const faceInfo = this.touchState.swipeStartFace;
        const { cubieType, neighborFaces } = faceInfo;
        
        // Handle corner rotation with neighbor selection
        if (cubieType === 'corner' && !this.touchState.cornerRotationStarted) {
            const selectedNeighbor = this.selectCornerNeighbor(neighborFaces, deltaX, deltaY);
            if (selectedNeighbor) {
                this.touchState.selectedAxis = selectedNeighbor.axis;
                this.touchState.selectedLayer = selectedNeighbor.layer;
                this.touchState.cornerRotationStarted = true;
                this.startFaceRotation(selectedNeighbor.axis, selectedNeighbor.layer, cubeGroup, totalSize);
            }
        } else if (cubieType !== 'corner' && !this.touchState.rotationGroup) {
            // Start rotation for center/edge
            this.startFaceRotation(faceInfo.axis, faceInfo.layer, cubeGroup, totalSize);
        }
        
        // Calculate rotation angle
        if (this.touchState.rotationGroup) {
            const deltaAngle = this.calculateRotationAngle(touch, faceInfo, camera, cubeGroup, totalSize);
            this.updateFaceRotation(deltaAngle);
        }
        
        this.touchState.swipeStartPos = { x: touch.clientX, y: touch.clientY };
    }

    /**
     * Handle touch/mouse end event
     */
    onTouchEnd(event) {
        if (this.touchState.highlightedCubie) {
            this.unhighlightCubie();
        }
        
        if (this.touchState.rotationGroup) {
            this.completeFaceRotation();
        }
        
        this.reset();
    }

    /**
     * Start a face rotation
     */
    startFaceRotation(axis, layer, cubeGroup, totalSize) {
        if (this.touchState.rotationGroup) {
            cubeGroup.remove(this.touchState.rotationGroup);
        }
        
        const faceCubies = this.cube.getCubiesOnFace(axis, layer);
        this.touchState.rotationGroup = this.renderer.createGroup();
        cubeGroup.add(this.touchState.rotationGroup);
        
        faceCubies.forEach(cubie => {
            const localPos = cubie.position.clone();
            cubeGroup.remove(cubie);
            this.touchState.rotationGroup.add(cubie);
            cubie.position.copy(localPos);
        });
        
        this.touchState.swipeAxis = axis;
        this.touchState.swipeLayer = layer;
        this.touchState.currentRotation = 0;
    }

    /**
     * Update face rotation angle
     */
    updateFaceRotation(deltaAngle) {
        if (!this.touchState.rotationGroup || this.touchState.swipeAxis === null) return;
        
        this.touchState.currentRotation += deltaAngle;
        this.renderer.setGroupRotation(
            this.touchState.rotationGroup,
            this.touchState.swipeAxis,
            this.touchState.currentRotation
        );
    }

    /**
     * Complete face rotation and snap to nearest 90 degrees
     */
    completeFaceRotation() {
        if (!this.touchState.rotationGroup || this.touchState.swipeAxis === null) return;
        
        const currentAngle = this.touchState.currentRotation;
        const snapAngle = Math.round(currentAngle / (Math.PI / 2)) * (Math.PI / 2);
        const remainingAngle = snapAngle - currentAngle;
        
        if (Math.abs(remainingAngle) < 0.01) {
            this.finalizeFaceRotation(snapAngle);
        } else {
            this.animateToSnap(currentAngle, snapAngle, remainingAngle);
        }
    }

    /**
     * Animate rotation to snap position
     */
    animateToSnap(startAngle, snapAngle, remainingAngle) {
        const duration = 200;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const angle = startAngle + remainingAngle * eased;
            this.touchState.currentRotation = angle;
            this.renderer.setGroupRotation(
                this.touchState.rotationGroup,
                this.touchState.swipeAxis,
                angle
            );
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.finalizeFaceRotation(snapAngle);
            }
        };
        
        animate();
    }

    /**
     * Finalize rotation and update cube state
     */
    finalizeFaceRotation(finalAngle) {
        // Implementation delegated to external handler
        // This would be called by the main script with cubeGroup and totalSize
        if (this.onFinalize) {
            this.onFinalize(finalAngle, this.touchState);
        }
    }

    /**
     * Calculate rotation angle based on swipe
     */
    calculateRotationAngle(touch, faceInfo, camera, cubeGroup, totalSize) {
        // Simplified calculation - actual implementation would be more complex
        const deltaX = touch.clientX - this.touchState.swipeStartPos.x;
        const deltaY = touch.clientY - this.touchState.swipeStartPos.y;
        
        // Scale the rotation based on swipe distance
        const rotationScale = 0.01;
        return (deltaX + deltaY) * rotationScale;
    }

    /**
     * Select corner neighbor based on swipe direction
     */
    selectCornerNeighbor(neighborFaces, deltaX, deltaY) {
        if (!neighborFaces || neighborFaces.length === 0) return null;
        
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
     * Highlight a cubie
     */
    highlightCubie(cubie) {
        if (!cubie || !cubie.material) return;
        
        this.touchState.highlightedCubie = cubie;
        this.touchState.originalMaterials = Array.isArray(cubie.material) 
            ? cubie.material.map(m => m.clone())
            : cubie.material.clone();
        
        const highlightMaterial = (material) => {
            material.emissive = new THREE.Color(0x444444);
            material.emissiveIntensity = 0.5;
        };
        
        if (Array.isArray(cubie.material)) {
            cubie.material.forEach(highlightMaterial);
        } else {
            highlightMaterial(cubie.material);
        }
    }

    /**
     * Unhighlight a cubie
     */
    unhighlightCubie() {
        if (!this.touchState.highlightedCubie || !this.touchState.originalMaterials) return;
        
        const cubie = this.touchState.highlightedCubie;
        cubie.material = this.touchState.originalMaterials;
        
        this.touchState.highlightedCubie = null;
        this.touchState.originalMaterials = null;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.TouchHandler = TouchHandler;
}
