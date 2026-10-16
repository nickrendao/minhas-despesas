import { fireEvent, render, screen } from '@testing-library/react';
import { InstallHint } from '@/components/InstallHint';
import { download } from '@/lib/exports';
import { canInstallPwa, isIOS } from '@/lib/platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const setNav = (o: Record<string, unknown>) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(window.navigator, k, { value: v, configurable: true, writable: true }); };
const bytes = (f: File) => new Promise<number[]>((res) => { const r = new FileReader(); r.onload = () => res([...new Uint8Array(r.result as ArrayBuffer)]); r.readAsArrayBuffer(f); });

describe('detecção de iPhone/iPad', () => {
  it('iPhone, iPad e iPadOS (que se apresenta como Mac com toque) são iOS; Mac comum, Android e vazio não', () => {
    expect(isIOS({ userAgent: IPHONE })).toBe(true); expect(isIOS({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)' })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false); expect(isIOS({ userAgent: ANDROID })).toBe(false); expect(isIOS({})).toBe(false);
  });
  it('instalar PWA exige https (ou localhost para testar)', () => { expect(canInstallPwa({ protocol: 'https:', hostname: 'app.exemplo.com.br' })).toBe(true); expect(canInstallPwa({ protocol: 'http:', hostname: 'localhost' })).toBe(true); expect(canInstallPwa({ protocol: 'http:', hostname: 'exemplo.com' })).toBe(false); expect(canInstallPwa({ protocol: 'file:', hostname: '' })).toBe(false); });
});

describe('backup no iPhone: folha de compartilhar ("Salvar em Arquivos")', () => {
  let anchor: jest.SpyInstance; const flush = () => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => { (URL as any).createObjectURL = jest.fn(() => 'blob:x'); (URL as any).revokeObjectURL = jest.fn(); anchor = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); });
  afterEach(() => { anchor.mockRestore(); setNav({ userAgent: 'jsdom', share: undefined, canShare: undefined, platform: '', maxTouchPoints: 0 }); });

  it('no iPhone o arquivo vai para a folha de compartilhar, com o nome e o conteúdo certos (CSV com BOM, tipo sem charset)', async () => {
    const share = jest.fn(async () => undefined); setNav({ userAgent: IPHONE, share, canShare: () => true });
    download('despesas-2026-10.csv', 'Tipo;Nome', 'text/csv;charset=utf-8', true); expect(share).toHaveBeenCalledTimes(1); const arg = (share.mock.calls[0] as any[])[0]; const f: File = arg.files[0];
    expect(f.name).toBe('despesas-2026-10.csv'); expect(f.type).toBe('text/csv'); const b = await bytes(f); expect(b.slice(0, 3)).toEqual([0xEF, 0xBB, 0xBF]); expect(Buffer.from(b.slice(3)).toString('utf8')).toBe('Tipo;Nome');   // BOM de UTF-8 preservado (o Excel precisa dele) expect(anchor).not.toHaveBeenCalled();
  });
  it('se a folha não aceitar arquivos (canShare falso) usa o download comum', () => { const share = jest.fn(); setNav({ userAgent: IPHONE, share, canShare: () => false }); download('a.json', '{}', 'application/json'); expect(share).not.toHaveBeenCalled(); expect(anchor).toHaveBeenCalledTimes(1); });
  it('se compartilhar FALHAR de verdade, cai no download comum; se a pessoa só CANCELAR, não faz nada', async () => {
    const boom = jest.fn(async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); }); setNav({ userAgent: IPHONE, share: boom, canShare: () => true }); download('a.json', '{}', 'application/json'); await flush(); expect(anchor).toHaveBeenCalledTimes(1);
    anchor.mockClear(); const cancel = jest.fn(async () => { throw Object.assign(new Error('cancelado'), { name: 'AbortError' }); }); setNav({ share: cancel }); download('b.json', '{}', 'application/json'); await flush(); expect(cancel).toHaveBeenCalled(); expect(anchor).not.toHaveBeenCalled();
  });
  it('fora do iPhone (Android, computador) nunca usa a folha de compartilhar', () => { const share = jest.fn(); setNav({ userAgent: ANDROID, share, canShare: () => true }); download('a.csv', 'x', 'text/csv'); expect(share).not.toHaveBeenCalled(); expect(anchor).toHaveBeenCalledTimes(1); });
  it('navegador sem a função de compartilhar no iPhone antigo: download comum, sem erro', () => { setNav({ userAgent: IPHONE, share: undefined, canShare: undefined }); expect(() => download('a.csv', 'x', 'text/csv')).not.toThrow(); expect(anchor).toHaveBeenCalledTimes(1); });
});

describe('dica "Adicionar à Tela de Início" (só no Safari do iPhone)', () => {
  const https = { protocol: 'https:', hostname: 'app.exemplo.com.br' }; beforeEach(() => localStorage.clear());
  it('aparece no Safari do iPhone com instruções claras', () => { render(<InstallHint loc={https} ios standalone={false} />); const n = screen.getByRole('note', { name: 'Como instalar no iPhone' }); expect(n).toHaveTextContent('Adicionar à Tela de Início'); expect(n).toHaveTextContent('Compartilhar'); });
  it('NÃO aparece: no Android/PC, no app já instalado, fora de https ou em arquivo local', () => {
    for (const p of [{ loc: https, ios: false, standalone: false }, { loc: https, ios: true, standalone: true }, { loc: { protocol: 'http:', hostname: 'exemplo.com' }, ios: true, standalone: false }, { loc: { protocol: 'file:', hostname: '' }, ios: true, standalone: false }]) { const { container, unmount } = render(<InstallHint {...p} />); expect(container.firstChild).toBeNull(); unmount(); }
  });
  it('"Entendi" some e não volta nas próximas aberturas', () => { const a = render(<InstallHint loc={https} ios standalone={false} />); fireEvent.click(screen.getByRole('button', { name: 'Entendi' })); expect(screen.queryByRole('note')).not.toBeInTheDocument(); a.unmount(); const b = render(<InstallHint loc={https} ios standalone={false} />); expect(b.container.firstChild).toBeNull(); });
});
