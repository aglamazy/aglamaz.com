import ClientLayoutShell from '../../components/ClientLayoutShell';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { headers } from 'next/headers';

export default function RootLayout({ children }) {
  const h = headers();
  const isAuthGate = h.get('x-auth-gate') === '1';

  return (
    <ErrorBoundary>
      {isAuthGate ? <>{children}</> : <ClientLayoutShell>{children}</ClientLayoutShell>}
    </ErrorBoundary>
  );
}
