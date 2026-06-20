'use client';

import React from 'react';

interface Props {
    children: React.ReactNode;
    /** Optional custom fallback UI. Defaults to a centred error card. */
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
                    <div className="max-w-md w-full rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 shadow-lg p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
                                Something went wrong
                            </h2>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            The application encountered an unexpected error. Your work may not have been
                            saved.
                        </p>
                        {this.state.error && (
                            <pre className="text-xs bg-gray-100 dark:bg-gray-900 rounded p-3 overflow-x-auto text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                            >
                                Try again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                            >
                                Reload page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
