// Highlight Manager Module
// This module handles visual feedback for cube interactions,
// following the Single Responsibility Principle (SRP)
//
// SOLID Principles Applied:
// - SRP: Single responsibility - manage visual highlighting
// - ISP: Focused interface for highlighting operations
// - OCP: Can be extended with new highlight effects

/**
 * HighlightManager class - manages cubie highlighting for visual feedback
 */
class HighlightManager {
    constructor() {
        this.highlightedCubie = null;
        this.originalMaterials = null;
        this.highlightColor = 0x444444;
        this.highlightIntensity = 0.5;
    }

    /**
     * Highlight a cubie
     * @param {Object} cubie - The cubie to highlight
     */
    highlight(cubie) {
        if (!cubie || !cubie.material) return;
        
        // Unhighlight previous cubie if any
        this.unhighlight();
        
        this.highlightedCubie = cubie;
        
        // Store original materials
        if (Array.isArray(cubie.material)) {
            this.originalMaterials = cubie.material.map(m => m.clone());
        } else {
            this.originalMaterials = cubie.material.clone();
        }
        
        // Apply highlight
        this.applyHighlight(cubie);
    }

    /**
     * Apply highlight effect to cubie
     */
    applyHighlight(cubie) {
        const highlightMaterial = (material) => {
            material.emissive = new THREE.Color(this.highlightColor);
            material.emissiveIntensity = this.highlightIntensity;
        };
        
        if (Array.isArray(cubie.material)) {
            cubie.material.forEach(highlightMaterial);
        } else {
            highlightMaterial(cubie.material);
        }
    }

    /**
     * Unhighlight the currently highlighted cubie
     */
    unhighlight() {
        if (!this.highlightedCubie || !this.originalMaterials) return;
        
        // Restore original materials
        this.highlightedCubie.material = this.originalMaterials;
        
        this.highlightedCubie = null;
        this.originalMaterials = null;
    }

    /**
     * Check if a cubie is currently highlighted
     */
    isHighlighted(cubie) {
        return this.highlightedCubie === cubie;
    }

    /**
     * Get currently highlighted cubie
     */
    getHighlightedCubie() {
        return this.highlightedCubie;
    }

    /**
     * Set highlight color
     */
    setHighlightColor(color) {
        this.highlightColor = color;
    }

    /**
     * Set highlight intensity
     */
    setHighlightIntensity(intensity) {
        this.highlightIntensity = intensity;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.HighlightManager = HighlightManager;
}
