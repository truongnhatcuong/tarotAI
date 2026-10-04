# Optional authored hand model

The 3D table ships with a procedural, rigged hand (`src/components/tarot3d/hand-rig.ts`),
so nothing here is required.

To use your own model instead:

1. Export a right hand + forearm as `public/models/hand.glb` (first-person, as seen from behind).
2. Orient it so that the **origin is the pinch point** (where thumb and index tips meet) and the
   **fingers point toward -Z** (away from the player), palm facing -Y.
3. Set `NEXT_PUBLIC_HAND_MODEL=1` in `.env` and restart the dev server.

A GLB is rendered as a static pose: it is moved, yawed and pitched along the same
approach → reach → grab → lift → move → place → release → retract path, and the carried card still
follows its origin. Finger curling only applies to the built-in rig.
