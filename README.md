# 3D Rubik's Cube Simulation

A fully functional 3D Rubik's Cube simulation built with Three.js. Features smooth animations, scramble functionality, auto-solve capability, keyboard controls, and orientation-aware move system.

## Quick Start

1. **Open the application**: Open `index.html` in a modern web browser
2. **Interact with the cube**:
   - 🖱️ Drag to rotate the view
   - 🔄 Scroll to zoom in/out
   - 🎲 Click **Scramble** to randomize
   - ✨ Click **Solve** to auto-solve
   - ⌨️ Use R, U, D, L, F, B keys (Shift for prime moves)

## Documentation

For detailed documentation, see the [docs/](docs/) folder:

- **[docs/README.md](docs/README.md)** - Comprehensive project overview and features
- **[docs/CUBE_API.md](docs/CUBE_API.md)** - Complete API documentation for the RubiksCube class
- **[docs/SOLID_REFACTORING.md](docs/SOLID_REFACTORING.md)** - Architectural improvements using SOLID principles
- **[docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md)** - Design rationale and tradeoffs
- **[docs/TESTING.md](docs/TESTING.md)** - Testing approach and guidelines

## Project Structure

```
rubiks-cube/
├── src/                    # Source code
│   ├── core/              # Core cube logic
│   │   └── cube.js
│   ├── rendering/         # Three.js rendering layer
│   │   ├── cubeRenderer.js
│   │   └── highlightManager.js
│   ├── strategies/        # Strategy pattern implementations
│   │   └── rotationStrategy.js
│   ├── controllers/       # Business logic controllers
│   │   ├── cameraController.js
│   │   ├── touchHandler.js
│   │   └── uiController.js
│   ├── app.js            # Main application entry point
│   └── styles.css        # Styling
│
├── docs/                  # Documentation
├── tests/                 # Test files
├── index.html            # HTML entry point
├── LICENSE
└── README.md             # This file
```

## Features

- 🎮 **Interactive 3D Cube** - Rotate the view by dragging
- 🔄 **Zoom Control** - Scroll to zoom in and out
- 🎲 **Scramble** - Randomly scramble with 20 moves
- ✨ **Auto-Solve** - Watch the cube solve itself
- 🔁 **Reset** - Return to solved state instantly
- ⌨️ **Keyboard Controls** - R, U, D, L, F, B keys
- 🧭 **Orientation-Aware Moves** - Relative to current view
- 🎨 **Front Face Indicator** - Visual feedback
- 📱 **Touch Support** - Full mobile device support
- 🎬 **Smooth Animations** - Eased animations with queue system

## Architecture

This project follows **SOLID principles**:

- **Single Responsibility**: Each module has one clear purpose (UIController, CameraController, etc.)
- **Open/Closed**: Extensible rotation strategies via Strategy pattern
- **Liskov Substitution**: Consistent interfaces across implementations
- **Interface Segregation**: Focused APIs for each module
- **Dependency Inversion**: Rendering abstraction layer

See [docs/SOLID_REFACTORING.md](docs/SOLID_REFACTORING.md) for detailed architecture documentation.

## License

MIT License - See [LICENSE](LICENSE) for details.
