# 6Axis Animation: 3D Mathematical Visualization Tool

**6Axis Animation** is an interactive, web-based application for
visualizing complex mathematical functions and objects in a 3D space.\
It leverages **Three.js** for rendering and provides a powerful
interface for creating, animating, and exploring explicit surfaces,
parametric equations, vector fields, **linear algebra operations**, and
more.

------------------------------------------------------------------------

##  Features

###  Multiple Plotting Modes

-   **Playground**: A sandbox to add and manipulate multiple objects in
    the same scene.
-   **Linear Algebra (NEW)**: Dedicated interactive tool for exploring
    linear algebra concepts with step-by-step visualization of
    operations like projections, eigen decomposition, Gram--Schmidt, and
    more.
-   **Dedicated Modes**:
    -   Explicit Surfaces: `z = f(x, y)`
    -   Parametric Surfaces
    -   Parametric Curves
    -   Implicit Surfaces
    -   Vector Fields

### Rich Interaction

-   Full 3D camera controls (rotate, pan, zoom)
-   Hover inspection to read coordinate data
-   Real-time, LaTeX-style formula editing using **MathQuill**
-   Built-in calculator for complex math inputs

###  Customization & Appearance

-   Adjustable plot quality and density
-   Object opacity controls
-   Beautiful colormaps: Plasma, Viridis, Jet, and more
-   Toggle wireframe mode and axis/grid visibility

### Export & Share

-   Export current view as a **PNG**
-   Export selected objects as **.STL** or **.GLTF**
-   Save/load scene state as **.json**
-   Generate a shareable, compressed **URL** snapshot

###  Helpful UI

-   Step-by-step built-in **tutorial**
-   **Zen Mode** for distraction-free exploration

------------------------------------------------------------------------

## Animation Features

The app includes a powerful animation engine using a global time
variable `T`.

All animation is controlled through a right-hand **animation tray** with
individual and global controls.

### Animation Modes

####  V-Mode (Variable Animation)

Animate the **core geometry** of an object using the `T` variable. -
Example: `radius = 5 + sin(T)` for a pulsing sphere

####  P-Mode (Transform Animation)

Animate **Position, Rotation, and Scale** using math expressions
involving `T`. - Example: Orbit: `X = 10 * cos(T)`, `Y = 10 * sin(T)`

####  Physics Mode

A simple physics simulation between **waypoints**. - Customize `Mass`,
`Gravity`, and `Thrust = f(T)` - Example: Rocket:
`Thrust = if(T < 5, 2000, 0)`

### Playback Control

-   **Per-object** play/pause, reset, and loop toggles
-   **Global** play/pause/reset controls
-   Configure `T`: min, max, and speed

------------------------------------------------------------------------

## ➗ Linear Algebra Features

The new **Linear Algebra App** inside 6Axis Animation supports a wide
range of interactive operations:

-   Matrix Inverse: `inv(A)`\
-   Determinant: `det(A)`\
-   LU Decomposition: `lu(A)`\
-   QR Decomposition: `qr(A)`\
-   Gram--Schmidt Orthonormalization: `gramschmidt(...)`\
-   Projection: `proj(a, b)`\
-   Solve Linear System: `solve(A, b)`\
-   Eigenvalues & Eigenvectors: `eig(A)`\
-   Singular Value Decomposition: `svd(A)`\
-   Nullspace: `nullspace(A)`\
-   Rank: `rank(A)`\
-   Trace: `trace(A)`\
-   Transpose: `transpose(A)`\
-   Cross Product: `cross(a, b)`\
-   Dot Product: `dot(a, b)`\
-   Norm: `norm(a)`\
-   Identity Matrix: `eye(n)`\
-   Diagonal Matrix: `diag([...])`\
-   Random Matrix: `rand(m, n)`

All results are shown with **step-by-step LaTeX explanations** and **3D
visualizations**.

------------------------------------------------------------------------

##  How to Use

No installation required.

1.  Clone or download the repo\
2.  Open `index.html` in a browser (Chrome, Firefox, Edge)\
3.  Start plotting and animating!

### Navigation Between Apps

-   **3D Graphing ↔ Linear Algebra**: Use the top navigation tabs to
    seamlessly switch between the main 3D graphing application and the
    dedicated Linear Algebra visualization tool.\
-   Each app maintains its own state and provides specialized tools for
    its domain.

------------------------------------------------------------------------

## 📁 File Structure

  File                 Purpose
  -------------------- --------------------------------------------------
  `index.html`         Main layout and entry point
  `style.css`          UI styles and theming
  `app.js`             Core logic, event handling, Three.js setup
  `worker.js`          Web worker for heavy math computation
  `Linear_Algebra/`    **Linear Algebra App**
  ├── `index.html`     Linear algebra visualization interface
  ├── `app_clean.js`   Linear algebra logic and presets
  └── `presets/`       Collection of linear algebra demonstration files

------------------------------------------------------------------------

## Dependencies

Loaded via CDN:

-   **[Three.js](https://threejs.org/)** -- 3D rendering\
-   **[Tailwind CSS](https://tailwindcss.com/)** -- Utility-first
    styling\
-   **[Math.js](https://mathjs.org/)** -- Math parsing and evaluation\
-   **[MathQuill](http://mathquill.com/)** -- Rich formula editor\
-   **[jQuery](https://jquery.com/)** -- DOM utilities\
-   **[Pako](https://github.com/nodeca/pako)** -- Compression for
    sharable links

------------------------------------------------------------------------

## 📜 License

MIT --- feel free to use, modify, and share!
