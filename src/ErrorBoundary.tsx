import React, { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-700 p-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-2xl font-bold">!</span>
            </div>
            <h1 className="text-lg font-bold mb-2">Une erreur est survenue</h1>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message || 'Erreur inattendue'}</p>
            <button onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#1a6fa6] text-white rounded-xl text-sm hover:bg-[#155a8a]">
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
