# Physics Calibration

This table records the deterministic gameplay calibration. SI units are used throughout. Gravity, atmosphere, ball dimensions/mass, table dimensions, cup dimensions, and the 120 Hz fixed step remain physical reference inputs; the remaining coefficients are empirical gameplay calibration around those references.

| System | Final value | Unit | Calibration rationale |
|---|---:|---|---|
| Gravity | 9.80665 | m/s² | Standard gravity; locked rather than exaggerated to shorten flight. |
| Air density | 1.225 | kg/m³ | Standard sea-level reference atmosphere. |
| Sphere drag coefficient | 0.47 | dimensionless | Standard smooth-sphere starting point; gives the 2.7 g ball visible but non-floaty speed loss. |
| Ball diameter / mass | 0.040 / 0.0027 | m / kg | Regulation ping-pong-ball references; locked. |
| Horizontal throw range | 0.90–10.50 | m/s | Covers controlled direct shots across the 2.44 m table without the previous excessive 12 m/s ceiling. |
| Vertical throw range | 1.35–3.35 | m/s | Produces approximately 0.09–0.57 m ballistic apex height: low shots remain usable and high arcs remain natural. |
| Power curve exponent | 1.25 | dimensionless | Adds fine control in the lower half while retaining full-power reach. |
| Solver speed envelope | 0.55 + 1.35 × power | m/s | Limits hidden solver correction while retaining 5 mm deterministic targeting precision. |
| Solver heading envelope | ±0.14 | rad | Keeps correction near the visible aim direction instead of silently searching a wide cone. |
| Default arc | 0.52 | normalized | Slightly favors a direct, readable flight while leaving the full arc range available. |
| Maximum commanded spin | 12.0 | rad/s | Gives readable curve and bounce influence without arcade-scale hooks. |
| Magnus acceleration factor | 0.0045 | calibrated | Paired with the 12 rad/s spin cap; maximum curvature stays below 5 cm over the regression flight segment. |
| Airborne spin decay | 1.1 | rad/s² | Retains useful spin through one throw while preventing long-lived residual rotation. |
| Table restitution | 0.80 | dimensionless | Retains the recognizable ping-pong rebound on a laminate game table without an excessive bounce chain. |
| Rim restitution | 0.60 | dimensionless | Makes rim deflections readable without repeated pinball-like rebounds. |
| Cup wall / floor restitution | 0.30 / 0.12 | dimensionless | Wall contact remains visible while the floor absorbs valid entries naturally. |
| Sliding friction | 0.24 | dimensionless | Provides controlled tangential/spin transfer without reversing ordinary angled impacts. |
| Rolling resistance | 0.018 | dimensionless | Removes long low-speed tails while preserving a short visible roll. |
| Horizontal stop speed | 0.022 | m/s | Settles motion below a visually meaningful threshold. |
| Table bounce cutoff | 0.40 | m/s | Suppresses sub-centimeter rebound tails after the primary table response. |
| Cup vertical stop speed | 0.035 | m/s | Settles captured balls promptly without swallowing energetic entries. |
| Surface contact tolerance | 0.00005 | m | Separates true supported contact from a descending ball near the top, preserving finite secondary bounces. |

## Determinism constraints

- No calibrated value introduces randomness.
- Prediction and live playback use the same `PhysicsWorld`, constants, and 120 Hz step.
- Difficulty does not modify gravity, ball properties, table physics, or collision rules for AI shots.
- Any future calibration change must update this table and `app/src/test/js/physics-calibration.test.js` together, then pass the complete deterministic regression suite.
