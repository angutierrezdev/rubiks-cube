# Pinch-to-Zoom Feature Testing Guide

## Feature Description
This implementation adds pinch-to-zoom functionality that only activates when **neither** finger is touching the Rubik's Cube. This allows users to zoom in and out of the scene without accidentally interfering with cube manipulation.

## Implementation Details

### Changes Made
1. **touchState Extension**: Added two new properties to track pinch zoom state:
   - `isPinchZoom`: Boolean flag indicating if currently in pinch zoom mode
   - `initialPinchDistance`: Tracks the initial distance between two touches

2. **Helper Function**: Added `getTouchDistance(touch1, touch2)` to calculate Euclidean distance between two touch points

3. **Touch Start Logic**: Modified to detect cube intersection for both touches
   - If **neither** touch hits the cube → Enable pinch zoom mode
   - If **either** touch hits the cube → Enable face swiping (existing behavior)

4. **Touch Move Logic**: Added pinch zoom handling
   - When in pinch zoom mode, calculate the scale factor based on distance change
   - Apply zoom to camera position with limits (5-20 units from center)
   - Uses inverse scaling: pinch out = zoom in, pinch in = zoom out

5. **Touch End Logic**: Reset pinch zoom state when touches are released

### Zoom Limits
- Minimum distance: 5 units (zoom in limit)
- Maximum distance: 20 units (zoom out limit)
- Consistent with existing mouse wheel zoom behavior

## Testing Instructions

### Manual Testing on Touch Devices

#### Test 1: Pinch Zoom on Empty Space
1. Open the application on a touch-enabled device (phone, tablet, or touch screen)
2. Place two fingers on empty space (NOT on the cube)
3. Spread fingers apart (pinch out) → Cube should zoom in (appear larger)
4. Bring fingers together (pinch in) → Cube should zoom out (appear smaller)
5. Verify zoom stops at minimum/maximum limits

**Expected Result**: Standard pinch zoom behavior - spread to zoom in, pinch to zoom out

#### Test 2: Touch Cube Interaction Still Works
1. Place one finger on a cube face
2. Place a second finger anywhere on screen
3. Swipe with the second finger → Face should rotate
4. Verify the cube face rotates as expected (existing behavior)

**Expected Result**: Face rotation works normally when touching the cube

#### Test 3: Single Touch Rotation
1. Place one finger on empty space
2. Drag → Entire cube should rotate
3. Verify smooth rotation of the entire cube

**Expected Result**: Single touch rotation works normally (existing behavior)

#### Test 4: Transition Between Modes
1. Start pinch zoom on empty space
2. Lift both fingers
3. Touch the cube with one finger → Should enter single touch mode
4. Add a second finger → Should enter face swipe mode

**Expected Result**: Smooth transitions between interaction modes

### Desktop Testing
- Use browser developer tools to simulate touch events
- Or use a touch-enabled laptop/monitor

## Code Review Checklist
- [ ] Pinch zoom only activates when neither finger touches the cube
- [ ] Zoom limits match wheel zoom limits (5-20 units)
- [ ] Existing touch interactions (rotate, face swipe) still work
- [ ] Touch state properly resets when touches are released
- [ ] No race conditions between different touch modes

## Technical Notes

### Why Check Both Touches?
The implementation checks both touches for cube intersection using `getFaceFromTouch()`. This raycasting approach ensures precise detection of whether a touch point intersects with any cubie in the scene.

### Zoom Factor Calculation
```javascript
const scale = currentDistance / touchState.initialPinchDistance;
const zoomFactor = scale > 1 ? 0.95 : 1.05;
```

This implements standard pinch zoom behavior:
- **Pinch OUT** (fingers spread apart): `scale > 1` → `zoomFactor = 0.95` → camera moves closer (zoom IN)
- **Pinch IN** (fingers together): `scale < 1` → `zoomFactor = 1.05` → camera moves farther (zoom OUT)

In Three.js, `camera.position` represents the distance from the origin:
- Multiplying by < 1 brings camera closer (zoom in)
- Multiplying by > 1 moves camera farther (zoom out)

The factors (0.95 and 1.05) are applied incrementally each frame for smooth zooming.

### Touch Event Priority
1. Two touches + neither on cube → Pinch zoom (NEW)
2. Two touches + at least one on cube → Face swiping (EXISTING)
3. One touch + not locked → Cube rotation (EXISTING)
