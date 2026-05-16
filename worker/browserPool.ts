/**
 * Browser pool — singleton Playwright Chromium partagé entre les pipelines.
 *
 * enrichWebsite et enrichLegal lancent chacun leur browser, ce qui double
 * la mémoire et le temps de cold-start (Playwright ~150 Mo / instance).
 * Ce module garde **un seul** Browser vivant et le partage via getSharedBrowser().
 *
 * Refcount-based : chaque caller incrémente, on ferme seulement quand le
 * dernier libère. Si tu veux forcer la fermeture (graceful shutdown
 * orchestrator), appelle closeSharedBrowser() — il ignore le refcount.
 */

import { chromium, type Browser } from 'playwright';

let sharedBrowser: Browser | null = null;
let refs = 0;
let pending: Promise<Browser> | null = null;

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
];

async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true, args: LAUNCH_ARGS });
}

export async function acquireBrowser(): Promise<Browser> {
  refs++;
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  if (pending) return pending;

  pending = launch()
    .then((b) => {
      sharedBrowser = b;
      pending = null;
      // Si le browser meurt (crash, OOM), on reset pour relaunch au prochain acquire
      b.on('disconnected', () => {
        if (sharedBrowser === b) sharedBrowser = null;
      });
      return b;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

export async function releaseBrowser(): Promise<void> {
  refs = Math.max(0, refs - 1);
  // Politique : on garde le browser chaud entre cycles tant que l'orchestrateur tourne.
  // Le shutdown explicite ferme via closeSharedBrowser().
}

export async function closeSharedBrowser(): Promise<void> {
  refs = 0;
  if (sharedBrowser) {
    const b = sharedBrowser;
    sharedBrowser = null;
    await b.close().catch(() => {});
  }
}

// Test helper
export function _getRefs(): number {
  return refs;
}
