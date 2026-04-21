// Bottega — Sprite Mask Painter

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon, BottegaMark, ToolIcon } from './icons.jsx';
import { IconButton, SectionHeader, Button } from './ui.jsx';
import {
  CHANNELS, channelByRgb, loadSprite, createMaskCanvas,
  snapMask, computeStats, floodFill, stampBrush, strokeLine, cloneCanvas,
} from './mask.jsx';
import {
  isTauri, pickImages, pickSavePath, readImageAsBlob,
  writePng, blobToBytes, buildOutputPath, stripExt, splitPath,
} from './tauri.js';
import { getCurrentWebview } from '@tauri-apps/api/webview';

function BucketIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7 L11 3 L20 12 L14 16 Z"/>
      <path d="M14 16 L16 21"/>
      <path d="M5 7 L12 14"/>
      <circle cx="20.5" cy="18" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function EraserIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4 L20 10 L10 20 L4 14 Z"/>
      <path d="M9 9 L15 15"/>
      <path d="M4 20 L20 20"/>
    </svg>
  );
}
function EyedropperIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3 L21 9"/>
      <path d="M18 6 L8 16 L6 20 L10 18 L20 8"/>
    </svg>
  );
}
function HelpIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7"/>
      <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
    </svg>
  );
}

const TOOLS = [
  { id: 'brush', icon: ToolIcon.Pennello, label: 'Pennello — 붓', shortcut: 'B' },
  { id: 'bucket', icon: BucketIcon, label: 'Secchio — 채우기', shortcut: 'G' },
  { id: 'eraser', icon: EraserIcon, label: 'Gomma — 지우개', shortcut: 'E' },
  { id: 'eyedropper', icon: EyedropperIcon, label: 'Contagocce — 스포이드', shortcut: 'I' },
  { id: 'hand', icon: Icon.Hand, label: 'Mano — 팬', shortcut: 'H' },
];

const VIEW_MODES = [
  { id: 'overlay', label: '오버레이', sub: '원본 + 마스크 반투명' },
  { id: 'mask', label: '마스크만', sub: '채널 색 전체' },
  { id: 'sprite', label: '원본만', sub: '참고' },
];

