# Turn Concurrency Fix — Implementation Plan

**Status:** planned, not started. Branch `fix/turn-concurrency` cut from `main` (2026-07-28), no code written yet.

**Origin:** A tester reported that turning a face with two fingers moving simultaneously corrupts the cube — cubies disappear from the render, faces end up in impossible arrangements, and recorded moves no longer match what is on screen.

Line numbers below refer to `main` at commit `231c42d`. They will drift as soon as editing starts; treat them as pointers, not addresses.

---

## 1. Root causes

Three distinct defects. All three are reachable from the reported gesture, and they compose.

### 1.1 `startFaceRotation` orphans cubies

`src/app.js` ~1577-1581:

```js
function startFaceRotation(axis, layer, startAngle = 0) {
    if (touchState.rotationGroup) {
        cubeGroup.remove(touchState.rotationGroup);   // <-- cubies go with it
    }
```

When a rotation group already exists, the group is removed from `cubeGroup` and nothing else happens. The 6-9 cubies parented to it are never reparented, so they leave the scene graph entirely. **This is the black/missing cubies in the tester's screenshots.**

The identical bug exists in the mouse path at `src/app.js` ~891-893 (`startModifierFaceRotation`).

### 1.2 The snap animation reads shared mutable state

`src/app.js` ~1649-1676. `completeFaceRotation` eases the face to the nearest 90° over 200ms via `requestAnimationFrame`. The `animate()` closure does **not** capture the group it started with — it reads `touchState.rotationGroup` and `touchState.swipeAxis` on every frame, and finishes by calling `finalizeFaceRotation(snapAngle)`, which reads them again.

If a new gesture starts during those 200ms, the in-flight closure keeps running and applies the **old** snap angle to the **new** group on the **new** axis, then records a move for it. Same bug in `completeModifierFaceRotation` at ~945-973.

### 1.3 No shared guard across rotation paths

Three paths mutate the same cubies:

| Path | State | Guarded |
|---|---|---|
| Touch (two-finger) | `touchState.rotationGroup` | no |
| Mouse + modifier key | `modifierKeyState.rotationGroup` | no |
| Programmatic (solve/scramble/steps) | `rubiksCube.isAnimating` | only at button call sites |

The button handlers check `getIsAnimating()` (`app.js` 627, 719, 779) but **the touch handlers never do**, so a user can turn a face in the middle of solve playback. The solver keeps applying its remaining moves to a cube that changed underneath it, and `onUserMove` (`app.js` ~710-715) drops the turn from the step session because it is gated on `!isAutoSolving`. The session silently desynchronizes from the cube.

### 1.4 Separate bug found while investigating

`src/app.js` ~2128:

```js
const rotationLayer = touchState.selectedLayer || faceInfo.layer;
```

`selectedLayer` of `0` is the middle slice and is falsy, so middle-slice turns silently fall through to the wrong layer. Same pattern on the line above for `selectedAxis` (safe today — axis is a string — but equally fragile). Fix with `?? ` / explicit `null` checks.

---

## 2. Decisions

Each row records what was chosen, and what was rejected and why. Full rationale is in the session that produced this doc; the short forms below are what an implementer needs.

### 2.1 Two touch gestures overlapping → **deferred start**

The in-flight snap always finishes its ease. The new gesture is captured immediately (highlight, face detection, finger tracking) but its rotation group is created only at hand-off, and drag movement that happened before hand-off is **discarded**.

- Rejected **preempt** (instantly commit the in-flight turn): produces a visible pop as the face jumps to 90°. Explicitly not wanted.
- Rejected **reject** (ignore input during the snap): a 200ms dead zone drops legitimate fast chained turns.
- Rejected **queue**: replaying a gesture against a cube that already moved is disorienting.
- Rejected **replaying** the discarded pre-hand-off movement: it relocates the pop to the new face and can make it larger.

### 2.2 Concurrency policy lives in a new pure module

New file `src/controllers/turnArbiter.js`. **Zero THREE.js dependencies**, unit-testable with `node tests/test-turn-arbiter.js`, matching the pattern `arcballRotation.js` states explicitly in its header and `cubeState.js` follows.

Returns a structured verdict `{ allowed, reason }` rather than a boolean, so the UI can explain a refusal and so new verdicts can be added later without changing call sites.

**Scope: policy only.** The deferred-gesture buffer (pending face, axis, hand-off timing) stays in `app.js`. Accepted consequence: the deferred-start *behavior* is not unit tested — only the decision that precedes it.

