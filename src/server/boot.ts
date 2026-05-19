import 'server-only';
import { env } from './env';

type BootState = 'pending' | 'booting' | 'ready' | 'failed';

let state: BootState = 'pending';
let bootPromise: Promise<void> | null = null;

async function doBoot() {
  state = 'booting';
  try {
    env(); // validate env early
    // bot + cron startup happens in Phase D/G; this is the seam
    state = 'ready';
  } catch (err) {
    state = 'failed';
    throw err;
  }
}

export function getBootState(): BootState {
  return state;
}

export function bootOnce(): Promise<void> {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}
