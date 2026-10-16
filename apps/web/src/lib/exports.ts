import { isIOS } from './platform';

/** Exportações do cartão (regras iguais ao site atual). Funções PURAS: recebem os dados e devolvem texto. */
export interface ExportPurchase { name: string; amountCents: number; installmentCurrent: number | null; installmentTotal: number | null }
export interface ExportCard { name: string; purchases: ExportPurchase[] }

const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const q = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV para Excel brasileiro: separador ";" e vírgula decimal. (O BOM de UTF-8 é adicionado no download.) */
export function buildCardsCsv(cards: ExportCard[]): string | null {
  const rows: string[][] = [['Cartão', 'Gasto', 'Parcela', 'Valor (R$)']];
  for (const c of cards) for (const p of c.purchases) {
    rows.push([c.name, p.name, p.installmentTotal ? `${p.installmentCurrent ?? 1}/${p.installmentTotal}` : '', reais(p.amountCents)]);
  }
  return rows.length === 1 ? null : rows.map((r) => r.map(q).join(';')).join('\n');
}

/** CSV do mês (rendas + despesas), para Excel brasileiro. */
export interface MonthRow { kind: 'Renda' | 'Despesa fixa' | 'Despesa variável'; name: string; dueDay: number | null; installmentCurrent: number | null; installmentTotal: number | null; amountCents: number }
export function buildMonthCsv(rows: MonthRow[]): string | null {
  if (!rows.length) return null;
  const head = ['Tipo', 'Nome', 'Vencimento', 'Parcela', 'Valor (R$)'];
  const body = rows.map((r) => [r.kind, r.name, r.dueDay ? `dia ${r.dueDay}` : '', r.installmentTotal ? `${r.installmentCurrent ?? 1}/${r.installmentTotal}` : '', reais(r.amountCents)]);
  return [head, ...body].map((r) => r.map(q).join(';')).join('\n');
}

const ofxDate = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}000000`;

/** OFX 1.0.2 (extrato de cartão). O app não guarda data por compra, então usa a data da exportação (igual ao site atual). */
export function buildCardsOfx(cards: ExportCard[], now: Date = new Date()): string | null {
  const when = ofxDate(now); let idx = 0; let total = 0; let tx = '';
  for (const c of cards) for (const p of c.purchases) {
    idx++; total += p.amountCents;
    const name = `${c.name} - ${p.name}`.replace(/[<>&]/g, '').slice(0, 60);
    tx += `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${when}<TRNAMT>-${(p.amountCents / 100).toFixed(2)}<FITID>${idx}<NAME>${name}</STMTTRN>\n`;
  }
  if (idx === 0) return null;
  return 'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n'
    + `<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>${when}<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>`
    + `<CREDITCARDMSGSRSV1><CCSTMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS><CCSTMTRS><CURDEF>BRL<CCACCTFROM><ACCTID>MEUSCARTOES</CCACCTFROM>`
    + `<BANKTRANLIST><DTSTART>${when}<DTEND>${when}\n${tx}</BANKTRANLIST>`
    + `<LEDGERBAL><BALAMT>-${(total / 100).toFixed(2)}<DTASOF>${when}</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
}

/** Download comum (âncora). */
function anchorDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);   // revogar na hora quebra downloads em alguns navegadores/WebViews
}
/** No iPhone/iPad o Safari não "baixa" como o Android: abrimos a folha de compartilhar (com "Salvar em Arquivos"). Devolve true se tratou. */
function shareOnIOS(filename: string, blob: Blob, mime: string): boolean {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || !isIOS()) return false;
  let file: File; try { file = new File([blob], filename, { type: mime.split(';')[0] }); } catch { return false; }
  if (!nav.canShare({ files: [file] })) return false;
  nav.share({ files: [file], title: filename }).catch((e: any) => { if (e?.name !== 'AbortError') anchorDownload(filename, blob); });   // cancelar a folha não é erro
  return true;
}
export function download(filename: string, content: string, mime: string, bom = false) {
  const blob = new Blob([bom ? '\uFEFF' + content : content], { type: mime });
  if (!shareOnIOS(filename, blob, mime)) anchorDownload(filename, blob);
}