function App() {
  const [sprites, setSprites] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tool, setTool] = useState('brush');
  const [channel, setChannel] = useState('primary');
  const [viewMode, setViewMode] = useState('overlay');
  const [brushSize, setBrushSize] = useState(24);
  const [overlayAlpha, setOverlayAlpha] = useState(0.55);
  const [tolerance, setTolerance] = useState(32);
  const [mirror, setMirror] = useState('none');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState(null);
  const [cursor, setCursor] = useState({ x: -1, y: -1, show: false });
  const [uncoveredHi, setUncoveredHi] = useState(false);
  const [tick, setTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [outputSubfolder, setOutputSubfolderState] = useState(() => {
    try {
      const v = localStorage.getItem('bottega.outputSubfolder');
      return v === null ? 'Masks_SAM2' : v;
    } catch { return 'Masks_SAM2'; }
  });
  const setOutputSubfolder = useCallback((v) => {
    setOutputSubfolderState(v);
    try { localStorage.setItem('bottega.outputSubfolder', v); } catch { /* noop */ }
  }, []);
  const fileInputRef = useRef(null);

  const active = sprites.find(s => s.id === activeId);
  const channelDef = CHANNELS.find(c => c.id === channel);

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), 2200);
  }, []);

  const MAX_DIM = 8192;
  // Accepts File[] (browser input/drop) or string[] (Tauri native paths).
  const ingest = useCallback(async (items) => {
    const arr = Array.from(items || []);
    if (!arr.length) return;

    // Normalize to { file: Blob|File, name, sourcePath, _rejectReason? }
    const normalized = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        try {
          const { blob, name } = await readImageAsBlob(item);
          normalized.push({ file: blob, name, sourcePath: item });
        } catch (e) {
          console.warn('read failed', item, e);
          normalized.push({ _rejectReason: `${item}: 읽기 실패` });
        }
      } else if (item && typeof item === 'object') {
        // File / Blob from web
        if (!item.type?.startsWith?.('image/')) {
          normalized.push({ _rejectReason: `${item.name || '파일'}: 이미지 아님` });
        } else {
          normalized.push({ file: item, name: item.name, sourcePath: null });
        }
      }
    }

    const valid = normalized.filter(n => !n._rejectReason);
    const rejected = normalized.length - valid.length;
    if (rejected > 0) {
      const first = normalized.find(n => n._rejectReason)?._rejectReason;
      showToast(first + (rejected > 1 ? ` (외 ${rejected - 1}건)` : ''), 'warn');
    }
    if (!valid.length) return;

    const loaded = [];
    const errors = [];
    for (const { file, name, sourcePath } of valid) {
      try {
        if (file.size > 50 * 1024 * 1024) {
          errors.push(`${name}: 파일이 너무 큼 (50MB 초과)`);
          continue;
        }
        // Ensure loadSprite can read .name
        if (!file.name) Object.defineProperty(file, 'name', { value: name, configurable: true });
        const sprite = await loadSprite(file, sourcePath);
        if (sprite.w > MAX_DIM || sprite.h > MAX_DIM) {
          errors.push(`${name}: 해상도 초과 (${sprite.w}×${sprite.h}, 최대 ${MAX_DIM}px)`);
          URL.revokeObjectURL(sprite.url);
          continue;
        }
        if (sprite.opaqueCount === 0) {
          errors.push(`${name}: 빈 이미지 (불투명 픽셀 없음)`);
          URL.revokeObjectURL(sprite.url);
          continue;
        }
        const maskCanvas = createMaskCanvas(sprite.w, sprite.h);
        loaded.push({
          id: 'S' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          sprite, maskCanvas,
          history: [maskCanvas.toDataURL()],
          histIdx: 0,
          name: sprite.name,
        });
      } catch (e) {
        console.warn('load failed', name, e);
        errors.push(`${name}: 디코드 실패`);
      }
    }
    if (errors.length) {
      showToast(errors[0] + (errors.length > 1 ? ` (외 ${errors.length - 1}건)` : ''), 'warn');
      errors.forEach(e => console.warn(e));
    }
    if (loaded.length) {
      setSprites(prev => [...prev, ...loaded]);
      if (!activeId) setActiveId(loaded[0].id);
      if (loaded.length > 1) showToast(`${loaded.length}개 불러옴`);
    }
  }, [activeId, showToast]);

  const pushHistory = useCallback(() => {
    if (!active) return;
    const snap = active.maskCanvas.toDataURL();
    setSprites(prev => prev.map(s => {
      if (s.id !== active.id) return s;
      const truncated = s.history.slice(0, s.histIdx + 1);
      truncated.push(snap);
      const final = truncated.slice(-30);
      return { ...s, history: final, histIdx: final.length - 1 };
    }));
    setDirty(true);
  }, [active]);

  const undo = useCallback(() => {
    if (!active || active.histIdx <= 0) return;
    const newIdx = active.histIdx - 1;
    loadHistoryEntry(active, newIdx);
    setSprites(prev => prev.map(s => s.id === active.id ? { ...s, histIdx: newIdx } : s));
    setTick(t => t + 1);
  }, [active]);
  const redo = useCallback(() => {
    if (!active || active.histIdx >= active.history.length - 1) return;
    const newIdx = active.histIdx + 1;
    loadHistoryEntry(active, newIdx);
    setSprites(prev => prev.map(s => s.id === active.id ? { ...s, histIdx: newIdx } : s));
    setTick(t => t + 1);
  }, [active]);

  function loadHistoryEntry(s, idx) {
    const img = new Image();
    img.onload = () => {
      const ctx = s.maskCanvas.getContext('2d');
      ctx.clearRect(0, 0, s.maskCanvas.width, s.maskCanvas.height);
      ctx.drawImage(img, 0, 0);
      setTick(t => t + 1);
    };
    img.src = s.history[idx];
  }

  const clearMask = useCallback(() => {
    if (!active) return;
    const ctx = active.maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, active.maskCanvas.width, active.maskCanvas.height);
    pushHistory(); setTick(t => t + 1);
    showToast('마스크 초기화');
  }, [active, pushHistory, showToast]);

  const stats = useMemo(() => {
    if (!active) return null;
    return computeStats(active.maskCanvas, active.sprite.alpha);
  }, [active, tick]);

  const canvasWrapRef = useRef(null);
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(e => {
      const cr = e[0].contentRect;
      setWrapSize({ w: cr.width, h: cr.height });
    });
    if (canvasWrapRef.current) ro.observe(canvasWrapRef.current);
    return () => ro.disconnect();
  }, []);
  const fitZoom = useCallback(() => {
    if (!active || !wrapSize.w) return;
    const m = 60;
    const s = Math.min((wrapSize.w - m) / active.sprite.w, (wrapSize.h - m) / active.sprite.h, 32);
    setZoom(s); setPan({ x: 0, y: 0 });
  }, [active, wrapSize]);
  useEffect(() => { fitZoom(); }, [activeId]);

  const dragRef = useRef(null);
  const getSpriteCoords = (e) => {
    if (!active) return null;
    const el = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - el.left, cy = e.clientY - el.top;
    return { x: cx / zoom, y: cy / zoom };
  };

  const onPointerDown = (e) => {
    if (!active) return;
    if (e.button === 1 || tool === 'hand' || e.altKey) {
      dragRef.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, startPan: pan };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const p = getSpriteCoords(e);
    if (!p) return;
    const ix = Math.floor(p.x), iy = Math.floor(p.y);
    if (ix < 0 || iy < 0 || ix >= active.sprite.w || iy >= active.sprite.h) return;

    if (tool === 'eyedropper') {
      const ctx = active.maskCanvas.getContext('2d');
      const d = ctx.getImageData(ix, iy, 1, 1).data;
      const ch = channelByRgb(d[0], d[1], d[2]);
      if (d[3] > 0 && ch) { setChannel(ch); showToast(`${ch} 선택`); }
      return;
    }
    if (tool === 'bucket') {
      const ch = CHANNELS.find(c => c.id === channel);
      const W = active.sprite.w, H = active.sprite.h;
      const seeds = [[ix, iy]];
      if (mirror === 'x' || mirror === 'xy') seeds.push([W - 1 - ix, iy]);
      if (mirror === 'y' || mirror === 'xy') seeds.push([ix, H - 1 - iy]);
      if (mirror === 'xy') seeds.push([W - 1 - ix, H - 1 - iy]);
      let totalFilled = 0;
      for (const [sx, sy] of seeds) {
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        totalFilled += floodFill(active.maskCanvas, active.sprite.img, active.sprite.alpha, sx, sy, ch.rgb, tolerance);
      }
      if (totalFilled > 0) { pushHistory(); setTick(t => t + 1); }
      else showToast('채울 영역 없음', 'warn');
      return;
    }
    const ch = CHANNELS.find(c => c.id === channel);
    const erase = tool === 'eraser';
    const cx = ix + 0.5, cy = iy + 0.5, r = brushSize / 2;
    const W = active.sprite.w, H = active.sprite.h;
    stampBrush(active.maskCanvas, active.sprite.alpha, cx, cy, r, ch.rgb, erase);
    if (mirror === 'x' || mirror === 'xy') stampBrush(active.maskCanvas, active.sprite.alpha, W - cx, cy, r, ch.rgb, erase);
    if (mirror === 'y' || mirror === 'xy') stampBrush(active.maskCanvas, active.sprite.alpha, cx, H - cy, r, ch.rgb, erase);
    if (mirror === 'xy') stampBrush(active.maskCanvas, active.sprite.alpha, W - cx, H - cy, r, ch.rgb, erase);
    dragRef.current = { mode: 'paint', lastX: cx, lastY: cy, erase, ch };
    e.currentTarget.setPointerCapture(e.pointerId);
    setTick(t => t + 1);
  };

  const onPointerMove = (e) => {
    const p = getSpriteCoords(e);
    if (p) setCursor({ x: p.x, y: p.y, show: true });
    if (!dragRef.current) return;
    if (dragRef.current.mode === 'pan') {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({ x: dragRef.current.startPan.x + dx, y: dragRef.current.startPan.y + dy });
      return;
    }
    if (dragRef.current.mode === 'paint' && p) {
      const { lastX, lastY, erase, ch } = dragRef.current;
      strokeLine(active.maskCanvas, active.sprite.alpha, lastX, lastY, p.x, p.y, brushSize / 2, ch.rgb, erase, mirror);
      dragRef.current.lastX = p.x; dragRef.current.lastY = p.y;
      setTick(t => t + 1);
    }
  };
  const onPointerUp = (e) => {
    if (dragRef.current?.mode === 'paint') pushHistory();
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onWheel = (e) => {
    e.preventDefault();
    if (!active) return;
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(z => Math.max(0.1, Math.min(64, z * f)));
  };

  // Render a sprite's mask to a finalized PNG Blob (snapped to spec).
  const renderMaskBlob = useCallback(async (s) => {
    const snap = cloneCanvas(s.maskCanvas);
    snapMask(snap, s.sprite.alpha);
    return new Promise((resolve, reject) => {
      snap.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/png');
    });
  }, []);

  // Browser download fallback (non-Tauri).
  const browserDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportActive = useCallback(async () => {
    if (!active) return;
    try {
      const blob = await renderMaskBlob(active);
      const base = stripExt(active.name);
      const filename = `${base}_mask.png`;

      if (isTauri && active.sprite.sourcePath) {
        const target = buildOutputPath(active.sprite.sourcePath, outputSubfolder, base);
        await writePng(target, await blobToBytes(blob));
        showToast(`저장: ${target.replace(/^.*\/([^/]+\/[^/]+)$/, '…/$1')}`);
      } else if (isTauri) {
        const chosen = await pickSavePath(filename);
        if (!chosen) return;
        await writePng(chosen, await blobToBytes(blob));
        showToast(`저장: ${chosen.split('/').slice(-2).join('/')}`);
      } else {
        browserDownload(blob, filename);
        showToast(`${filename} 내보냄`);
      }
      setDirty(false);
    } catch (e) {
      console.warn('export failed', e);
      showToast('내보내기 실패: ' + (e?.message || e), 'warn');
    }
  }, [active, outputSubfolder, renderMaskBlob, showToast]);

  // Single sprite, forced save dialog (overrides the subfolder setting).
  const exportActiveAs = useCallback(async () => {
    if (!active) return;
    try {
      const blob = await renderMaskBlob(active);
      const base = stripExt(active.name);
      const defaultPath = (isTauri && active.sprite.sourcePath)
        ? buildOutputPath(active.sprite.sourcePath, outputSubfolder, base)
        : `${base}_mask.png`;
      if (!isTauri) { browserDownload(blob, `${base}_mask.png`); showToast(`${base}_mask.png 내보냄`); setDirty(false); return; }
      const chosen = await pickSavePath(defaultPath);
      if (!chosen) return;
      await writePng(chosen, await blobToBytes(blob));
      showToast(`저장: ${chosen.split('/').slice(-2).join('/')}`);
      setDirty(false);
    } catch (e) {
      console.warn('export-as failed', e);
      showToast('내보내기 실패: ' + (e?.message || e), 'warn');
    }
  }, [active, outputSubfolder, renderMaskBlob, showToast]);

  const exportAll = useCallback(async () => {
    if (!sprites.length) return;
    try {
      let ok = 0, skipped = 0;
      for (const s of sprites) {
        const blob = await renderMaskBlob(s);
        const base = stripExt(s.name);
        const filename = `${base}_mask.png`;
        if (isTauri && s.sprite.sourcePath) {
          const target = buildOutputPath(s.sprite.sourcePath, outputSubfolder, base);
          await writePng(target, await blobToBytes(blob));
          ok++;
        } else if (isTauri) {
          // No source path — can't auto-route; skip with a warning.
          skipped++;
        } else {
          browserDownload(blob, filename);
          ok++;
          await new Promise(r => setTimeout(r, 100));
        }
      }
      if (skipped > 0) {
        showToast(`${ok}개 저장, ${skipped}개는 원본 경로 없음 (다이얼로그에서 불러온 게 아닐 때)`, 'warn');
      } else {
        showToast(`${ok}개 마스크 저장됨`);
      }
      setDirty(false);
    } catch (e) {
      console.warn('export-all failed', e);
      showToast('일괄 내보내기 실패: ' + (e?.message || e), 'warn');
    }
  }, [sprites, outputSubfolder, renderMaskBlob, showToast]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 's') {
        e.preventDefault();
        if (e.shiftKey) exportActiveAs(); else exportActive();
        return;
      }
      const m = TOOLS.find(t => t.shortcut?.toLowerCase() === k);
      if (m) { setTool(m.id); return; }
      if (k === '1' || k === '2' || k === '3' || k === '4') {
        const c = CHANNELS[parseInt(k) - 1]; if (c) setChannel(c.id); return;
      }
      if (k === 'x') {
        const idx = CHANNELS.findIndex(c => c.id === channel);
        setChannel(CHANNELS[(idx + 1) % CHANNELS.length].id);
      }
      if (k === '[') setBrushSize(s => Math.max(1, Math.round(s / 1.2)));
      if (k === ']') setBrushSize(s => Math.min(400, Math.round(s * 1.2)));
      if (k === '0') fitZoom();
      if (k === 'm') {
        setMirror(m => m === 'none' ? 'x' : m === 'x' ? 'y' : m === 'y' ? 'xy' : 'none');
      }
      if (k === '?' || (e.shiftKey && k === '/')) { setShowHelp(s => !s); }
      if (k === 'escape') { setShowHelp(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, channel, fitZoom, exportActive, exportActiveAs]);

  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Native drag-drop via Tauri webview (bypasses the browser drop event).
  useEffect(() => {
    if (!isTauri) return;
    let unlisten = null;
    let active = true;
    getCurrentWebview().onDragDropEvent((ev) => {
      if (!active) return;
      if (ev.payload.type === 'drop' && ev.payload.paths?.length) {
        ingest(ev.payload.paths);
      }
    }).then(fn => { unlisten = fn; if (!active) fn(); });
    return () => { active = false; if (unlisten) unlisten(); };
  }, [ingest]);

  const openPicker = useCallback(async () => {
    if (isTauri) {
      try {
        const paths = await pickImages();
        if (paths.length) ingest(paths);
      } catch (e) {
        console.warn('pickImages failed', e);
        showToast('파일 선택 취소됨', 'warn');
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [ingest, showToast]);

  return (
    <>
      <div style={{
        height: 44, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 14, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BottegaMark size={28} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 18, letterSpacing: '0.01em' }}>
              Bottega
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--fg-3)',
              letterSpacing: '0.24em', marginTop: 3, textTransform: 'uppercase' }}>
              Sprite Mask Painter
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--line)' }} />

        <Button icon={Icon.Upload} onClick={openPicker}>스프라이트 불러오기</Button>
        <input ref={fileInputRef} type="file" accept="image/png,image/*" multiple hidden
          onChange={e => { ingest(e.target.files); e.target.value = ''; }} />

        <span style={{ flex: 1 }} />

        {dirty && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon.Dot size={8} />저장 안 됨
          </span>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton icon={Icon.Undo} label="실행 취소" shortcut="⌘Z" onClick={undo} tooltipSide="bottom"
            disabled={!active || active.histIdx <= 0} />
          <IconButton icon={Icon.Redo} label="다시 실행" shortcut="⌘⇧Z" onClick={redo} tooltipSide="bottom"
            disabled={!active || active.histIdx >= (active?.history.length || 0) - 1} />
        </div>
        <Button variant="ghost" onClick={clearMask} disabled={!active}>초기화</Button>
        <IconButton icon={HelpIcon} label="단축키" shortcut="?" onClick={() => setShowHelp(true)} tooltipSide="bottom" />
        <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
        <Button onClick={exportAll} disabled={!sprites.length}
          icon={Icon.Download}>일괄 내보내기</Button>
        <IconButton icon={Icon.FolderOpen} label="다른 위치로 저장" shortcut="⌘⇧S"
          onClick={exportActiveAs} disabled={!active} tooltipSide="bottom" />
        <Button variant="primary" onClick={exportActive} disabled={!active}
          icon={Icon.Save}>마스크 내보내기</Button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{
          width: 44, background: 'var(--bg-1)', borderRight: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 2, flexShrink: 0,
        }}>
          {TOOLS.map(t => (
            <IconButton key={t.id} icon={t.icon} label={t.label} shortcut={t.shortcut}
              active={tool === t.id} onClick={() => setTool(t.id)} tooltipSide="right" />
          ))}
        </div>

        <div style={{ width: 260, background: 'var(--bg-1)', borderRight: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', overflow: 'auto', flexShrink: 0 }}>
          <SectionHeader title="Canali · 채널" />
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHANNELS.map(c => (
              <ChannelRow key={c.id} ch={c} active={channel === c.id}
                onClick={() => setChannel(c.id)}
                count={stats?.counts[c.id] || 0}
                total={stats?.opaque || 0} />
            ))}
          </div>

          <SectionHeader title="Specchio · 미러" />
          <div style={{ padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { id: 'none', label: '끔', sub: 'OFF' },
                { id: 'x', label: '좌우', sub: '⇄' },
                { id: 'y', label: '상하', sub: '⇵' },
                { id: 'xy', label: '4분할', sub: '✤' },
              ].map(m => (
                <button key={m.id} onClick={() => setMirror(m.id)}
                  style={{
                    padding: '6px 4px',
                    background: mirror === m.id ? 'var(--accent-soft)' : 'var(--bg-2)',
                    border: mirror === m.id ? '1px solid var(--accent-line)' : '1px solid var(--line)',
                    borderRadius: 4, color: mirror === m.id ? 'var(--accent)' : 'var(--fg-1)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 2,
                  }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{m.sub}</span>
                  <span style={{ fontSize: 10 }}>{m.label}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
              M 키로 순환 · 붓/채우기/지우개 모두 적용
            </div>
          </div>

          <SectionHeader title="Strumento · 도구 옵션" />
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(tool === 'brush' || tool === 'eraser') && (
              <NumberRow label="붓 굵기" value={brushSize} min={1} max={400} unit="px"
                onChange={setBrushSize} hint="[  ]" />
            )}
            {tool === 'bucket' && (
              <NumberRow label="허용치" value={tolerance} min={0} max={128}
                onChange={setTolerance} hint="색상 유사도" />
            )}
            {tool === 'eyedropper' && (
              <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                캔버스를 클릭하면 해당 픽셀의 채널이 선택됩니다.
              </div>
            )}
            {tool === 'hand' && (
              <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                캔버스를 드래그하여 이동 · Alt+드래그도 동일
              </div>
            )}
          </div>

          <SectionHeader title="Vista · 보기" />
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {VIEW_MODES.map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                  background: viewMode === v.id ? 'var(--accent-soft)' : 'var(--bg-2)',
                  border: viewMode === v.id ? '1px solid var(--accent-line)' : '1px solid var(--line)',
                  borderRadius: 4, color: viewMode === v.id ? 'var(--fg)' : 'var(--fg-1)',
                  textAlign: 'left', cursor: 'pointer',
                }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 2,
                  border: '1px solid var(--line-strong)',
                  background: viewMode === v.id ? 'var(--accent)' : 'transparent',
                }} />
                <div style={{ flex: 1, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12 }}>{v.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{v.sub}</div>
                </div>
              </button>
            ))}
            {viewMode === 'overlay' && (
              <div style={{ marginTop: 2 }}>
                <NumberRow label="마스크 불투명도" value={Math.round(overlayAlpha * 100)}
                  min={10} max={100} unit="%" onChange={v => setOverlayAlpha(v / 100)} />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              color: 'var(--fg-1)', padding: '4px 2px', cursor: 'pointer' }}>
              <input type="checkbox" checked={uncoveredHi}
                onChange={e => setUncoveredHi(e.target.checked)} />
              미칠한 영역 강조 <span style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 10 }}>⚠</span>
            </label>
          </div>

          <SectionHeader title="Uscita · 출력" />
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>하위 폴더</span>
                <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
                  공란=원본 옆
                </span>
              </div>
              <input
                type="text"
                value={outputSubfolder}
                onChange={e => setOutputSubfolder(e.target.value)}
                placeholder="Masks_SAM2"
                spellCheck={false}
                style={{
                  width: '100%',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '6px 8px',
                  color: 'var(--fg)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  outline: 'none',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-line)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--line)'}
              />
            </div>
            {active && isTauri && active.sprite.sourcePath && (
              <div style={{
                fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--mono)',
                lineHeight: 1.5, wordBreak: 'break-all',
                padding: '6px 8px', background: 'var(--bg-2)',
                border: '1px solid var(--line)', borderRadius: 4,
              }}>
                <div style={{ color: 'var(--fg-2)', marginBottom: 2 }}>저장 경로 미리보기</div>
                {buildOutputPath(active.sprite.sourcePath, outputSubfolder, stripExt(active.name))}
              </div>
            )}
            {active && isTauri && !active.sprite.sourcePath && (
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
                원본 경로 없음 — 내보낼 때 폴더 선택
              </div>
            )}
            {!isTauri && (
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
                브라우저 모드 — 다운로드 폴더로 저장
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            height: 30, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, fontSize: 11,
            color: 'var(--fg-2)', fontFamily: 'var(--mono)',
          }}>
            {active ? (
              <>
                <span>{active.name}</span>
                <span style={{ color: 'var(--fg-3)' }}>·</span>
                <span>{active.sprite.w}×{active.sprite.h}</span>
                {stats && (
                  <>
                    <span style={{ color: 'var(--fg-3)' }}>·</span>
                    <span>덮임 {((1 - stats.uncovered / stats.opaque) * 100).toFixed(1)}%</span>
                    {stats.uncovered > 0 && (
                      <span style={{ color: 'var(--danger)' }}>
                        (미칠함 {stats.uncovered.toLocaleString()}px)
                      </span>
                    )}
                  </>
                )}
              </>
            ) : <span>스프라이트를 불러오세요</span>}
            <span style={{ flex: 1 }} />
            {active && (
              <>
                {mirror !== 'none' && (
                  <span style={{ color: 'var(--accent)',
                    border: '1px solid var(--accent-line)',
                    background: 'var(--accent-soft)',
                    padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                    MIRROR {mirror.toUpperCase()}
                  </span>
                )}
                <IconButton icon={Icon.ZoomOut} label="축소" size={22}
                  onClick={() => setZoom(z => Math.max(0.1, z / 1.2))} />
                <span style={{ minWidth: 44, textAlign: 'center' }}
                  onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</span>
                <IconButton icon={Icon.ZoomIn} label="확대" size={22}
                  onClick={() => setZoom(z => Math.min(64, z * 1.2))} />
                <IconButton icon={Icon.Maximize} label="맞춤 (0)" size={22} onClick={fitZoom} />
              </>
            )}
          </div>

          <div ref={canvasWrapRef} onWheel={onWheel}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); ingest(e.dataTransfer.files); }}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-0)' }}
          >
            {active ? (
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              }}>
                <CanvasStage sprite={active.sprite} maskCanvas={active.maskCanvas}
                  zoom={zoom} viewMode={viewMode} overlayAlpha={overlayAlpha}
                  uncoveredHi={uncoveredHi}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                  onPointerLeave={() => setCursor(c => ({ ...c, show: false }))}
                  tool={tool} brushSize={brushSize} cursor={cursor} channelDef={channelDef}
                  mirror={mirror}
                  tick={tick}
                />
              </div>
            ) : (
              <EmptyState onClick={openPicker} />
            )}

            {active && (
              <div style={{
                position: 'absolute', left: 12, bottom: 12,
                display: 'flex', gap: 6,
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-2)',
                pointerEvents: 'none',
              }}>
                <span style={{ background: 'oklch(0.1 0 0 / 0.75)', padding: '3px 8px',
                  borderRadius: 3, border: '1px solid var(--line)' }}>
                  {cursor.show ? `${Math.floor(cursor.x)}, ${Math.floor(cursor.y)}` : '—'}
                </span>
                <span style={{ background: 'oklch(0.1 0 0 / 0.75)', padding: '3px 8px',
                  borderRadius: 3, border: '1px solid var(--line)' }}>
                  zoom {zoom.toFixed(2)}×
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 240, background: 'var(--bg-1)', borderLeft: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', overflow: 'auto', flexShrink: 0 }}>
          <SectionHeader title={`Sprite · 스프라이트 (${sprites.length})`}
            right={sprites.length > 0 && (
              <button onClick={openPicker}
                style={{ color: 'var(--fg-1)', padding: 2 }}><Icon.Plus size={14}/></button>
            )} />
          {sprites.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--fg-2)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
              PNG 스프라이트를<br/>이 창 아무데나 드롭하세요
            </div>
          ) : (
            <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sprites.map(s => (
                <SpriteRow key={s.id} s={s} active={s.id === activeId}
                  onSelect={() => setActiveId(s.id)}
                  onRemove={() => {
                    setSprites(p => p.filter(x => x.id !== s.id));
                    if (activeId === s.id) setActiveId(sprites.find(x => x.id !== s.id)?.id || null);
                  }}
                />
              ))}
            </div>
          )}

          <SectionHeader title="Specifica · 규격" />
          <div style={{ padding: 10, fontSize: 10.5, color: 'var(--fg-2)',
            fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
            <div>✓ 해상도 원본과 동일</div>
            <div>✓ 알파 원본과 동일</div>
            <div>✓ R=Primary · G=Secondary · B=Accent</div>
            <div>✓ 검정=원본 유지</div>
            <div>✓ Hard edge · 8bit RGBA</div>
            <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>
              저장 시 자동으로 snap 적용
            </div>
          </div>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          background: 'oklch(0.1 0 0 / 0.95)', border: '1px solid var(--line-strong)',
          padding: '8px 14px', borderRadius: 6, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'var(--shadow)', zIndex: 2000,
        }}>
          <Icon.Dot size={10} style={{ color: toast.kind === 'warn' ? 'var(--danger)' : 'var(--accent)' }} />
          {toast.msg}
        </div>
      )}
    </>
  );
}

