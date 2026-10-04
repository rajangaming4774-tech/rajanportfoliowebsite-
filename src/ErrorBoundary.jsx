import { Component } from 'react'

const style = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'var(--mono)',
}
const box = {
  width: 'min(560px, 100%)',
  padding: '20px 22px',
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'rgba(12, 12, 12, 0.92)',
  boxShadow: '0 0 80px rgba(255, 255, 255, 0.1)',
}
const button = {
  font: 'inherit',
  fontWeight: 600,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--amber)',
  background: 'transparent',
  color: 'var(--amber)',
  cursor: 'pointer',
}

// Catches render and lazy-load failures (WebGL unavailable, chunk fetch error).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('3D world failed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { onClassic, onTerminal } = this.props
    return (
      <div style={style} role="alert">
        <div style={box}>
          <p style={{ margin: 0, color: 'var(--red)' }}>[FAIL] 3D world crashed</p>
          <p style={{ margin: '10px 0 0', color: 'var(--amber)' }}>
            The city could not load. Your device or browser may not support WebGL, or the network dropped.
          </p>
          <p style={{ margin: '10px 0 18px', color: 'var(--dim)' }}>
            No problem. Everything is also available in the classic site.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={button} onClick={onClassic}>
              Open classic site
            </button>
            <button type="button" style={{ ...button, borderColor: 'var(--line)', color: 'var(--text)' }} onClick={onTerminal}>
              Back to terminal
            </button>
          </div>
        </div>
      </div>
    )
  }
}
