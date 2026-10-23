import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/ui/BottomNav';
import ServiceWorkerRegistrar from '@/components/ui/ServiceWorkerRegistrar';
import { AppProvider } from '@/components/providers/AppProvider';

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
  themeColor: '#111111',
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
        <AppProvider>
          <main className="max-w-app mx-auto px-5 pt-14 pb-4 min-h-screen">
            {children}
          </main>
          <BottomNav />
          <ServiceWorkerRegistrar />
        </AppProvider>
      </body>
    </html>
  );
}
