import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown instead of the children after an error; `reset` retries rendering. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label?: string;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'ErrorBoundary'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="state state-error" role="alert">
        <h3>Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}</h3>
        <p>{error.message}</p>
        <button className="btn" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
