# Category-first restaurant pinball

## Scope and baseline

Based on develop `20f8099ea41ef979f6090c58ae4af5f541a21b76`, including the existing Matter.js course and Canvas renderer. Production was observed separately: it still exposed roulette, slots, pinball and capsule draw. This work extends develop's single-game direction; it does not replace it with the older production flow.

## Flow

1. Choose a food category, then GPS or a searched location and radius.
2. Review matching restaurants and count. Loading, API failure, zero matches and one match are separate states. The map is optional and must not gate restaurant requests.
3. Launch one pinball round. Candidates are copied and deduplicated by place ID for the entire round. The result requires an explicit button to open restaurant details; retry preserves the selected category.

The Kakao category hierarchy is retained in `categoryPath`. Classification uses category segments, never guessed restaurant names. Cached older entries without full category data are invalidated. Candidate counts describe the retrieved list, not every restaurant that exists nearby.

## Pinball rules

- Preserve the five-section peg, bumper, spinner, switchback and finish course.
- Shuffle the roster at launch using a seed. Every unique candidate participates.
- Integrate Matter.js at exactly 60 fixed steps per simulated second. Normal rendering runs the simulation at 3× presentation speed; a maximum 30 simulated seconds makes the visible round at most roughly 10 seconds plus countdown when the tab is active.
- First arrival wins. If no arrival occurs by 1,800 steps, select the furthest-ahead marble with a stable numbered tie-break.
- Skip advances that same simulation in bounded batches. It cannot redraw, reseed, change candidates or change the outcome.
- The former “Equal odds” claim is removed. Copy states the actual mechanism: random starting order and first physical arrival, with a disclosed time-limit fallback. No claim of independently audited equal probabilities.
- Launch and result handoff are synchronous-ref guarded against double activation. Unmount cancels scheduled work, disposes the engine, and invalidates queued callbacks.
- Reduced motion uses the same fixed-step simulation without animated playback. Sound remains opt-in. Status and winner are available as text independently of Canvas.

## Reference decisions

- [Google I/O Pinball](https://pinball.flutter.dev/): clear arcade hierarchy and a prominent start action; do not copy assets or introduce skill scoring into a restaurant decision.
- [Marble Roulette](https://lazygyu.github.io/roulette/): named entrants, visible shuffle/start, and a clearly defined first-arrival rule. Keep this app's shorter one-action flow instead of importing its advanced settings.

## Verification

Unit tests compare normal playback, batched playback and mid-race skipping across fixed seeds; test empty/single/large rosters, identity deduplication, mutation isolation and disposal. UI verification covers category changes, zero/one/multiple candidates, skip, repeat launch, explicit result, replay category, back/cancel, API errors, narrow layout and motion settings. API input validation, rate limiting and timeouts remain in force.

CI policy and first-rollout limitations are documented in `docs/manual-ci.md`. No CI run, branch protection change, merge or deployment is part of this local implementation.