- Rejected a lock inside `cube.js` (grows a class that already owns state, geometry and animation; not node-testable since cube.js imports THREE).
- Rejected module-level booleans in `app.js` (exactly the pattern that caused this bug).

### 2.3 Input during solve/scramble is **rejected**, and a Stop button is added

User input is never absorbed into a running solve or scramble, and never aborts it implicitly. Instead:

- While any programmatic sequence animates, **Scramble / Solve / Reset are hidden and a Stop button appears in their place.**
- When the sequence finishes (or is stopped), Stop disappears and the three buttons return.

`UIController.disableButtons()` / `enableButtons()` (`src/controllers/uiController.js` 36-49) already gate exactly those three buttons on exactly this lifecycle, so they become `enterBusyMode()` / `exitBusyMode()` and every existing call site already fires at the right moment.

- Rejected **abort-and-hand-over** on touch (the tester's call: a stray finger should never derail a solve).

### 2.4 Stop **halts**; the in-flight move completes

Pressing Stop lets the current move finish its animation, then the sequence stops. The cube is left partway through the solution.

**This is much cheaper than it first appears.** All three animated sequences are JavaScript callback chains, **not** consumers of `cube.js`'s `animationQueue`:

- `playMove` → callback → `playMove` — `app.js` ~761-772
- `playNext` → callback → `playNext` — `app.js` ~655-671
- `doNextMove` → callback → `doNextMove` — `cube.js` ~351-361

`animationQueue` only catches moves pushed *while* one is animating, which these never do. So Stop is a `stopRequested` flag checked at the top of each continuation: the in-flight move completes via its own callback, and the chain then declines to schedule the next. No queue surgery.

- Rejected **skip-to-end** (drain remaining moves instantly so the cube ends solved): that is a fast-forward, not a stop. If impatience turns out to be the real driver, add a separate ⏭ control — do not overload Stop.
- Rejected **hard stop mid-animation**: leaves a face at a non-90° angle, which is an illegal state and the same class of corruption being fixed.

### 2.5 After a halt: invalidate

On Stop: call `invalidateStepSession()` and clear `rubiksCube.moveHistory`.

Two things desynchronize on a halt:

- **`moveHistory`** — solve moves run with `record = false` (`app.js` ~769) and history is only cleared on successful completion (~752). Harmless in practice: `history` is in the strategy contract (`solverStrategy.js:7`) but **no solver implementation reads it**, and `stepSession` passes `history: []` outright (`stepSession.js:88`, `:130`). Clear it anyway.
- **`stepSession`** — real. `playStepJump` calls `stepSession.goTo(target)` *before* animating (`app.js` ~632), so the session commits to the destination up front. Halt midway and the session believes the cube is at `target` while it is physically between stages, and every later rewind plans from a false premise.

- Rejected **tracking partial position**: `stepSession` has no representation for a mid-stage position, and adding one is new modeling in a BFS-verified, test-gated module riding on a UI change.
- Rejected **halting at stage boundaries**: keeps the session exactly valid but Stop can take seconds to respond during a long stage.

### 2.6 Always-on 27-cubie invariant, **log only**

Every frame in the render loop (`app.js` ~2342), assert that `cubeGroup` has exactly 27 cubies beneath it. On failure, log once with the count and which rotation path is active. Cost is negligible next to the THREE render it sits beside.

**No self-healing.** Orphaned cubies are stranded at an arbitrary partial angle, so a heal would have to invent a final angle and bake it in — which can leave `cubeState` disagreeing with what is drawn. A cube that *looks* right while its logical state is wrong makes the next Solve produce a solution that does not match the screen: a quiet correctness bug that discredits the solver, which is strictly worse than a loud rendering bug.

- Rejected debug-panel-only (production stays silent; users just file the same report again).

### 2.7 Verification

- **Node test** for `turnArbiter` policy — the full matrix, in the existing `node tests/*.js` style.
- **Runtime invariant** as above.
- **Playwright MCP session per PR** — the MCP server is configured and live in `.mcp.json`. Drive scripted two-finger sequences via `browser_evaluate` dispatching `TouchEvent`s with controlled interleaving, and assert the invariant plus cube-state legality. Serve through a `rubiks-cube` directory or symlink, not the repo root, or `<base href>` 404s everything.
- **Tester confirms on their device.** Load-bearing, not a formality — synthetic `TouchEvent` dispatch is more adversarial than a thumb but is not iOS Safari.

**Capture a failing baseline against `main` first.** Without a red run that trips the invariant, a green Playwright run after the fix proves very little.

- Deferred: a CI-gated E2E harness. It would mean adding `package.json`, npm and CI to a deliberately dependency-free repo. Logged as follow-up.

---

## 3. Branch and PR plan

Two independent tracks (per `git-branch-workflow`: always a feature branch and a PR, never direct to `main`).

**Track A — `feat/stop-button` → `main`, standalone.**
Section 2.3 + 2.4 + 2.5. Barely overlaps the concurrency work (different files, different functions), has immediate user-visible value, and should not be parked behind a concurrency refactor's review.

**Track B — stacked.**

1. `fix/turn-concurrency` (cut, current) — sections 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.6, 2.7.
2. Unification PR stacked on top of it — merge the duplicated touch and mouse rotation paths (`app.js` ~889-1042 vs ~1577-1756) into one gesture controller. **PR checklist must explicitly confirm the §1.4 falsy-zero fix survives**, since it lives on a line this PR rewrites.

`gh stack` exists but only as an extension — `gh extension install github/gh-stack`. Without it, stack manually with `gh pr create --base fix/turn-concurrency`.

---

## 4. Implementation order on `fix/turn-concurrency`

Ordered so the first commit is the actual reported bug and is independently verifiable.

**Commit 1 — orphan and closure fixes.** The correctness floor. After this the cube can no longer be corrupted, though a preempted gesture may still pop.

Suggested shape, shared by both the touch and mouse paths (fixing the same defect twice is more code than sharing one helper, so this modest overlap with the unification PR is deliberate):

```js
// Rotation groups handed off to a snap animation. No longer the live gesture,
// but they still own their cubies, so they must be settled before any new
// group is built from those same cubies.
let pendingSettlements = [];

// Reparent a group's cubies into cubeGroup at snapped positions, remove the
// group, record the move. Idempotent - a context that already settled is
// ignored, so a preempted snap animation cannot settle a second time.
function settleRotationGroup(ctx, finalAngle) {
    if (!ctx || ctx.settled || !ctx.group) return;
    ctx.settled = true;
    // ...apply finalAngle on ctx.axis, reparent children, recordMove(ctx.axis, ctx.layer, dir)
}
```

- `completeFaceRotation()` moves the live group out of `touchState` into a local `ctx = { group, axis, layer, angle, settled: false }`, **nulls `touchState.rotationGroup` / `swipeAxis` / `swipeLayer` / `currentRotation` immediately**, then animates `ctx` and calls `settleRotationGroup(ctx, snapAngle)`. The closure touches only `ctx`. This alone fixes §1.2 and stops new gestures from seeing a settling group.
- `startFaceRotation()` settles any pending contexts before building a new group, instead of removing it. This fixes §1.1.
- Mirror both in `completeModifierFaceRotation` / `startModifierFaceRotation`.

**Commit 2 — `turnArbiter.js` + `tests/test-turn-arbiter.js`.** Pure policy, no wiring yet. Matrix: touch↔touch → defer; touch↔mouse → defer; any user input↔programmatic → reject with reason.

**Commit 3 — wire the arbiter into the touch and mouse entry points**, including the missing `getIsAnimating()` check that lets turns land mid-solve.

**Commit 4 — deferred-start buffer.** Hold the captured gesture until pending settlements complete, then create the group and begin tracking from the current finger position, discarding movement during the wait. This is what removes the pop left by commit 1.

**Commit 5 — invariant logging** in the render loop.

**Commit 6 — §1.4 falsy-zero `selectedLayer` fix.**

---

## 5. Open items and risks

1. **Open — the step sheet's own play button.** `stepPlayBtn` (`app.js` ~527) is not covered by `disableButtons()`, so it sits outside the Stop swap. Decide during Track A: fold it into busy-mode, or leave it governed by `isAutoSolving` as today. Never put to the user.
2. **Risk — the deferred-start buffer has no automated coverage.** Accepted when the arbiter was scoped to policy only. The Playwright session and the tester's device are the only checks on the behavior that actually fixes the reported bug.
3. **Risk — no CI gate before the unification PR**, which rewrites both rotation paths and is the most likely place to reintroduce orphaning. The always-on invariant log is the sole backstop. Owner: whoever reviews that PR, explicitly.
4. **Risk — synthetic touch fidelity.** See §2.7; device confirmation is required, not optional.

---

## 6. Note for whoever picks this up

The tester's gesture is the app's **intended** turn gesture — one finger locks the cube, the other swipes a face (`app.js` ~1970-2017). This is a first-class interaction, not an edge case, and the fix should be judged on how it feels under fast repeated two-finger turns, not just on whether the invariant holds.
