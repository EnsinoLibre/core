import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[view error]', error); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--space-6)' }}>
          <div className="el-card" style={{ borderColor: 'var(--color-danger-fg)' }}>
            <h2 className="el-card__title">Something went wrong in this view</h2>
            <pre className="knw-error" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-danger-fg)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button className="el-button" onClick={() => this.setState({ error: null })}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