function CanvasStage({ sprite, maskCanvas, zoom, viewMode, overlayAlpha,
  onPointerDown, onPointerMove, onPointerUp, onPointerLeave,
  tool, brushSize, cursor, channelDef, mirror, tick }) {
  const [maskUrl, setMaskUrl] = useState(null);
  useEffect(() => {
    maskCanvas.toBlob(b => {
      if (!b) return;
      const u = URL.createObjectURL(b);
      setMaskUrl(prev => { if (prev) URL.revokeObjectURL(prev); return u; });
    });
  }, [tick, maskCanvas]);

  const dispW = sprite.w * zoom, dispH = sprite.h * zoom;

  const checker = `
    linear-gradient(45deg, oklch(0.22 0.005 260) 25%, transparent 25%),
    linear-gradient(-45deg, oklch(0.22 0.005 260) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, oklch(0.22 0.005 260) 75%),
    linear-gradient(-45deg, transparent 75%, oklch(0.22 0.005 260) 75%)
  `;

  const showSprite = viewMode === 'sprite' || viewMode === 'overlay';
  const showMask = viewMode === 'mask' || viewMode === 'overlay';

  return (
    <div
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'relative', width: dispW, height: dispH,
        backgroundImage: checker, backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        boxShadow: '0 0 0 1px var(--line-strong), 0 20px 60px -20px rgba(0,0,0,0.8)',
        cursor: tool === 'hand' ? 'grab' : 'crosshair',
        imageRendering: 'pixelated',
        touchAction: 'none',
      }}
    >
      {showSprite && (
        <img src={sprite.url} draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          imageRendering: 'pixelated', pointerEvents: 'none',
        }} />
      )}
      {showMask && maskUrl && (
        <img src={maskUrl} draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          imageRendering: 'pixelated', pointerEvents: 'none',
          opacity: viewMode === 'overlay' ? overlayAlpha : 1,
        }} />
      )}
      {mirror && mirror !== 'none' && (
        <>
          {(mirror === 'x' || mirror === 'xy') && (
            <div style={{
              position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1,
              background: 'repeating-linear-gradient(to bottom, var(--accent) 0 4px, transparent 4px 8px)',
              opacity: 0.6, pointerEvents: 'none', transform: 'translateX(-0.5px)',
            }} />
          )}
          {(mirror === 'y' || mirror === 'xy') && (
            <div style={{
              position: 'absolute', top: '50%', left: 0, right: 0, height: 1,
              background: 'repeating-linear-gradient(to right, var(--accent) 0 4px, transparent 4px 8px)',
              opacity: 0.6, pointerEvents: 'none', transform: 'translateY(-0.5px)',
            }} />
          )}
        </>
      )}
      {cursor.show && (tool === 'brush' || tool === 'eraser') && (
        <>
          {[
            { x: cursor.x, y: cursor.y, primary: true },
            ...((mirror === 'x' || mirror === 'xy') ? [{ x: sprite.w - cursor.x, y: cursor.y }] : []),
            ...((mirror === 'y' || mirror === 'xy') ? [{ x: cursor.x, y: sprite.h - cursor.y }] : []),
            ...(mirror === 'xy' ? [{ x: sprite.w - cursor.x, y: sprite.h - cursor.y }] : []),
          ].map((c, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: (c.x - brushSize / 2) * zoom,
              top: (c.y - brushSize / 2) * zoom,
              width: brushSize * zoom, height: brushSize * zoom,
              border: `${c.primary ? 2 : 1}px ${c.primary ? 'solid' : 'dashed'} ${tool === 'eraser' ? '#fff' : channelDef.hex}`,
              borderRadius: '50%', pointerEvents: 'none',
              boxShadow: '0 0 0 1px oklch(0.12 0 0 / 0.8)',
              mixBlendMode: 'difference',
              opacity: c.primary ? 1 : 0.75,
            }} />
          ))}
        </>
      )}
    </div>
  );
}

