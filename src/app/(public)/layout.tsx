import '../globals.css';
import I18nProvider from '../../components/I18nProvider';
import I18nGate from '../../components/I18nGate';
import PublicHeader from '../../components/PublicHeader';
import { fetchSiteInfo } from '../../firebase/admin';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info:', error);
    throw error;
  }

  return (
    <I18nProvider>
      <I18nGate>
        <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50">
          <style>{`
            :root {
              --cream-50: #FEFCF8;
              --cream-100: #FDF8F0;
              --sage-50: #F7F8F6;
              --sage-100: #E8EBE6;
              --sage-200: #D1D8CC;
              --sage-300: #A8B5A0;
              --sage-400: #8B9A7B;
              --sage-500: #6B7A5E;
              --sage-600: #566249;
              --sage-700: #454F3B;
              --sage-800: #373F2F;
              --sage-900: #2C3E36;
              --charcoal: #2C3E36;
            }
            .bg-cream-50 { background-color: var(--cream-50); }
            .bg-cream-100 { background-color: var(--cream-100); }
            .bg-sage-50 { background-color: var(--sage-50); }
            .bg-sage-100 { background-color: var(--sage-100); }
            .bg-sage-600 { background-color: var(--sage-600); }
            .bg-sage-700 { background-color: var(--sage-700); }
            .text-sage-600 { color: var(--sage-600); }
            .text-sage-700 { color: var(--sage-700); }
            .text-charcoal { color: var(--charcoal); }
            .border-sage-200 { border-color: var(--sage-200); }
            .border-sage-600 { border-color: var(--sage-600); }
            .hover\\:bg-sage-700:hover { background-color: var(--sage-700); }
            .hover\\:border-sage-300:hover { border-color: var(--sage-300); }
          `}</style>
          <PublicHeader siteInfo={siteInfo} />
          {children}
        </div>
      </I18nGate>
    </I18nProvider>
  );
}
