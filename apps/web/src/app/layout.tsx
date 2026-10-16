import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

const DESC = 'Controle suas finanças mensais, cartões e investimentos em um só lugar.';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minhasdespesas021.com.br'),
  title: 'Minhas Despesas', description: DESC, applicationName: 'Minhas Despesas', manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }], shortcut: '/favicon.ico', apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  appleWebApp: { capable: true, title: 'Despesas', statusBarStyle: 'black-translucent' },
  other: { 'apple-mobile-web-app-capable': 'yes' },   // iOS anterior ao 16.4 só abre em tela cheia com esta marcação legada
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Minhas Despesas', title: 'Minhas Despesas', description: DESC, images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Minhas Despesas — seu dinheiro, sem complicação' }] },
  twitter: { card: 'summary_large_image', title: 'Minhas Despesas', description: DESC, images: ['/og-image.png'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#14150D' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
