import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar, MobileNav } from '@/components/layout';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LeadFlow - Prospection B2B',
  description: 'Outil de prospection B2B intelligent et performant',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="min-h-screen">
          {/* Sidebar - desktop only */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
            <div className="p-6 lg:p-8">
              {children}
            </div>
          </main>

          {/* Mobile navigation */}
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
