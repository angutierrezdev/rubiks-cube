# Rubik's Cube 3x3 — Complete Solution Algorithms (Layered Method)

This document describes the beginner Layer-by-Layer method as implemented by the
app's **Layered Method** solver (`src/strategies/layeredMethodSolver.js`). Every
algorithm below was verified against the cube model by the test suite
(`node tests/test-solver.js`), which solves 500 random scrambles with them.

## Notation

- U = Up, D = Down, L = Left, R = Right, F = Front, B = Back
- `'` = counterclockwise turn, `2` = turn twice (180°)
- Each move is a ¼ turn unless marked with 2
- Hold the cube **white face down** from the White Cross stage onward
  (yellow ends up on top for the final layer)

---

# LAYER 1 — WHITE LAYER

## Step 1 — Create the Daisy

Bring all four white edges to the top face, around the yellow center
(petals of a "daisy"). No fixed algorithm is needed — use these case rules:

- **White edge in the top layer, white sticker facing sideways:** turn that side
  face once to drop the edge into the middle layer, then continue below.
- **White edge in the middle layer:** turn the side face the white sticker is
  *not* touching, in the direction that lifts the edge to the top. If that would
  knock out an existing petal, first turn U to move the petal out of the way.
- **White edge in the bottom layer, white sticker facing down:** turn U until the
  top slot above it is free, then turn that face twice (e.g. `F2`).
- **White edge in the bottom layer, white sticker facing sideways:** turn that
  side face once to bring it to the middle layer, then continue as above.

## Step 2 — Create the White Cross

For each daisy petal: turn **U** until the petal's side color matches the center
below it, then turn that face twice:

    F2

(Repeat for all 4 white edges. The white cross forms on the bottom.)

## Step 3 — Solve White Corners

Find a white corner in the top layer and turn **U** until it sits directly above
its home slot (its home is between the two side centers matching its colors).
Then, depending on where the white sticker faces:

### White sticker facing FRONT

    F' U' F

### White sticker facing RIGHT

    R U R'

### White sticker facing UP

    R F R2 F' R'

### Corner already in the bottom layer, but wrong slot or twisted

Pop it out first, then place it with a case above:

    R U R'    (with the corner at the front-right; adapt the face to its position)

---

# LAYER 2 — MIDDLE LAYER

(White face on the bottom.) Find an edge with **no white and no yellow** in the
top layer. Turn **U** until its side sticker matches the center it faces.
Then insert it toward the slot that matches its top sticker:

## Moving Edge to the RIGHT

    U R U' R' U' F' U F

## Moving Edge to the LEFT

    U' L' U L U F U' F'

**Edge stuck in the middle layer (wrong slot or flipped):** run the RIGHT insert
on that slot to eject it into the top layer, then insert it properly.

---

# FINAL LAYER — YELLOW LAYER

## Step 1 — Make the Yellow Cross

    F R U R' U' F'

Apply with the current pattern positioned as follows, repeating as needed:

- **Dot (no yellow edges up):** apply once, then continue.
- **L-shape:** turn U so the two yellow edges point to the back and left, apply.
- **Line:** turn U so the line runs horizontally (left–right), apply.

## Step 2 — Orient Yellow Corners

Hold the cube with an unoriented corner (yellow not facing up) at the
**top-front-right** and repeat until its yellow sticker faces up:

    R' D' R D  R' D' R D

Then turn **U** (only U!) to bring the next unoriented corner to the
top-front-right and repeat. The bottom layers look scrambled during this step —
they restore themselves once **all** corners are oriented.

## Step 3 — Position Yellow Corners

Check whether each corner sits between the side centers matching its colors
(turn U first to line up as many as possible).

### Three corners need to cycle (one is already correct)

Hold the correct corner at the **top-front-left** and apply (up to 2×):

    R' F R' B2 R F' R' B2 R2

### Two corners are swapped

Hold the two swapped corners on the **right side** and apply the T-perm,
then re-check (a cycle case may remain):

    R U R' U' R' F R2 U' R' U' R U R' F'

## Step 4 — Position Yellow Edges

Hold an already-correct edge at the **back** and apply (up to 2×):

    R U' R U R U R U' R' U' R2

If **no** edge is correct, apply the algorithm once from any side, then re-check.

---

# Summary of Core Algorithms

  Stage                     Algorithm
  ------------------------- ------------------------------------
  White Cross (insert)      F2
  White Corner (front)      F' U' F
  White Corner (right)      R U R'
  White Corner (up)         R F R2 F' R'
  Middle Right              U R U' R' U' F' U F
  Middle Left               U' L' U L U F U' F'
  Yellow Cross              F R U R' U' F'
  Orient Yellow Corners     R' D' R D (repeat in pairs)
  Cycle Yellow Corners      R' F R' B2 R F' R' B2 R2
  Swap Yellow Corners       R U R' U' R' F R2 U' R' U' R U R' F'
  Cycle Yellow Edges        R U' R U R U R U' R' U' R2
