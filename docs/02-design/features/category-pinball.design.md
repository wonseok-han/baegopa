# Category-first restaurant pinball

## Scope and baseline

Based on develop `20f8099ea41ef979f6090c58ae4af5f541a21b76`, including the existing Matter.js course and Canvas renderer. Production was observed separately: it still exposed roulette, slots, pinball and capsule draw. This work extends develop's single-game direction; it does not replace it with the older production flow.

## Flow

1. Choose a food category, then GPS or a searched location and radius.
2. Review matching restaurants and count. Loading, API failure, zero matches and one match are separate states. The map is optional and must not gate restaurant requests.
3. Launch one pinball round. Candidates are copied and deduplicated by place ID for the entire round. The result requires an explicit button to open restaurant details; retry preserves the selected category.

The Kakao category hierarchy is retained in `categoryPath`. Classification uses category segments, never guessed restaurant names. Cached older entries without full category data are invalidated. Candidate counts describe the retrieved list, not every restaurant that exists nearby.

## Pinball rules

- Preserve the five-section marble-race identity, then close wall-side straight-drop corridors with staggered deflectors and wall-flush bumpers. Use steeper alternating ramps and contact-velocity motor paddles to create readable lateral travel and lead changes.
- Shuffle the roster at launch using a seed. Every unique candidate participates.
- Advance the displayed race at 1× real time. Each 60 Hz logical step uses two Matter.js substeps for 120 Hz collision integration. Cap marble speed at 5.4 pixels per 60 Hz base tick and bound the round at 24 simulated seconds. The calibrated course targets an 8–15 second race before countdown/result interaction; observed sample tails are documented in the calibration report.
- First arrival wins. If no arrival occurs by 1,440 steps, select the furthest-ahead marble with a stable numbered tie-break.
- Skip advances that same simulation in bounded batches. It cannot redraw, reseed, change candidates or change the outcome.
- The former “Equal odds” claim is removed. Copy states the actual mechanism: random starting order and first physical arrival, with a disclosed time-limit fallback. No claim of independently audited equal probabilities.
- Launch and result handoff are synchronous-ref guarded against double activation. Unmount cancels scheduled work, disposes the engine, and invalidates queued callbacks.
- Reduced motion uses the same fixed-step simulation without animated playback. Sound remains opt-in. Status and winner are available as text independently of Canvas.

## Reference decisions

- [Google I/O Pinball](https://pinball.flutter.dev/): clear arcade hierarchy and a prominent start action; do not copy assets or introduce skill scoring into a restaurant decision.
- [Marble Roulette](https://lazygyu.github.io/roulette/): the user-selected primary reference. Named entrants, shaped paths, rotating obstacles, camera tracking and a clearly defined first-arrival rule. Keep this app's shorter one-action restaurant flow instead of importing skills, advanced settings, branding or assets.

## Verification

Unit tests compare normal playback, batched playback and mid-race skipping across fixed seeds; test empty/single/large rosters, identity deduplication, mutation isolation and disposal. UI verification covers category changes, zero/one/multiple candidates, skip, repeat launch, explicit result, replay category, back/cancel, API errors, narrow layout and motion settings. API input validation, rate limiting and timeouts remain in force.

CI policy and first-rollout limitations are documented in `docs/manual-ci.md`. No CI run, branch protection change, merge or deployment is part of this local implementation.


Physics revisions, primary sources and measured distributions: [pinball physics calibration](../../03-analysis/pinball-physics-calibration.md).
