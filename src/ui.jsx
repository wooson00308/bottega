import { useState, useRef } from 'react';

// Tooltip wrapper
export const Tooltip = ({ label, children, shortcut, side = 'bottom' }) => {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => { timerRef.current = setTimeout(() => setShow(true), 500); }}
      onMouseLeave={() => { clearTimeout(timerRef.current); setShow(false); }}
    >
      {children}
      {show && (
        <span style={{
          position: 'absolute',
          [side]: 'calc(100% + 6px)',
          left: side === 'right' || side === 'left' ? undefined : '50%',
          top: side === 'right' || side === 'left' ? '50%' : undefined,
          transform: side === 'right' || side === 'left' ? 'translateY(-50%)' : 'translateX(-50%)',
          background: 'oklch(0.1 0 0)',
          color: 'var(--fg)',
          fontSize: 11,
          padding: '5px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 1000,
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {label}
          {shortcut && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-2)',
              padding: '1px 4px', border: '1px solid var(--line)', borderRadius: 3,
            }}>{shortcut}</span>
          )}
        </span>
      )}
    </span>
  );
};

// Icon button with active state
export const IconButton = ({ icon: IconC, label, active, onClick, shortcut, size = 32, disabled, tooltipSide = 'right' }) => (
  <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : (disabled ? 'var(--fg-3)' : 'var(--fg-1)'),
        border: active ? '1px solid var(--accent-line)' : '1px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = 'var(--bg-3)'; }}
      onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = 'transparent'; }}
    >
      <IconC size={16} />
    </button>
  </Tooltip>
);

// Slider with label + value + reset
export const Slider = ({ label, value, min, max, step = 1, unit = '', onChange, defaultValue = 0 }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const zeroPct = ((defaultValue - min) / (max - min)) * 100;
  const isModified = value !== defaultValue;
  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: 'var(--fg-1)', fontSize: 12 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isModified && (
            <button
              onClick={() => onChange(defaultValue)}
              title="초기화"
              style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-2)',
                padding: '1px 4px', borderRadius: 3,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--fg)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
            >reset</button>
          )}
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: isModified ? 'var(--accent)' : 'var(--fg-1)',
            minWidth: 36, textAlign: 'right',
          }}>
            {value > 0 && defaultValue === 0 ? '+' : ''}{value}{unit}
          </span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 8,
          height: 2, background: 'var(--bg-3)', borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', top: 8, height: 2,
          background: 'var(--accent)', borderRadius: 2,
          left: `${Math.min(pct, zeroPct)}%`,
          right: `${100 - Math.max(pct, zeroPct)}%`,
          opacity: isModified ? 1 : 0,
        }} />
        <div style={{
          position: 'absolute', top: 5, left: `${zeroPct}%`,
          width: 1, height: 8, background: 'var(--fg-3)',
          transform: 'translateX(-0.5px)',
        }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 12, height: 12, borderRadius: '50%',
          background: 'var(--fg)',
          border: '2px solid var(--bg-1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
};

// Section header for right panel
export const SectionHeader = ({ icon: IconC, title, right }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--bg-2)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--fg-1)',
  }}>
    {IconC && <IconC size={13} />}
    <span>{title}</span>
    <span style={{ flex: 1 }} />
    {right}
  </div>
);

// Pill button
export const Button = ({ children, onClick, variant = 'default', size = 'md', icon: IconC, disabled, style }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '4px 8px' : '6px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12, fontWeight: 500,
    border: '1px solid var(--line)',
    background: 'var(--bg-2)',
    color: 'var(--fg)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 120ms',
    ...style,
  };
  const variants = {
    primary: { background: 'var(--accent)', color: 'oklch(0.15 0.02 50)', border: '1px solid var(--accent)' },
    ghost: { background: 'transparent', border: '1px solid transparent', color: 'var(--fg-1)' },
    danger: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--danger)' },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{ ...base, ...(variants[variant] || {}) }}
      onMouseEnter={e => {
        if (disabled) return;
        if (variant === 'primary') e.currentTarget.style.filter = 'brightness(1.08)';
        else e.currentTarget.style.background = variant === 'ghost' ? 'var(--bg-3)' : 'var(--bg-3)';
      }}
      onMouseLeave={e => {
        if (disabled) return;
        if (variant === 'primary') e.currentTarget.style.filter = '';
        else e.currentTarget.style.background = variants[variant]?.background || 'var(--bg-2)';
      }}
    >
      {IconC && <IconC size={14} />}
      {children}
    </button>
  );
};
