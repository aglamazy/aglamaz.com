import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function RootLayout({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
