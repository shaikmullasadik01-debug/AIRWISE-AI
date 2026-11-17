import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally avoid logging sensitive user telemetry to console in production
  }

  handleRecover = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
        >
          <div className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Something went wrong while rendering this view</span>
          </div>
          <p className="mt-2 text-sm">{this.state.message}</p>
          <button
            type="button"
            onClick={this.handleRecover}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-xs font-medium text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
