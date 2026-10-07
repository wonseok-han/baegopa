/** Display timing only: the simulation always consumes identical fixed steps. */
export function createPinballClock(stepMs: number) {
  let previous: number | null = null;
  let pending = 0;
  return {
    reset(now: number) { previous = now; pending = 0; },
    advance(now: number, step: () => boolean) {
      if (previous === null) { previous = now; return; }
      // Do not fast-forward the visible round after a background tab resumes.
      pending += Math.min(Math.max(now - previous, 0), 100);
      previous = now;
      while (pending + 1e-9 >= stepMs) {
        pending = Math.max(0, pending - stepMs);
        if (step()) { pending = 0; break; }
      }
    },
  };
}
