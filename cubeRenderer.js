// Cube Renderer Abstraction Layer
// This module provides an abstraction for rendering operations,
// following the Dependency Inversion Principle (DIP)

/**
 * Abstract interface for cube rendering operations
 * This allows the cube logic to be independent of the specific rendering implementation
 */
class ICubeRenderer {
    /**
     * Create a cubie at the specified logical position
     * @param {number} x - X position (-1, 0, 1)
     * @param {number} y - Y position (-1, 0, 1)
     * @param {number} z - Z position (-1, 0, 1)
     * @returns {Object} - The created cubie object
     */
    createCubie(x, y, z) {
        throw new Error('createCubie must be implemented by subclass');
    }

    /**
     * Add a cubie to the scene
     * @param {Object} cubie - The cubie to add
     * @param {Object} container - The container to add to
     */
    addToScene(cubie, container) {
        throw new Error('addToScene must be implemented by subclass');
    }

    /**
     * Remove a cubie from the scene
     * @param {Object} cubie - The cubie to remove
     * @param {Object} container - The container to remove from
     */
    removeFromScene(cubie, container) {
        throw new Error('removeFromScene must be implemented by subclass');
    }

    /**
     * Create a rotation group
     * @returns {Object} - The rotation group
     */
    createGroup() {
        throw new Error('createGroup must be implemented by subclass');
    }

    /**
     * Get world position of a cubie
     * @param {Object} cubie - The cubie
     * @returns {Object} - Position vector
     */
    getWorldPosition(cubie) {
        throw new Error('getWorldPosition must be implemented by subclass');
    }

    /**
     * Get world quaternion of a cubie
     * @param {Object} cubie - The cubie
     * @returns {Object} - Quaternion
     */
    getWorldQuaternion(cubie) {
        throw new Error('getWorldQuaternion must be implemented by subclass');
    }

    /**
     * Set rotation of a group
     * @param {Object} group - The group
     * @param {string} axis - Rotation axis
     * @param {number} angle - Rotation angle
     */
    setGroupRotation(group, axis, angle) {
        throw new Error('setGroupRotation must be implemented by subclass');
    }
}

/**
 * Three.js implementation of the cube renderer
 */
class ThreeJSRenderer extends ICubeRenderer {
    constructor(cubeSize, gap, colors) {
        super();
        this.cubeSize = cubeSize;
        this.gap = gap;
        this.totalSize = cubeSize + gap;
        this.colors = colors;
    }

    createCubie(x, y, z) {
        const geometry = new THREE.BoxGeometry(
            this.cubeSize * 0.95,
            this.cubeSize * 0.95,
            this.cubeSize * 0.95
        );
        
        const materials = [
            new THREE.MeshLambertMaterial({ color: x === 1 ? this.colors.red : this.colors.black }),
            new THREE.MeshLambertMaterial({ color: x === -1 ? this.colors.orange : this.colors.black }),
            new THREE.MeshLambertMaterial({ color: y === 1 ? this.colors.white : this.colors.black }),
            new THREE.MeshLambertMaterial({ color: y === -1 ? this.colors.yellow : this.colors.black }),
            new THREE.MeshLambertMaterial({ color: z === 1 ? this.colors.blue : this.colors.black }),
            new THREE.MeshLambertMaterial({ color: z === -1 ? this.colors.green : this.colors.black })
        ];

        const cubie = new THREE.Mesh(geometry, materials);
        cubie.position.set(x * this.totalSize, y * this.totalSize, z * this.totalSize);
        cubie.userData.logicalPos = { x, y, z };
        
        return cubie;
    }

    addToScene(cubie, container) {
        container.add(cubie);
    }

    removeFromScene(cubie, container) {
        container.remove(cubie);
    }

    createGroup() {
        return new THREE.Group();
    }

    getWorldPosition(cubie) {
        const pos = new THREE.Vector3();
        cubie.getWorldPosition(pos);
        return pos;
    }

    getWorldQuaternion(cubie) {
        const quat = new THREE.Quaternion();
        cubie.getWorldQuaternion(quat);
        return quat;
    }

    setGroupRotation(group, axis, angle) {
        switch (axis) {
            case 'x':
                group.rotation.x = angle;
                break;
            case 'y':
                group.rotation.y = angle;
                break;
            case 'z':
                group.rotation.z = angle;
                break;
        }
    }

    worldToLocal(container, position) {
        return container.worldToLocal(position);
    }

    getInverseQuaternion(container) {
        const quat = new THREE.Quaternion();
        container.getWorldQuaternion(quat);
        return quat.invert();
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ICubeRenderer = ICubeRenderer;
    window.ThreeJSRenderer = ThreeJSRenderer;
}
