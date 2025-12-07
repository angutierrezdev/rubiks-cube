// Camera Controller Module
// This module handles camera controls and view management,
// following the Single Responsibility Principle (SRP)
//
// SOLID Principles Applied:
// - SRP: Single responsibility - camera and view control
// - ISP: Provides focused interface for camera operations
// - OCP: Can be extended with new camera behaviors

/**
 * CameraController class - manages camera position and orientation
 */
class CameraController {
    constructor(camera, cubeGroup, container) {
        this.camera = camera;
        this.cubeGroup = cubeGroup;
        this.container = container;
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.rotationSpeed = 0.005;
    }

    /**
     * Handle mouse down event
     */
    onMouseDown(event) {
        this.isDragging = true;
        this.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }

    /**
     * Handle mouse move event for view rotation
     */
    onMouseMove(event) {
        if (!this.isDragging) return;

        const deltaMove = {
            x: event.clientX - this.previousMousePosition.x,
            y: event.clientY - this.previousMousePosition.y
        };

        this.rotateCube(deltaMove.x, deltaMove.y);

        this.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }

    /**
     * Handle mouse up event
     */
    onMouseUp(event) {
        this.isDragging = false;
    }

    /**
     * Handle touch start
     */
    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.isDragging = true;
            this.previousMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        }
    }

    /**
     * Handle touch move
     */
    onTouchMove(event) {
        if (!this.isDragging || event.touches.length !== 1) return;

        const deltaMove = {
            x: event.touches[0].clientX - this.previousMousePosition.x,
            y: event.touches[0].clientY - this.previousMousePosition.y
        };

        this.rotateCube(deltaMove.x, deltaMove.y);

        this.previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    }

    /**
     * Handle touch end
     */
    onTouchEnd(event) {
        this.isDragging = false;
    }

    /**
     * Rotate the cube based on mouse/touch delta
     */
    rotateCube(deltaX, deltaY) {
        const deltaRotationQuaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(
                deltaY * this.rotationSpeed,
                deltaX * this.rotationSpeed,
                0,
                'XYZ'
            ));

        this.cubeGroup.quaternion.multiplyQuaternions(
            deltaRotationQuaternion,
            this.cubeGroup.quaternion
        );
    }

    /**
     * Handle mouse wheel for zoom
     */
    onWheel(event) {
        event.preventDefault();
        
        const zoomSpeed = 0.1;
        const delta = event.deltaY > 0 ? 1 : -1;
        
        this.camera.position.multiplyScalar(1 + delta * zoomSpeed);
        
        // Limit zoom
        const distance = this.camera.position.length();
        if (distance < 3) {
            this.camera.position.normalize().multiplyScalar(3);
        } else if (distance > 20) {
            this.camera.position.normalize().multiplyScalar(20);
        }
    }

    /**
     * Get cube's inverse quaternion
     */
    getCubeInverseQuaternion() {
        const cubeQuaternion = new THREE.Quaternion();
        this.cubeGroup.getWorldQuaternion(cubeQuaternion);
        return cubeQuaternion.clone().invert();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Mouse events
        this.container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.container.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.container.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // Touch events  
        this.container.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.container.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Wheel event for zoom
        this.container.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }

    /**
     * Get if currently dragging
     */
    getIsDragging() {
        return this.isDragging;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.CameraController = CameraController;
}
