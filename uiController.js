// UI Controller Module
// This module handles all UI updates and status management,
// following the Single Responsibility Principle (SRP)

/**
 * UIController class - manages UI elements and status updates
 */
class UIController {
    constructor(elements) {
        this.statusEl = elements.statusEl;
        this.scrambleBtn = elements.scrambleBtn;
        this.solveBtn = elements.solveBtn;
        this.resetBtn = elements.resetBtn;
        this.frontFaceColorEl = elements.frontFaceColorEl;
        this.frontFaceNameEl = elements.frontFaceNameEl;
    }

    /**
     * Update status text
     * @param {string} text - Status text to display
     */
    updateStatus(text) {
        if (this.statusEl) {
            this.statusEl.textContent = text;
        }
    }

    /**
     * Disable all control buttons
     */
    disableButtons() {
        if (this.scrambleBtn) this.scrambleBtn.disabled = true;
        if (this.solveBtn) this.solveBtn.disabled = true;
        if (this.resetBtn) this.resetBtn.disabled = true;
    }

    /**
     * Enable all control buttons
     */
    enableButtons() {
        if (this.scrambleBtn) this.scrambleBtn.disabled = false;
        if (this.solveBtn) this.solveBtn.disabled = false;
        if (this.resetBtn) this.resetBtn.disabled = false;
    }

    /**
     * Update front face indicator
     * @param {Object} faceInfo - Face information {color, name}
     */
    updateFrontFaceIndicator(faceInfo) {
        if (this.frontFaceColorEl && faceInfo.hex) {
            this.frontFaceColorEl.style.backgroundColor = faceInfo.hex;
        }
        if (this.frontFaceNameEl && faceInfo.name) {
            this.frontFaceNameEl.textContent = faceInfo.name;
        }
    }

    /**
     * Set up button event listeners
     * @param {Object} callbacks - Object with scramble, solve, reset callbacks
     */
    setupButtonListeners(callbacks) {
        if (this.scrambleBtn && callbacks.scramble) {
            this.scrambleBtn.addEventListener('click', callbacks.scramble);
        }
        if (this.solveBtn && callbacks.solve) {
            this.solveBtn.addEventListener('click', callbacks.solve);
        }
        if (this.resetBtn && callbacks.reset) {
            this.resetBtn.addEventListener('click', callbacks.reset);
        }
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}
