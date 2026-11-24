import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Nav } from './nav';
import { AuthProvider } from './lib/auth';
import { ProfileProvider } from './lib/profile';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Banner Factory',
  description: 'Personalised retargeting banners for Elgiganten, made on demand.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <ProfileProvider>
            <Nav />
            {children}
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
