// Rotation Strategy Module
// This module implements the Strategy pattern for rotation direction calculation,
// following the Open/Closed Principle (OCP)
//
// SOLID Principles Applied:
// - OCP: New rotation behaviors can be added without modifying existing code
// - SRP: This module has single responsibility - rotation direction calculation
// - DIP: Strategies depend on abstractions, not concrete implementations
//
// Note: Current implementation uses Three.js for vector math. In a production system,
// consider abstracting vector operations for complete Three.js independence.

/**
 * Base strategy class for calculating rotation direction
 * This allows new rotation behaviors to be added without modifying existing code
 */
class RotationDirectionStrategy {
    /**
     * Calculate the rotation direction based on swipe input
     * @param {string} axis - The face axis (x, y, z)
     * @param {number} layer - The face layer (-1, 1)
     * @param {Object} cubiePos - Position of the cubie
     * @param {Object} swipeDelta - Swipe direction {x, y}
     * @param {Object} faceInfo - Additional face information
     * @returns {number} - Rotation direction angle
     */
    calculateDirection(axis, layer, cubiePos, swipeDelta, faceInfo) {
        throw new Error('calculateDirection must be implemented by subclass');
    }
}

/**
 * Standard rotation strategy for center and edge cubies
 */
class StandardRotationStrategy extends RotationDirectionStrategy {
    calculateDirection(axis, layer, cubiePos, swipeDelta, faceInfo) {
        const { deltaX, deltaY } = swipeDelta;
        const { worldNormal, cubie } = faceInfo;
        
        // Project swipe direction onto the face plane
        const swipeDirection = new THREE.Vector2(deltaX, -deltaY).normalize();
        
        // Camera's right and up vectors in world space
        const camera = faceInfo.camera;
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        
        // Project camera vectors onto face plane
        const rightComponent = cameraRight.dot(worldNormal);
        const upComponent = cameraUp.dot(worldNormal);
        
        const faceRight = cameraRight.clone().sub(worldNormal.clone().multiplyScalar(rightComponent)).normalize();
        const faceUp = cameraUp.clone().sub(worldNormal.clone().multiplyScalar(upComponent)).normalize();
        
        // Determine rotation axis based on swipe direction
        const tangent = faceRight.clone().multiplyScalar(swipeDirection.x)
            .add(faceUp.clone().multiplyScalar(swipeDirection.y));
        
        // Calculate rotation angle based on alignment with rotation axis
        const rotationAxis = this.getRotationAxisVector(axis);
        const alignment = tangent.dot(rotationAxis);
        
        return Math.sign(alignment);
    }
    
    getRotationAxisVector(axis) {
        switch (axis) {
            case 'x': return new THREE.Vector3(1, 0, 0);
            case 'y': return new THREE.Vector3(0, 1, 0);
            case 'z': return new THREE.Vector3(0, 0, 1);
            default: return new THREE.Vector3(0, 0, 0);
        }
    }
}

/**
 * Corner rotation strategy with swipe-based neighbor selection
 */
class CornerRotationStrategy extends RotationDirectionStrategy {
    constructor(cubieTypeHelper) {
        super();
        this.cubieTypeHelper = cubieTypeHelper;
    }
    
    calculateDirection(axis, layer, cubiePos, swipeDelta, faceInfo) {
        const { deltaX, deltaY } = swipeDelta;
        const { neighborFaces } = faceInfo;
        
        // Select neighbor face based on swipe direction
        const selectedNeighbor = this.cubieTypeHelper.selectCornerNeighborBySwipeDirection(
            neighborFaces,
            deltaX,
            deltaY
        );
        
        if (!selectedNeighbor) {
            // Fall back to standard strategy
            const standardStrategy = new StandardRotationStrategy();
            return standardStrategy.calculateDirection(axis, layer, cubiePos, swipeDelta, faceInfo);
        }
        
        // Return the selected neighbor's axis and layer for rotation
        return {
            axis: selectedNeighbor.axis,
            layer: selectedNeighbor.layer,
            isCornerRotation: true
        };
    }
}

/**
 * Strategy factory for selecting the appropriate rotation strategy
 */
class RotationStrategyFactory {
    constructor(cubieTypeHelper) {
        this.cubieTypeHelper = cubieTypeHelper;
        this.strategies = {
            'center': new StandardRotationStrategy(),
            'edge': new StandardRotationStrategy(),
            'corner': new CornerRotationStrategy(cubieTypeHelper)
        };
    }
    
    /**
     * Get the appropriate strategy for a cubie type
     * @param {string} cubieType - Type of cubie (center, edge, corner)
     * @returns {RotationDirectionStrategy} - The appropriate strategy
     */
    getStrategy(cubieType) {
        return this.strategies[cubieType] || this.strategies['center'];
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.RotationDirectionStrategy = RotationDirectionStrategy;
    window.StandardRotationStrategy = StandardRotationStrategy;
    window.CornerRotationStrategy = CornerRotationStrategy;
    window.RotationStrategyFactory = RotationStrategyFactory;
}