function ChannelRow({ ch, active, onClick, count, total }) {
  const pct = total ? (count / total) * 100 : 0;
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
        border: active ? '1px solid var(--accent-line)' : '1px solid var(--line)',
        borderRadius: 5, textAlign: 'left', cursor: 'pointer',
        color: active ? 'var(--fg)' : 'var(--fg-1)',
      }}>
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: ch.hex,
        border: ch.id === 'detail' ? '1px solid var(--line-strong)' : 'none',
      }} />
      <div style={{ flex: 1, lineHeight: 1.2 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{ch.name}</div>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{ch.sub}</div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10 }}>
        <div style={{ color: active ? 'var(--accent)' : 'var(--fg-1)' }}>{pct.toFixed(0)}%</div>
        <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 1,
          padding: '1px 4px', border: '1px solid var(--line)', borderRadius: 2 }}>
          {ch.key}
        </div>
      </div>
    </button>
  );
}

function NumberRow({ label, value, min, max, unit = '', onChange, hint }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: 'var(--fg-1)', fontSize: 11 }}>{label}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hint && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--fg-3)' }}>{hint}</span>}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>
            {value}{unit}
          </span>
        </div>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--accent)' }} />
    </div>
  );
}

function SpriteRow({ s, active, onSelect, onRemove }) {
  return (
    <div onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 4,
        background: active ? 'var(--accent-soft)' : 'transparent',
        border: active ? '1px solid var(--accent-line)' : '1px solid transparent',
        cursor: 'pointer', color: active ? 'var(--fg)' : 'var(--fg-1)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-3)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <img src={s.sprite.url} style={{
        width: 30, height: 30, objectFit: 'contain',
        border: '1px solid var(--line)', borderRadius: 3,
        background: 'var(--bg-0)', imageRendering: 'pixelated',
      }} />
      <div style={{ flex: 1, overflow: 'hidden', lineHeight: 1.2 }}>
        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
          {s.sprite.w}×{s.sprite.h}
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{ color: 'var(--fg-3)', padding: 3 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-3)'}
      ><Icon.X size={12} /></button>
    </div>
  );
}

