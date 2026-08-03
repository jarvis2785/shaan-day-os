import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import ServiceWorkerRegistrar from '@/components/ui/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'DayOS',
  description: 'Your personal day intelligence system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DayOS',
  },
  icons: {
    apple: '/icon-apple-touch.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#080808',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-apple-touch.png" />
      </head>
      <body className="bg-bg text-text-primary">
        <main className="max-w-app mx-auto px-4 pt-12 pb-4 min-h-screen">
          {children}
        </main>
        <BottomNav />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
