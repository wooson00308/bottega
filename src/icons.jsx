// Lucide-style line icons (hand-rolled, stroke=1.5)
const IconBase = ({ size = 16, children, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}
  >
    {children}
  </svg>
);

export const Icon = {
  Folder: (p) => <IconBase {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></IconBase>,
  FolderOpen: (p) => <IconBase {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/><path d="M3 9h18l-2 8a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-2z"/></IconBase>,
  File: (p) => <IconBase {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></IconBase>,
  Image: (p) => <IconBase {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-4.5-4.5L7 20"/></IconBase>,
  ChevronRight: (p) => <IconBase {...p}><path d="m9 6 6 6-6 6"/></IconBase>,
  ChevronDown: (p) => <IconBase {...p}><path d="m6 9 6 6 6-6"/></IconBase>,
  Upload: (p) => <IconBase {...p}><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></IconBase>,
  FolderUp: (p) => <IconBase {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 17v-5"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/></IconBase>,
  Download: (p) => <IconBase {...p}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></IconBase>,
  Save: (p) => <IconBase {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></IconBase>,
  Undo: (p) => <IconBase {...p}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></IconBase>,
  Redo: (p) => <IconBase {...p}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></IconBase>,
  Move: (p) => <IconBase {...p}><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/></IconBase>,
  Crop: (p) => <IconBase {...p}><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></IconBase>,
  Type: (p) => <IconBase {...p}><path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/></IconBase>,
  Brush: (p) => <IconBase {...p}><path d="M9.5 14.5 3 21"/><path d="M17.5 6.5 21 3"/><path d="M7 17a4 4 0 1 0 4 4v-4z"/><path d="m13 9 2 2"/><path d="m10.5 6.5 7-3.5 3.5 3.5-3.5 7-2 2-5-5z"/></IconBase>,
  Sliders: (p) => <IconBase {...p}><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></IconBase>,
  RotateCw: (p) => <IconBase {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></IconBase>,
  FlipH: (p) => <IconBase {...p}><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2M12 14v2M12 8v2M12 2v2"/></IconBase>,
  History: (p) => <IconBase {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></IconBase>,
  Plus: (p) => <IconBase {...p}><path d="M12 5v14M5 12h14"/></IconBase>,
  X: (p) => <IconBase {...p}><path d="M18 6 6 18M6 6l12 12"/></IconBase>,
  Check: (p) => <IconBase {...p}><path d="M20 6 9 17l-5-5"/></IconBase>,
  ZoomIn: (p) => <IconBase {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></IconBase>,
  ZoomOut: (p) => <IconBase {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></IconBase>,
  Maximize: (p) => <IconBase {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></IconBase>,
  Trash: (p) => <IconBase {...p}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></IconBase>,
  Dot: (p) => <IconBase {...p}><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></IconBase>,
  Layers: (p) => <IconBase {...p}><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></IconBase>,
  Info: (p) => <IconBase {...p}><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></IconBase>,
  Hand: (p) => <IconBase {...p}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8 2 2 0 1 1 4 0"/></IconBase>,
};

// Bottega brand mark — serif "B" inside an engraved keystone shield.
export const BottegaMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
    <defs>
      <linearGradient id="bgAmber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0b76d"/>
        <stop offset="1" stopColor="#a97a3b"/>
      </linearGradient>
      <linearGradient id="bgHighlight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(255,240,200,0.55)"/>
        <stop offset="0.5" stopColor="rgba(255,240,200,0)"/>
      </linearGradient>
    </defs>
    <path d="M6 3 H26 A2 2 0 0 1 28 5 V21 C28 24.5, 25 26.5, 22 27.6 L16 29.8 L10 27.6 C7 26.5, 4 24.5, 4 21 V5 A2 2 0 0 1 6 3 Z"
      fill="url(#bgAmber)" stroke="#5a3f1e" strokeWidth="0.6"/>
    <path d="M7 4.6 H25 A0.8 0.8 0 0 1 25.8 5.4 V20.5 C25.8 23.3, 23.2 25, 21.3 25.7 L16 27.7 L10.7 25.7 C8.8 25, 6.2 23.3, 6.2 20.5 V5.4 A0.8 0.8 0 0 1 7 4.6 Z"
      fill="url(#bgHighlight)" stroke="rgba(255,235,200,0.4)" strokeWidth="0.4"/>
    <text x="16" y="21.5" textAnchor="middle"
      fontFamily="Cormorant Garamond, Didot, Times New Roman, serif"
      fontWeight="700" fontSize="17"
      fill="#2a1a0a">B</text>
  </svg>
);

// Renaissance-flavored tool icons
export const ToolIcon = {
  Hand: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14 6 4 l4.5 4.5" />
      <path d="M6 14 l3 3 8 -8 -2 -2 -6 6" />
      <path d="M11 19 l5 -5" opacity="0.4"/>
    </svg>
  ),
  Compass: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5"/>
      <path d="M12 5.5 L6 21"/>
      <path d="M12 5.5 L18 21"/>
      <path d="M9 14 L15 14"/>
    </svg>
  ),
  Squadra: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4 L20 4 L4 20 Z"/>
      <path d="M8 4 L8 8" opacity="0.5"/>
      <path d="M12 4 L12 12" opacity="0.5"/>
    </svg>
  ),
  Pennello: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3 L21 9 L14 16 L8 10 Z"/>
      <path d="M8 10 L4 18 L7 21 L14 16"/>
      <circle cx="5.5" cy="19.5" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Piuma: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3 C 14 4 9 8 6 14 L4 20"/>
      <path d="M8 20 L 11 17"/>
      <path d="M14 6 C 11 8 9 11 8 14"/>
      <path d="M17 5 C 14 6 12 8 11 11" opacity="0.5"/>
    </svg>
  ),
  Prisma: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L21 20 L3 20 Z"/>
      <path d="M12 3 L12 20" opacity="0.45"/>
      <path d="M7 20 L12 10 L17 20" opacity="0.45"/>
    </svg>
  ),
  Scroll: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4 C 5 2.5, 7 2.5, 7 4 V18 C7 20, 9 20, 9 18 V6 H19 V18 C19 20, 17 20, 17 18"/>
      <path d="M9 6 C 9 4.5, 11 4.5, 11 6"/>
      <path d="M11 10 L17 10"/>
      <path d="M11 13 L15 13"/>
    </svg>
  ),
  Arco: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21 V11 A8 8 0 0 1 20 11 V21"/>
      <path d="M4 21 H20"/>
      <path d="M9 21 V13 A3 3 0 0 1 15 13 V21" opacity="0.5"/>
    </svg>
  ),
};
