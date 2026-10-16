import type { MetadataRoute } from 'next';
/** Manifesto do app instalável (Android/Chrome/Edge). Os ícones "maskable" cabem no recorte circular do Android. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Minhas Despesas', short_name: 'Despesas', description: 'Controle suas finanças mensais, cartões e investimentos em um só lugar.',
    start_url: '/mensal', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'pt-BR', categories: ['finance', 'productivity'],
    background_color: '#14150D', theme_color: '#14150D',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
