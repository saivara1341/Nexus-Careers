import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected app error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Nexus runtime error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-text-base flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-red-500/30 bg-red-500/10 rounded-lg p-6 text-center">
          <h1 className="font-display text-2xl text-red-300 mb-3">Nexus recovered from an app error</h1>
          <p className="text-sm text-text-muted mb-5">
            The app hit a runtime issue. Restarting the screen usually restores the session.
          </p>
          <p className="text-xs text-red-200/80 bg-black/30 rounded p-2 mb-5 break-words">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-black rounded-md px-4 py-2 font-bold uppercase text-xs tracking-wider"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
