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
- 📲 **PWA Support** - Install as app on iOS and Android
- 🔄 **Auto-Update Check** - Automatic version checking with user notification

## Architecture

This project follows **SOLID principles**:

- **Single Responsibility**: Each module has one clear purpose (UIController, CameraController, etc.)
- **Open/Closed**: Extensible rotation strategies via Strategy pattern
- **Liskov Substitution**: Consistent interfaces across implementations
- **Interface Segregation**: Focused APIs for each module
- **Dependency Inversion**: Rendering abstraction layer

See [docs/SOLID_REFACTORING.md](docs/SOLID_REFACTORING.md) for detailed architecture documentation.

## Progressive Web App (PWA)

This application is a fully functional Progressive Web App that can be installed on both iOS and Android devices:

### Installation

**Desktop (Chrome/Edge):**
1. Visit the application in your browser
2. Look for the install icon in the address bar
3. Click "Install" to add to your desktop

**iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Name the app and tap "Add"

**Android (Chrome):**
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Confirm installation

### Features

- **Offline Support**: Works without internet connection after first visit
- **Auto-Update Check**: Checks for new versions every 5 minutes
- **Update Notifications**: Shows banner when new version is available
- **Splash Screen**: Native app-like launch experience
- **App Icons**: Custom Rubik's cube icon for home screen
- **Standalone Mode**: Runs in full screen without browser UI

### Version Management

The service worker automatically manages caching and updates. When a new version is deployed:
1. The app detects the new version in the background
2. A notification banner appears: "🎉 A new version is available!"
3. Users can click "Update Now" to reload with the latest version
4. Or click "Later" to continue with the current version

To update the app version, modify the `VERSION` constant in `sw.js`.

## License

MIT License - See [LICENSE](LICENSE) for details.
