import 'server-only';
import { env } from './env';
import { startBot } from './bot';

type BootState = 'pending' | 'booting' | 'ready' | 'failed';

let state: BootState = 'pending';
let bootPromise: Promise<void> | null = null;

async function doBoot() {
  state = 'booting';
  try {
    env();
    if (process.env.SKIP_BOT !== '1') {
      // Don't await: long-polling starts a loop. We just want it to begin.
      void startBot().catch((err) => {
        console.error('Bot failed:', err);
      });
    }
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
