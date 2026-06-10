export function Badge({ label, color, size = 'md' }) {
  const padding = size === 'sm' ? '0.15rem 0.5rem' : '0.2rem 0.625rem'
  const fontSize = size === 'sm' ? '0.6875rem' : '0.75rem'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: '99px',
      fontWeight: 500, whiteSpace: 'nowrap', padding, fontSize,
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {label}
    </span>
  )
}
