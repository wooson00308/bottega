// Tauri bridge — native file I/O + dialogs.
// Falls back gracefully when run in a plain browser (e.g. `pnpm dev` without tauri).

import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';

export const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

// Split a POSIX path into dir / base.
export function splitPath(path) {
  const i = path.lastIndexOf('/');
  if (i < 0) return { dir: '', base: path };
  return { dir: path.slice(0, i), base: path.slice(i + 1) };
}

export function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

export function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}

// Load a native file path as a Blob + its basename.
export async function readImageAsBlob(path) {
  const bytes = await readFile(path);
  const blob = new Blob([bytes], { type: 'image/png' });
  const { base } = splitPath(path);
  return { blob, name: base };
}

// Prompt the user to pick image files; returns native paths or [] on cancel.
export async function pickImages() {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: 'Images', extensions: ['png', 'PNG'] }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

// Single-file picker (used for guide import).
export async function pickSingleImage() {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Images', extensions: ['png', 'PNG'] }],
  });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] : selected;
}

// Prompt for a save destination, seeded with the default target path.
export async function pickSavePath(defaultPath) {
  const chosen = await save({
    defaultPath,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  return chosen || null;
}

// Write PNG bytes to a native path, creating parent dirs.
export async function writePng(path, uint8) {
  const { dir } = splitPath(path);
  if (dir && !(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, uint8);
}

// Blob → Uint8Array
export async function blobToBytes(blob) {
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

// Given sprite's native source path + output subfolder + mask filename,
// produce the final absolute output path.
export function buildOutputPath(sourcePath, subfolder, baseName) {
  const { dir } = splitPath(sourcePath);
  const filename = `${baseName}_mask.png`;
  return subfolder
    ? joinPath(dir, subfolder, filename)
    : joinPath(dir, filename);
}
