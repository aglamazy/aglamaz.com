'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} />;
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{/* i18n handled by hook in child */}</h2>
            <p className="text-gray-600 mb-4">{/* i18n handled by hook in child */}</p>
            <LocalizedReloadButton />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LocalizedReloadButton() {
  const { t } = useTranslation();
  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('somethingWentWrong') as string}</h2>
      <p className="text-gray-600 mb-4">{t('unexpectedError') as string}</p>
      <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {t('reloadPage')}
      </button>
    </>
  );
}
