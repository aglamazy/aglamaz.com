import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

// Rendered per request so multi-tenant hosts get their own domain on the card.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let host = 'famcircle.org';
  try {
    const h = await headers();
    host = h.get('host') || host;
  } catch {
    // headers() unavailable — keep default host
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #6d28d9 55%, #db2777 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 132, lineHeight: 1 }}>👪</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24 }}>{host}</div>
        <div style={{ fontSize: 34, opacity: 0.9, marginTop: 12 }}>
          Family stories, photos &amp; blog — together
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