function EmptyState({ onClick }) {
  return (
    <div style={{ position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--fg-2)', gap: 22,
    }}>
      <BottegaMark size={64} />
      <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600,
          color: 'var(--fg-1)', marginBottom: 6 }}>Sprite Mask Painter</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
          스프라이트 PNG를 드롭하거나 아래 버튼으로 불러오세요
        </div>
      </div>
      <Button icon={Icon.Upload} variant="primary" onClick={onClick}>스프라이트 선택</Button>
      <div style={{ display: 'flex', gap: 20, fontSize: 10, color: 'var(--fg-3)',
        fontFamily: 'var(--mono)', marginTop: 20 }}>
        <span>B 붓</span><span>G 채우기</span><span>E 지우개</span>
        <span>1-4 채널</span><span>[ ] 굵기</span><span>M 미러</span><span>⌘S 내보내기</span>
      </div>
    </div>
  );
}

function HelpModal({ onClose }) {
  const rows = [
    { group: '도구', items: [
      ['B', '붓 (Pennello)'],
      ['G', '채우기 (Secchio)'],
      ['E', '지우개 (Gomma)'],
      ['I', '스포이드 (Contagocce)'],
      ['H', '손 / 팬 이동'],
    ]},
    { group: '채널', items: [
      ['1', 'Primary (빨강)'],
      ['2', 'Secondary (초록)'],
      ['3', 'Accent (파랑)'],
      ['4', 'Detail (검정 / 원본 유지)'],
      ['X', '채널 순환'],
    ]},
    { group: '붓 / 미러', items: [
      ['[  ]', '붓 굵기 감소 / 증가'],
      ['M', '미러 순환 (없음 → 좌우 → 상하 → 4분할)'],
      ['Alt+드래그', '캔버스 이동'],
      ['휠', '확대 / 축소'],
      ['0', '화면에 맞춤'],
    ]},
    { group: '편집', items: [
      ['⌘Z / Ctrl+Z', '실행 취소'],
      ['⌘⇧Z / Ctrl+Y', '다시 실행'],
      ['⌘S / Ctrl+S', '마스크 내보내기'],
      ['⌘⇧S', '다른 위치로 저장…'],
      ['?', '이 창 열기 / 닫기'],
      ['Esc', '창 닫기'],
    ]},
  ];
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(0.05 0 0 / 0.7)',
        zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 8, width: 640, maxWidth: '90vw', maxHeight: '85vh',
          overflow: 'auto', boxShadow: 'var(--shadow)',
        }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <BottegaMark size={28} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>단축키</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--mono)',
              letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 2 }}>
              Scorciatoie · Keyboard Shortcuts
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--fg-2)', padding: 6,
            borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-2)'; e.currentTarget.style.background = 'transparent'; }}
          ><Icon.X size={16} /></button>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 28px' }}>
          {rows.map(section => (
            <div key={section.group}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 10,
                paddingBottom: 6, borderBottom: '1px solid var(--line)',
              }}>{section.group}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.items.map(([key, desc]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <kbd style={{
                      fontFamily: 'var(--mono)', fontSize: 11,
                      padding: '2px 7px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--line-strong)',
                      borderBottomWidth: 2,
                      borderRadius: 3, color: 'var(--fg)',
                      minWidth: 28, textAlign: 'center',
                    }}>{key}</kbd>
                    <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--line)',
          fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--mono)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>PNG 드롭 가능 · 여러 파일 동시 로드</span>
          <span>Bottega · Sprite Mask Painter</span>
        </div>
      </div>
    </div>
  );
}

export default App;
