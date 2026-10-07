# Pinball physics and pacing calibration

Date: 2026-10-07. Baseline: PR #6 HEAD `1543fefd0f0b67b256116e3a375814fb04726b2f`.

## User request and observed cause

The user reported that the balls fell too quickly and named [Marble Roulette](https://lazygyu.github.io/roulette/) as the main reference. The desired interaction is a named-marble race with obstacles and lead changes, not a skill-driven flipper score game.

The prior renderer advanced simulation at 3× real time. In a 192-round baseline sweep, 405-candidate rounds had median simulated duration 5.18 seconds, only 1.73 seconds on screen before countdown. Their winning marble hit a median of three obstacles; one sampled winner hit none. Fast outer-wall corridors and high speed contributed alongside playback acceleration.

## Changes

- Real-time 1× playback using a tested fixed-step display clock; background resume is capped to avoid visually fast-forwarding the race.
- Two physics integrations per 60 Hz logical step, producing 120 Hz collision updates.
- Pre/post integration speed limit of 5.4 pixels per 60 Hz base tick. This is an arcade safety limit, not a claim of physically exact energy conservation.
- Apply and audit materials after static-body construction, because Matter.js resets restitution/friction during `setStatic`. Actual peg/bumper/paddle restitution is 0.32/0.58/0.38; marble restitution is 0.26, contact friction 0.00002 and air friction 0.006; gravity scale is 0.00046. Collision-pair restitution/friction and an upward bumper rebound are tested, not merely constructor settings.
- Alternating wall-side deflectors at heights 315/445/575; wall-flush bumpers at height 815; fewer but better-spaced top pegs; steeper alternating lower ramps.
- Motorized rotating paddles expose angular contact velocity, rather than only rotating their shape.
- Stable restaurant numbers/colors plus readable top-three names, impact rings and optional speed-sensitive bumper tones.
- A 24-second simulated bound remains as a disclosed fallback. No sampled race needed it.
- Frozen candidate snapshot, seed and engine state are shared by normal play and skip. Names/IDs never drive physics. No equal-odds guarantee is made.

## Sources and adaptation

- [Marble Roulette demo](https://lazygyu.github.io/roulette/) and [its physics source](https://github.com/lazygyu/roulette/blob/main/src/physics-box2d.ts): named marbles, shaped travel paths and rotating obstacles. The cloud browser was used with the demo's fictional fruit sample names and skills disabled. No assets or branding were copied.
- [Official Flutter I/O Pinball article](https://flutter.dev/blog/i-o-pinball-powered-by-flutter-and-firebase): collision-driven feedback, separate physics/rendering logic, ramps and gravity tuning.
- [RAVE SPACE's official technical demo description](https://ravespace.io/demos/pinball-demo): fixed 120 Hz physics and attention to high-speed collision tunneling. Baegopa uses Matter.js substeps and a speed cap; it does not implement or claim RAVE SPACE's analytical continuous collision detection.

## Final seeded sweep (after the static-material correction)

64 deterministic seeds for each roster size; 512 complete rounds. Durations below exclude the 1.05-second countdown and the user's explicit result action.

| Candidates | Median seconds | P95 seconds | Min–max seconds | Median winner contacts |
|---:|---:|---:|---:|---:|
| 1 | 12.75 | 16.38 | 9.03–21.60 | 16 |
| 2 | 11.53 | 13.05 | 9.77–14.87 | 14 |
| 5 | 11.30 | 12.45 | 9.80–13.20 | 14 |
| 12 | 9.82 | 11.32 | 9.00–11.67 | 11 |
| 25 | 9.77 | 10.35 | 8.80–11.27 | 11 |
| 45 | 8.78 | 10.00 | 8.55–10.20 | 10 |
| 150 | 8.78 | 9.25 | 8.65–9.42 | 8 |
| 405 | 8.47 | 8.73 | 8.05–9.05 | 9 |

500/512 (97.7%) finished in 8–15 seconds. All 512 finished naturally; no bounds violations or non-finite states were observed. Every sampled winner contacted at least five obstacles, with at least three distinct obstacles and at least 651 pixels of lateral travel. This sample is evidence, not a proof for every possible seed or device.

A separate 200-seed single-marble sweep finished naturally in 9.03–22.12 seconds. Large fields had median 12 leader changes, while 12-marble fields had median eight.

## Correctness and collision checks

- 160 full races compared normal stepping, 90-step skip, 600-step batches with renamed identities, and 31-step batches with reversed input. Winning slot, step count, positions, velocities and diagnostic values matched exactly for the same physical setup.
- An injected 1,000-pixel-per-tick velocity was limited before integration and still registered the expected smallest-marble bumper collision.
- Maximum measured substep displacement, including collision position correction, was 5.82 pixels, below the smallest marble's eight-pixel radius. This does not constitute a general tunneling proof.
- Regression tests cover real-time display timing at 30/60/120 Hz, irregular frames, background resume, normal/skip result equivalence, forced timeout, identity neutrality and representative roster sizes.

## Performance and visual verification limits

In the final Node 24/x86_64 AMD EPYC sweep, 405-marble rounds took median 906 ms of headless computation for median 8.47 simulated seconds. This includes diagnostics and measurement overhead, excludes Canvas/browser work, and is not a mobile FPS claim. The earlier isolated benchmark predates the final material correction and is not used as final evidence.

The existing published PR6 preview was tested in the cloud browser: cuisine selection, real Kakao location search, a matching single restaurant, map-unavailable fallback, pinball completion and the explicit result action. The modified course is local until separately published, so that earlier preview observation does not validate the revised course's final visual feel or mobile performance. Localhost browser access remains restricted in the cloud environment.
