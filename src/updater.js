// Tauri updater bridge — safe to import in non-Tauri builds (all calls no-op).

import { isTauri } from './tauri.js';

let _check, _getVersion, _relaunch;

async function ensureApis() {
  if (!isTauri) return false;
  if (!_check) {
    const updater = await import('@tauri-apps/plugin-updater');
    const app = await import('@tauri-apps/api/app');
    const proc = await import('@tauri-apps/plugin-process');
    _check = updater.check;
    _getVersion = app.getVersion;
    _relaunch = proc.relaunch;
  }
  return true;
}

export async function getAppVersion() {
  if (!(await ensureApis())) return null;
  try { return await _getVersion(); } catch { return null; }
}

// Returns { status, current, next?, update?, error? }
// status: 'latest' | 'available' | 'error'
export async function checkForUpdate() {
  if (!(await ensureApis())) {
    return { status: 'latest', current: null };
  }
  try {
    const current = await _getVersion();
    const update = await _check();
    if (update) {
      return { status: 'available', current, next: update.version, update };
    }
    return { status: 'latest', current };
  } catch (e) {
    return { status: 'error', error: e?.message || String(e) };
  }
}

export async function installUpdate(update, onProgress) {
  if (!update) throw new Error('no update');
  let downloaded = 0;
  let contentLength = 0;
  await update.downloadAndInstall((ev) => {
    if (ev.event === 'Started') {
      contentLength = ev.data?.contentLength || 0;
      onProgress?.({ phase: 'downloading', downloaded: 0, total: contentLength });
    } else if (ev.event === 'Progress') {
      downloaded += ev.data?.chunkLength || 0;
      onProgress?.({ phase: 'downloading', downloaded, total: contentLength });
    } else if (ev.event === 'Finished') {
      onProgress?.({ phase: 'installing' });
    }
  });
}

export async function relaunchApp() {
  if (!(await ensureApis())) return;
  await _relaunch();
}
