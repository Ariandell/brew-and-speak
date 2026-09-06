# Scene extension point

The product has no route-transition animation at this stage. Screens never
import Three.js and never address bones, materials, shaders, or cameras.

The only supported bridge is `ui/SceneProvider.tsx`:

- `setPose()` places the persistent mascot;
- `express()` changes a lightweight facial mood;
- `lookAt()` lets the scene acknowledge a meaningful UI target.

A future Blender animation system must be implemented behind this bridge (or a
new command added to the same bridge). It must not move navigation, scoring,
homework, or route state into the scene layer. The removed hand-wipe prototype
must not be copied back into product screens.
