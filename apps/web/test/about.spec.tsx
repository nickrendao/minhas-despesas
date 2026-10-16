import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutScreen } from '@/components/AboutScreen';
import { SupportScreen } from '@/components/SupportScreen';
import { fakeApi, renderApp } from './helpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/sobre' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...r }: any) => require('react').createElement('a', { href, ...r }, children) }));
// valores de contato ajustáveis por teste (os componentes leem na hora de desenhar)
const mockSupport: Record<string, string> = {};
jest.mock('@/lib/support', () => ({ get PIX_KEY() { return mockSupport.PIX_KEY ?? ''; }, get PIX_KEY_DISPLAY() { return mockSupport.PIX_KEY_DISPLAY || mockSupport.PIX_KEY || ''; }, get FEEDBACK_EMAIL() { return mockSupport.FEEDBACK_EMAIL ?? ''; }, get PRIVACY_URL() { return mockSupport.PRIVACY_URL ?? ''; }, get SOURCE_URL() { return mockSupport.SOURCE_URL ?? ''; }, get APP_VERSION() { return mockSupport.APP_VERSION || '0.0.0'; } }));
const set = (o: Record<string, string>) => { for (const k of Object.keys(mockSupport)) delete mockSupport[k]; Object.assign(mockSupport, o); };
const render = (el: React.ReactElement) => renderApp(el, fakeApi());

/** A leitura das variáveis NEXT_PUBLIC_* (módulo sem React): carregado isolado com o ambiente desejado. */
function loadSupport(env: Record<string, string>): any {
  const keys = Object.keys(env); const old = Object.fromEntries(keys.map((k) => [k, process.env[k]])); Object.assign(process.env, env); let out: any;
  jest.isolateModules(() => { out = jest.requireActual('@/lib/support'); }); for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } return out;
}

describe('Sobre e ajuda (app local): sem Pix, só o que importa', () => {
  it('mostra versão, o texto de privacidade e os links configurados (abrem fora do app)', () => {
    set({ FEEDBACK_EMAIL: 'contato@exemplo.com', PRIVACY_URL: 'https://exemplo.github.io/privacidade/', SOURCE_URL: 'https://github.com/exemplo/minhas-despesas', APP_VERSION: '1.2.3' }); render(<AboutScreen />);
    expect(screen.getByRole('heading', { name: 'Sobre e ajuda' })).toBeInTheDocument(); expect(screen.getByText('Versão 1.2.3')).toBeInTheDocument(); expect(screen.getByText(/só neste aparelho/)).toBeInTheDocument();
    const fb = screen.getByRole('link', { name: /Enviar feedback/ }); expect(fb.getAttribute('href')).toMatch(/^mailto:contato@exemplo\.com\?subject=/);
    const pv = screen.getByRole('link', { name: /Política de privacidade/ }); expect(pv).toHaveAttribute('href', 'https://exemplo.github.io/privacidade/'); expect(pv).toHaveAttribute('target', '_blank'); expect(pv).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Código-fonte/ })).toHaveAttribute('href', 'https://github.com/exemplo/minhas-despesas');
  });
  it('sem configuração, os links opcionais simplesmente não aparecem (nada de endereço vazio)', () => {
    set({}); const { container } = render(<AboutScreen />); const sup = container.querySelector('.support') as HTMLElement; expect(within(sup).queryAllByRole('link')).toHaveLength(0); expect(screen.getByRole('button', { name: /Rever o tutorial/ })).toBeInTheDocument();
  });
  it('NUNCA menciona Pix, doação ou apoio financeiro', () => {
    set({ FEEDBACK_EMAIL: 'c@e.com', PRIVACY_URL: 'https://x.y/p', PIX_KEY: '+5500000000000' }); const { container } = render(<AboutScreen />);   // mesmo com chave Pix no ambiente
    const sup = container.querySelector('.support') as HTMLElement; expect(sup.textContent).not.toMatch(/pix|doa[çc]|apoie|ajude a mant/i); expect(sup.querySelector('.pix')).toBeNull();   // a tela em si (a casca do site hospedado tem "Apoie" no menu, de propósito)
  });
});

describe('Apoie o projeto (plataforma hospedada): Pix só se configurado', () => {
  it('padrão (sem variáveis): sem chave Pix, sem e-mail, sem dados pessoais no código', () => {
    set({}); const { container } = render(<SupportScreen />);
    expect(container.querySelector('.pix')).toBeNull(); expect(screen.queryByRole('button', { name: /Copiar chave Pix/ })).not.toBeInTheDocument(); expect(screen.queryByRole('link', { name: /Enviar feedback/ })).not.toBeInTheDocument(); expect(container.textContent).not.toMatch(/\+55|rendao|outlook/i);
  });
  it('configurado: mostra a chave, copia e oferece o feedback', async () => {
    const writeText = jest.fn(async () => undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    set({ PIX_KEY: '+5511999990000', PIX_KEY_DISPLAY: '(11) 99999-0000', FEEDBACK_EMAIL: 'c@e.com' }); render(<SupportScreen />);
    expect(screen.getByText('(11) 99999-0000')).toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: /Copiar chave Pix/ })); expect(writeText).toHaveBeenCalledWith('+5511999990000'); expect(screen.getByRole('link', { name: /Enviar feedback/ })).toBeInTheDocument();
  });
});

describe('leitura das variáveis de ambiente (lib/support)', () => {
  it('sem variáveis: tudo vazio (nenhum dado pessoal embutido no código) e versão padrão', () => { const s = loadSupport({}); expect([s.PIX_KEY, s.PIX_KEY_DISPLAY, s.FEEDBACK_EMAIL, s.PRIVACY_URL, s.SOURCE_URL]).toEqual(['', '', '', '', '']); expect(s.APP_VERSION).toBe('4.0.0-alpha'); });
  it('com variáveis: apara espaços; exibição cai para a chave; versão configurável', () => { const s = loadSupport({ NEXT_PUBLIC_PIX_KEY: '  +5511900000000 ', NEXT_PUBLIC_FEEDBACK_EMAIL: ' a@b.com ', NEXT_PUBLIC_APP_VERSION: '2.0.0' }); expect(s.PIX_KEY).toBe('+5511900000000'); expect(s.PIX_KEY_DISPLAY).toBe('+5511900000000'); expect(s.FEEDBACK_EMAIL).toBe('a@b.com'); expect(s.APP_VERSION).toBe('2.0.0'); });
});
