import { Component } from 'react';

// Last-resort guard so a render error shows a recovery screen instead of a blank page. No stack traces are shown.
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { if (import.meta.env.DEV) console.error(error); } // eslint-disable-line no-console
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fullscreen-center">
        <div className="state-box" role="alert">
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p className="muted">An unexpected error occurred. Reloading usually fixes it.</p>
          <div className="state-action"><button className="btn btn-primary" onClick={() => window.location.assign('/')}>Reload the app</button></div>
        </div>
      </div>
    );
  }
}
