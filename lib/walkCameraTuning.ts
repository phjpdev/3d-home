/** Shared walk / look tuning (edit overview + walk mode). */

/** Max horizontal travel per floor click (~meters). */
export const WALK_CLICK_STEP_CAP = 2.5;

/** Keyboard step (ArrowUp/W, ArrowDown/S). */
export const WALK_KEY_STEP = 1.36;

/** Keyboard move animation duration (ms). */
export const WALK_KEY_TRANSIT_MS = 384;

/** Drag-to-look sensitivity (rad per pixel). */
export const WALK_LOOK_SENSITIVITY = 0.0035;

/** Click-to-walk animation duration from step length (ms). */
export function walkClickTransitMs(step: number): number {
  return Math.min(990, 468 + step * 228);
}

/** Overview orbit — slightly snappier than drei defaults. */
export const ORBIT_DAMPING_FACTOR = 0.05;
export const ORBIT_ROTATE_SPEED = 1.28;
export const ORBIT_PAN_SPEED = 1.15;
