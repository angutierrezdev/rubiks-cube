# 3D Rubik's Cube Simulation

A fully functional 3D Rubik's Cube simulation built with Three.js. Features smooth animations, scramble functionality, auto-solve capability, keyboard controls, and orientation-aware move system.

## Features

- 🎮 **Interactive 3D Cube** - Rotate the view by dragging with your mouse or touch
- 🔄 **Zoom Control** - Scroll to zoom in and out
- 🎲 **Scramble** - Randomly scramble the cube with 20 moves
- ✨ **Auto-Solve** - Watch the cube solve itself automatically by reversing scramble moves
- 🔁 **Reset** - Return the cube to its solved state instantly
- ⌨️ **Keyboard Controls** - Use R, U, D, L, F, B keys for moves (Shift for prime moves)
- 🧭 **Orientation-Aware Moves** - Keyboard moves are relative to current view orientation
- 🎨 **Front Face Indicator** - Visual indicator showing which face is currently facing front
- 📊 **Status Display** - Real-time status updates during operations
- 📱 **Touch Support** - Full touch support for mobile devices
- 🎬 **Smooth Animations** - Eased animations with queue system for sequential moves

## Project Structure

```
rubiks-cube/
├── index.html      # Main HTML file with UI structure
├── script.js       # Core Three.js implementation and cube logic
├── styles.css      # Styling and responsive design
├── README.md       # This file
└── LICENSE         # MIT License
```

## How to Use

1. Open `index.html` in a modern web browser
2. Use the buttons or keyboard to interact:
   - **Scramble** - Mix up the cube randomly with 20 moves
   - **Solve** - Auto-solve the cube by reversing the scramble moves
   - **Reset** - Reset to the solved state instantly

## Controls

### Mouse/Touch Controls
- **Drag** - Rotate the cube view (works with mouse or touch)
- **Scroll** - Zoom in/out (mouse wheel or pinch gesture)
- **Cmd/Ctrl + Drag** - Lock cube and swipe to rotate individual faces (like two-finger touch on mobile)

### Keyboard Controls
- **R, U, D, L, F, B** - Rotate the corresponding face (relative to current view)
- **Shift + Key** - Perform prime (counter-clockwise) move
- Moves are orientation-aware: pressing 'F' always rotates the face currently facing you

### Button Controls
- **Scramble** - Randomly scrambles the cube with 20 moves
- **Solve** - Automatically solves the cube by reversing scramble moves
- **Reset** - Instantly resets to solved state

## Technical Details

### Architecture

- **Three.js v0.128.0** - Loaded via CDN, no build process required
- **3x3x3 Cube** - 27 individual cubies (3×3×3 grid)
- **Animation System** - Queue-based animation system prevents move conflicts
- **Move History** - Tracks all moves for auto-solve functionality

### Cube Colors (Standard Rubik's Cube)
- **White** - Up face (Y+)
- **Yellow** - Down face (Y-)
- **Red** - Right face (X+)
- **Orange** - Left face (X-)
- **Blue** - Front face (Z+)
- **Green** - Back face (Z-)

### Move Notation
Standard Rubik's cube notation:
- **R, L, U, D, F, B** - Clockwise rotations
- **R', L', U', D', F', B'** - Counter-clockwise (prime) rotations

### Key Components

#### `script.js` (548 lines)
- Scene setup and Three.js initialization
- Cube creation and cubie management
- Face rotation logic with animation
- Move execution and history tracking
- Scramble and solve algorithms
- Mouse/touch/keyboard event handlers
- Front face indicator system
- Orientation-aware move mapping

#### `styles.css` (152 lines)
- Responsive design with mobile support
- Gradient backgrounds and button styling
- Fixed UI overlays (controls, status, instructions)
- Front face indicator styling
- AI test banner styling

#### `index.html` (37 lines)
- Semantic HTML structure
- UI elements (buttons, status, instructions, indicators)
- Three.js CDN integration
- Viewport meta tag for mobile support

### Browser Compatibility

Works in all modern browsers that support:
- WebGL
- ES6 JavaScript features
- CSS3 (gradients, transforms, backdrop-filter)

### Performance

- Smooth 60fps animations
- Efficient cubie management
- Optimized rendering with antialiasing
- Responsive to window resizing

## Development Notes

- No build process required - pure HTML/CSS/JavaScript
- All dependencies loaded via CDN
- Single-file architecture for easy deployment
- Move history system enables undo functionality (via solve)

## License

MIT License - See LICENSE file for details.

Copyright (c) 2025 Angel Gutierrez