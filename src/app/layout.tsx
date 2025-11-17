import './globals.css';
import { fetchSiteInfo } from '../firebase/admin';
import { resolveSiteId } from '../utils/resolveSiteId';
import { getPlatformName } from '../utils/platformName';
import type { Metadata } from 'next';
import { getMemberFromToken } from '@/utils/serverAuth';
import { DEFAULT_LOCALE } from '../i18n';

const GOOGLE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || '';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteInfo = await fetchSiteInfo(undefined, DEFAULT_LOCALE);
    const siteName = siteInfo?.name?.trim();

    return {
      title: siteName ? {
        default: siteName,
        template: `%s | ${siteName}`,
      } : undefined,
      icons: {
        icon: '/favicon.svg',
      },
      verification: {
        google: GOOGLE_VERIFICATION,
      },
    };
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    // Return default metadata instead of throwing
    return {
      title: {
        default: getPlatformName(null),
        template: `%s | ${getPlatformName(null)}`,
      },
      icons: {
        icon: '/favicon.svg',
      },
    };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteId = await resolveSiteId();

  // Fetch member info (will be null if no user is authenticated)
  let memberInfo = null;
  try {
    memberInfo = siteId ? await getMemberFromToken(siteId) : null;
  } catch (error) {
    console.error('Failed to fetch member info:', error);
    // Don't throw - let the app render with null memberInfo
  }

  // Note: siteInfo injection moved to section-specific layouts (/app, /admin, /[locale])
  // where locale context is available for proper localization

  return (
    <html>
      <head>
        {/* Preconnect to Firebase Storage for faster image loading (LCP optimization) */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
