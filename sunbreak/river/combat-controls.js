// One authoritative clock for ammo, first-person pose and mechanical sounds.
export const SHOT_INTERVAL_MS = 105;
export const RELOAD_SECONDS = 2.25;
export const RELOAD_CUES = Object.freeze({out: .25, insert: .74});

export function reloadProgress(remaining) {
 return remaining > 0 ? Math.max(0, Math.min(1, 1 - remaining / RELOAD_SECONDS)) : 0;
}

export function controlTarget(target) {
 return !!target?.closest?.('button,input,textarea,select,a,[contenteditable]:not([contenteditable="false"]),[role="button"]');
}

export function createTrigger() {
 let mouse = false, keyboard = false;
 return {
  setMouse(value) { mouse = !!value; },
  setKeyboard(value) { keyboard = !!value; },
  clear() { mouse = keyboard = false; },
  get held() { return mouse || keyboard; },
  snapshot() { return {mouse, keyboard, held: mouse || keyboard}; }
 };
}
