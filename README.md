# Single-Phase Induction Motor Lab

An interactive learning app for undergraduate electrical-engineering students. It shows how a single-phase induction motor is built, why it cannot start by itself, how an auxiliary winding and a capacitor fix that, what the torque and current curves look like, and what happens to the motor when something fails.

Everything runs in the browser. There is no backend, no account, no external API and no analytics.

Stack: React 19, TypeScript, Vite 8, three.js through React Three Fiber (3D), vitest (tests).

## Quick start

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload at http://127.0.0.1:5173 |
| `npm test` | Runs the unit tests once (`vitest run`, Node environment, no browser needed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Type-checks, then writes the production site to `dist/` |
| `npm run preview` | Serves `dist/` at http://127.0.0.1:4173 |

**Requirements.** Node.js 22.12 or newer with npm, and a current Chrome, Edge, Firefox or Safari. WebGL is needed for the 3D model only; without it the explorer shows a flat 2D cut-away and everything else works the same.

**Deploying.** `dist/` is a static site with relative URLs and a hash router, so it can be copied into any folder of any web server (a course site, an LMS file area). Serve it over HTTP (`npm run preview`, or any static server); most browsers refuse to run module scripts from a `file://` page.

**GitHub Pages.** `.github/workflows/deploy.yml` installs, tests, builds and publishes `dist/` on every push to `main`. Once per repository, open Settings > Pages and set the source to **GitHub Actions**; the site then appears at `https://<owner>.github.io/<repo>/`. No `base` setting is needed. The workflow uses the current major versions of GitHub's own actions (`checkout`, `setup-node`, `upload-pages-artifact`, `deploy-pages`) on Node 22. On GitHub Enterprise Server, check each action's compatibility table and pin an older major version if your server needs it.

**Notes**

- Port 5173 busy: `npm run dev -- --port 5174`.
- `package-lock.json` points at `registry.npmjs.org`. If your network uses a registry mirror, npm substitutes it automatically (the default `replace-registry-host=npmjs` setting); `npm ci` was verified this way.
- vitest 5 officially supports Node 22, 24 and 26+. On Node 25 `npm install` prints an `EBADENGINE` warning for vitest; the tests still run (the suite was developed on Node 25.4.0, npm 11.7.0).
- The browser console shows one `THREE.Clock` deprecation warning on the 3D page. It comes from inside `@react-three/fiber` 9.8.2 and is harmless.

## What is in the app

Sections are listed in the left navigation and are reachable by URL hash (`#/lab`). The suggested route is **Explore → Field → Starting → Simulate → Faults → Test**; the navigation marks visited sections with a tick.

| # | Section | What you do there | What you learn |
| --- | --- | --- | --- |
| 1 | **Motor overview** `#/overview` | Follow the story from socket to shaft (animated energy chain), try the N<sub>s</sub> and slip calculator, see the two-current idea, jump to any part | One supply, one pulsating field, no starting torque; N<sub>s</sub> = 120 f / P; slip |
| 2 | **3D motor explorer** `#/explorer` | Explode the motor (assembled, partly, fully, or a slider), orbit/zoom, hover or click any of 14 components, isolate one, make the housing transparent, toggle labels, search the parts list | What each part is, what it does, what fails in it. A flat 2D cut-away replaces the 3D view without WebGL |
| 3 | **Cross-section & field** `#/field` | Animated stator and rotor cross-section with a mode selector. Main winding alone (pulsating field), the same field split into forward and backward rotating halves, then two windings with adjustable currents, phase displacement and axis angle; give the rotor a speed to see the forward and backward torques | Pulsating field, double-revolving-field theory, why the standstill torque is zero, how a time and space shift makes a rotating field |
| 4 | **Starting methods** `#/starting` | Compare split-phase, capacitor-start, permanent-split-capacitor (PSC), capacitor-start capacitor-run (CSCR) and shaded-pole motors; watch a start-up with the centrifugal switch opening | Trade-offs between starting torque, starting current, running behaviour and cost |
| 5 | **Physics lab** `#/lab` | Change frequency, poles, voltage, load torque, inertia, damping, starting method, capacitance, auxiliary resistance and switch cut-out; read N<sub>s</sub>, slip, speed, currents, power factor, efficiency; plot speed against time, torque against speed, current against speed | The equations in action; how each parameter moves the curves |
| 6 | **Fault simulator** `#/faults` | Pick one of 15 failures (shorted turns, shorted core laminations, ground fault, open or weak capacitor, open auxiliary winding, stuck centrifugal switch, open main winding, broken rotor bars, bearing wear, locked rotor, low voltage, overload, blocked cooling), set its severity, and compare the healthy and faulted motor: speed, current, temperature, protection response, time to damage | Symptoms, causes, protection (breaker, thermal protector, RCD) and how heat destroys insulation. A safety note sits at the top |
| 7 | **Guided experiments** `#/experiments` | Eight experiments in four steps: predict (choose an outcome), run it (buttons open the lab or the field section with the settings pre-loaded), observe the model's numbers, read the explanation | Predicting what a parameter change does |
| 8 | **Knowledge check** `#/quiz` | 18 questions in 6 topics: single choice, multiple choice and numeric. Marked answers with explanations, score by topic, and a review of every missed question with a link to the section that teaches it | Self-assessment |
| 9 | **Formulas & glossary** `#/reference` | Search 18 formulas (each with symbols, conditions and a worked example from the example motor, and a "try it" link) and 41 glossary terms | A single quick reference |

### Across the whole app

- **Beginner / Detailed** toggle in the top bar. Beginner gives plain-language explanations; Detailed adds equations, assumptions and nuance. The choice is remembered.
- **Pause animations** button in the top bar. If your system asks for reduced motion the app starts paused and smooth scrolling is off. Everything also works with the animation paused.
- **Tooltips** on technical terms (dotted underline): hover, keyboard focus or tap opens a short definition from the glossary.
- **Colour-independent encoding.** Chart lines also differ by dash pattern, markers by shape, bands by hatching, and the series are labelled directly; status is shown with words and symbols as well as colour.
- **Reset** button on every simulation and control panel (and **Clear search** in the reference).
- **Empty, loading and error states.** Sections load lazily with a loading message; each section has its own error boundary; invalid or out-of-range numeric input is explained and clamped; empty searches say so; a missing WebGL context or a lost one switches to the 2D view.
- **Persistence (localStorage only):** `splm.prefs` (explanation level, paused), `splm.progress` (visited sections, finished experiments, quiz result, predictions), `splm.expSelected` (selected experiment). **Reset my progress** in the navigation clears the progress.
- **Keyboard and semantics.** Skip link, landmarks, native form controls (the segmented buttons are radio groups), visible focus, `aria-live` regions for results. The 3D scene takes the arrow keys to rotate, plus and minus to zoom and Home to reset the camera; components can be selected from a list without the mouse.
- **Layout.** Designed for desktop and tablet widths (verified at 1500 and 820 px wide).

## Physics models

Every section that shows a model carries a badge that says what kind it is:

- **Visual illustration:** drawn to explain, with exaggerated sizes and speeds; carries no measurements (3D model, cross-section, field arrows).
- **Simplified analytical model:** equations with stated assumptions and example (not real-motor) parameters.
- **Numerical calculation:** values the program computes by stepping the model equations (speed against time, heating).
- **Qualitative explanation:** expected trends only, with no numbers computed (for example shaded-pole motors).

Simulation code is in `src/simulations/` as pure functions with no React or DOM, so it is tested on its own. Explanations never claim more than the model supports.

### Speed and slip

```
N_s = 120 f / P                       synchronous speed [rpm]      (P = number of poles)
ω_s = 4π f / P                        synchronous speed [rad/s]
s   = (N_s − N_r) / N_s               slip of the forward field
N_r = N_s (1 − s)
s_b = 2 − s                           slip of the backward field
```

### Field illustration (`field.ts`, section 3)

Two windings with axes γ apart (default 90 electrical degrees) carry `i_m = I_m cos ωt` and `i_a = I_a cos(ωt + φ)`. Each makes a sinusoidally distributed pulsating field, so the flux density around the air gap is

```
b(θ, t) = i_m cos θ + i_a cos(θ − γ)
```

Written as two circular fields turning in opposite directions, `b = C₁ e^{+jωt} + C₂ e^{−jωt}` with

```
C₁ = (B_m + B_a e^{j(γ+φ)}) / 2        (counter-clockwise)
C₂ = (B_m + B_a e^{j(γ−φ)}) / 2        (clockwise)
```

With the main winding alone (`I_a = 0`) the two have equal size `B_m/2`: they cancel at standstill. With equal amplitudes and `γ = φ = 90°`, `C₂ = 0`: a pure rotating field. Angles are electrical degrees, flux is in relative units, and the animation is slowed (0.05 to 1 cycle per second, against 50 or 60 for the real supply).

### Equivalent circuit (`motorModel.ts`, sections 4 to 7 and the curves)

The standard **double-revolving-field equivalent circuit**, referred to the main winding. Reactances are given at 60 Hz and scale in proportion to frequency; resistances do not.

```
Z_F = jX_m ‖ (R_2/s + jX_2)           forward rotor-side impedance (full value)
Z_B = jX_m ‖ (R_2/(2−s) + jX_2)       backward rotor-side impedance
Z_1m = R_1m + jX_1m                   main-winding stator impedance
```

**Main winding only.**

```
I_m = V / (Z_1m + ½ (Z_F + Z_B))      I_f = I_b = I_m / 2
T_f = 2 R_F |I_f|² / ω_s              T_b = 2 R_B |I_b|² / ω_s         R_F = Re Z_F, R_B = Re Z_B
T   = T_f − T_b
```

At standstill `s = 1`, so `Z_F = Z_B` and `T = 0`: the idealised main-only motor has no starting torque (a unit test checks this). Spun in either direction, the field that turns with the rotor wins and the motor keeps running that way.

**With an auxiliary winding** (split-phase: extra resistance; capacitor-start and PSC: capacitor in series). The auxiliary branch has impedance `Z_aux = R_aux + j(X_1a − X_C)` on its own turns, `X_C = 1 / (2π f C)`, and `a` is the auxiliary-to-main effective turns ratio. Referred to the main turns, `Z_a' = Z_aux / a²` and `V_a' = V / a`. The two windings are solved with symmetrical components:

```
V_F = (V − jV_a')/2    V_B = (V + jV_a')/2
Z_s = (Z_1m + Z_a')/2  Z_d = (Z_1m − Z_a')/2

V_F = (Z_s + Z_F) I_F + Z_d I_B
V_B = Z_d I_F + (Z_s + Z_B) I_B             solved as a 2 × 2 complex system

I_m = I_F + I_B          I_a' = j (I_F − I_B)          I_aux = I_a' / a
T_f = 2 R_F |I_F|² / ω_s     T_b = 2 R_B |I_B|² / ω_s
```

Reversing the auxiliary leads flips the sign of `a` and the motor runs the other way.

**Power and derived quantities.**

```
I_line = I_m + I_aux                       P_in = V Re(I_line)             PF = P_in / (V |I_line|)
P_mech = (1 − s)(P_F − P_B)                P_rotor-cu = s P_F + (2 − s) P_B
Shaft power = T_load ω                     Efficiency = shaft power / P_in
```

Breakdown torque is the largest net forward torque on a 400-point sweep of the forward speed range.

### Speed against time (`dynamics.ts`)

```
J dω/dt = T_motor(ω) − T_load − B ω
```

`T_motor(ω)` is a torque table of 400 intervals from −N_s to +N_s built from the exact solution above, interpolated linearly. Integration is 4th-order Runge-Kutta with a step of at most 1 ms and always small enough that `dt · |λ| ≤ 0.4` (λ is the steepest slope of the torque curve divided by J), so it is stable over the whole control range. The **centrifugal switch** opens when the speed passes the cut-out fraction of N<sub>s</sub> (default 75 %) and closes again if the speed falls 10 % of N<sub>s</sub> below it (hysteresis). A PSC motor has no switch. The outcome of a start is classified as settles, does not start, stalls, cycles (switch opens and re-closes) or still accelerating.

### Starting methods (`starting.ts`, section 4)

Split-phase, capacitor-start and PSC use the same circuit and the same simulated start-up as the lab. **CSCR** is analytical only: the standstill point with both capacitors in circuit and the PSC curve for running; its switch-over is not simulated, so no claim is made about it. **Shaded-pole** is explained qualitatively and is not part of the numeric comparison.

### Fault model (`faults.ts`, section 6)

First-order, illustrative models: they show the *direction and relative size* of effects, not predictions for a real machine.

- Electrical effect of each fault on the same equivalent circuit (for example open capacitor = no auxiliary branch, locked rotor = forced zero speed).
- Closed-form fault formulas:
  - Shorted turns: the bypassed fraction `k` of the turns acts as a shorted transformer secondary. `I_loop = kV / |Z_loop|`, `Z_loop = (k r₁ + R_f) + j k² x₁`, heat `P = I_loop² (k r₁ + R_f)`.
  - Shorted core laminations: extra iron loss = base core loss × affected fraction × 20 (eddy loss grows with the square of the conducting thickness, capped by skin effect).
  - Ground fault: `I = V / (R_fault + R_winding)`.
- A **lumped three-node thermal model** (winding, hot spot, core and frame) with explicit Euler integration, a thermal protector that opens at 120 °C and resets at 85 °C, a 130 °C insulation rating, and a 200 °C destruction limit where the run stops. A hot spot is a fraction of its host with a thermal resistance proportional to `f^(−1/3)`. A closed-form steady-state solution is the oracle the simulation is tested against.
- A 15 A thermal-magnetic breaker curve (instantaneous at 5 times the rating, inverse-time below, no trip at or below 105 %) and a 30 mA residual-current device.
- Insulation life: 20 000 h at 130 °C, halving for every 10 K above it (the "10-degree rule"). It describes slow ageing only, not arcing or sudden breakdown.

### Example motor and default operating point

Illustrative values of the right order of magnitude for a small 120 V, 60 Hz, 4-pole motor of about a quarter of a horsepower. They are **not** from a datasheet, and real motors vary widely.

| Symbol | Value | Meaning |
| --- | --- | --- |
| r<sub>1m</sub> | 2.5 Ω | Main-winding resistance |
| x<sub>1m</sub> | 4.1 Ω | Main-winding leakage reactance at 60 Hz |
| x<sub>m</sub> | 72 Ω | Magnetising reactance at 60 Hz |
| r<sub>2</sub> | 3.5 Ω | Rotor resistance referred to the main winding |
| x<sub>2</sub> | 2.2 Ω | Rotor leakage reactance at 60 Hz, referred |
| r<sub>1a</sub> | 11.8 Ω | Auxiliary-winding resistance |
| x<sub>1a</sub> | 3.6 Ω | Auxiliary-winding leakage reactance at 60 Hz |
| a | 1.15 | Auxiliary-to-main effective turns ratio |

Defaults of the Physics lab: 60 Hz, 4 poles, 120 V, load 0.8 N·m, inertia 0.005 kg·m², damping 0.0003 N·m·s/rad, capacitor-start with 150 µF, cut-out at 75 % of N<sub>s</sub>. At these settings the app shows about 1746 rpm (slip 3.0 %), 3.3 A running current, 3.39 N·m starting torque at 16 A, a breakdown torque near 2.8 N·m, power factor 0.52, shaft power 146 W, input 206 W and efficiency 71 %.

Allowed ranges in the lab: frequency 40 to 70 Hz, voltage 60 to 140 V, load 0 to 3.5 N·m, inertia 0.001 to 0.05 kg·m², damping 0 to 0.003 N·m·s/rad, capacitance 5 to 400 µF, auxiliary resistance 3 to 25 Ω, cut-out 50 to 90 % of N<sub>s</sub>, 2, 4, 6 or 8 poles. Values outside a range are clamped and the app says so.

### Assumptions and limitations

- Parameters are constant: no magnetic saturation, no skin effect in the rotor bars, no temperature dependence of resistance.
- Reactances are proportional to frequency (constant inductance); resistances are not.
- Iron loss, windage and bearing loss are not in the lab model (only viscous friction `B` and the load). The efficiency shown is therefore an upper estimate.
- Quasi-static: currents are the steady-state phasor values at the instantaneous speed, and electrical transients are ignored. The torque pulsation at twice the supply frequency is not shown.
- The load is a constant torque opposing rotation. Real fans, pumps and compressors have other torque-speed shapes.
- The centrifugal switch and the capacitor are ideal; a capacitor has no loss or voltage limit.
- No space harmonics, no slot effects, no unbalance between the two windings beyond the turns ratio.
- The fault numbers are illustrative; heat capacities, thermal resistances and protection curves are plausible round values, not measurements.
- Speeds are limited to −N<sub>s</sub> to +N<sub>s</sub>.
- This is an educational tool, not a design or diagnostic tool, and nothing in it is a substitute for qualified electrical work.

## Tests

`npm test` runs 175 tests in 12 files (about a second). They cover the maths and the content that depends on it.

| File | Tests | What it checks |
| --- | --- | --- |
| `motorModel.test.ts` | 27 | N<sub>s</sub> = 120 f / P, slip, input validation and clamping, **zero net torque at standstill for the ideal main-only model**, torque direction when spun either way, V² scaling, winding-voltage and energy-balance checks of the two-winding solution, capacitor-start > split-phase > PSC starting torque, reversal with swapped leads, finite results over the whole control range |
| `dynamics.test.ts` | 15 | Torque table, centrifugal switch with hysteresis, start-up outcomes of the example motor, **stability over the allowed control range**, current waveforms |
| `field.test.ts` | 12 | Double-revolving-field decomposition, field torques, rotor-bar EMF |
| `starting.test.ts`, `startingContent.test.ts` | 10 + 7 | Method comparison, running operating point, content and circuit geometry |
| `faults.test.ts`, `faultContent.test.ts` | 22 + 12 | Breaker and RCD, closed-form formulas, thermal model against its closed-form steady state, every scenario, report text, chart helpers (axis ticks, label overlap avoidance) |
| `experiments.test.ts` | 17 | Every claim in each experiment's text is true of the model |
| `quiz.test.ts` | 22 | Question integrity, numeric answers against the model, parsing typed numbers, **marking and scoring** (single, multiple, numeric) |
| `reference.test.ts` | 19 | Every worked example re-computed from its printed arithmetic, against hand calculations and the model; formula and glossary search |
| `overview.test.ts`, `sections.test.ts` | 9 + 3 | Overview content, section order, reverse running |

The worked examples in the formula sheet, the quiz answers and the experiment texts are all checked against the same model code, so the explanations cannot drift away from the simulation.

## Project structure

```
index.html
vite.config.ts            Vite + vitest configuration
.github/workflows/        deploy.yml: test, build and publish to GitHub Pages
src/
  main.tsx, App.tsx       entry point, shell and navigation
  state.tsx               preferences, progress, hash router, hand-offs between sections
  simulations/            pure physics: complex, motorModel, dynamics, metrics, field, starting, faults, experiments
  content/                text and data: sections, components, glossary, formulas, startingMethods, faults, experiments, quiz
  components/             shared UI: controls, charts, badges, tooltips, equation text, error boundary
  scenes/                 3D scene (React Three Fiber) and the 2D cut-away
  sections/               one file per section, with a sub-folder for its parts
  styles/                 global.css and sections.css
  tests/                  vitest tests
```

## Assets and licences

- **No external assets.** There are no images, icons, fonts, audio, videos or 3D model files. The 3D motor is built in code from three.js primitives, the diagrams and charts are inline SVG, the favicon is an inline SVG data URL, and text uses system font stacks (`system-ui`, `Cambria Math`, `ui-monospace`).
- **No network access at run time.** The source makes no `fetch` or XHR calls and loads nothing from a CDN or web font service.
- **Open-source dependencies** (production dependency tree, 66 third-party packages): MIT 57, Apache-2.0 5, ISC 3, BSD-3-Clause 1. The main ones are `react` and `react-dom` (MIT), `three` (MIT), `@react-three/fiber` and `@react-three/drei` (MIT). `webgl-constants` ships an MIT `LICENSE` file although its `package.json` has no licence field. Several packages that `@react-three/drei` lists as dependencies (`hls.js`, `@dimforge/rapier3d-compat`, `@mediapipe/tasks-vision`, `draco3d`, …; Apache-2.0) are installed but not used by this app and do not appear in the built files. Development tools: `vite`, `vitest`, `@vitejs/plugin-react` (MIT), `typescript` (Apache-2.0).
- The motor parameters, the questions and all texts were written for this project.

## Privacy

No analytics, no tracking, no cookies, no requests to other servers. The only thing stored is your preferences and progress in your own browser's `localStorage` (keys above); **Reset my progress** removes the progress.

## Known limitations

- **Quiz:** questions and options always appear in the same order, retrying only the questions you missed does not change your best score (only a full attempt does), and multiple-choice questions are marked all-or-nothing.
- **Browsers:** checked in headless Chrome at 1500 × 1000 and 820 × 1100 only, not in Safari, Firefox or on a touch device. Narrow phone widths are not a target.
- **3D view:** needs WebGL. Without it, or if the graphics context is lost, the 2D cut-away is shown and the explorer says why.
- **Models:** see "Assumptions and limitations". The parameters are illustrative, so absolute numbers (rpm, amps, temperatures, minutes to failure) show trends, not a specific motor.
- **Shaded-pole motors** are explained qualitatively; **CSCR** has the analytical comparison only, with no simulated switch-over.
- The Node and `EBADENGINE` and `THREE.Clock` notes above.
