import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Aglamaz App',
  description: 'Demo app with Firebase auth',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
