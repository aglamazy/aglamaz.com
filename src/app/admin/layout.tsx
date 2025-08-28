import ClientLayoutShell from '@/components/ClientLayoutShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Reuse the authenticated site template (header, footer, modals)
  return <ClientLayoutShell>{children}</ClientLayoutShell>;
}

