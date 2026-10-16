import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

export interface CoinPrice { brl: number; change24h: number | null }
export abstract class PriceProvider { abstract getBrlPrices(ids: string[]): Promise<Record<string, CoinPrice>> }

/**
 * CoinGecko chamada PELO SERVIDOR (e não pelo navegador de cada usuário):
 * cache de 30s compartilhado por todos → muito menos requisições e sem risco de bloqueio por IP do usuário.
 * Se a CoinGecko falhar, devolve o último valor em cache (se houver) e o resto como "sem cotação".
 */
@Injectable()
export class CoinGeckoProvider extends PriceProvider {
  private readonly log = new Logger('CoinGecko');
  private cache = new Map<string, { at: number; price: CoinPrice }>();
  private inflight = new Map<string, Promise<Record<string, CoinPrice>>>();
  private readonly TTL = 30_000;

  async getBrlPrices(ids: string[]): Promise<Record<string, CoinPrice>> {
    const unique = [...new Set(ids)].sort();
    const out: Record<string, CoinPrice> = {};
    const stale: string[] = [];
    for (const id of unique) {
      const hit = this.cache.get(id);
      if (hit && Date.now() - hit.at < this.TTL) out[id] = hit.price; else stale.push(id);
    }
    if (stale.length) Object.assign(out, await this.fetchDedup(stale));
    return out;
  }

  private fetchDedup(ids: string[]) {
    const key = ids.join(',');
    let p = this.inflight.get(key);
    if (!p) { p = this.fetchRemote(ids).finally(() => this.inflight.delete(key)); this.inflight.set(key, p); }
    return p;
  }

  private async fetchRemote(ids: string[]): Promise<Record<string, CoinPrice>> {
    const result: Record<string, CoinPrice> = {};
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=brl&include_24hr_change=true`;
      const headers: Record<string, string> = { accept: 'application/json' };
      if (env().COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = env().COINGECKO_API_KEY!;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Record<string, { brl?: number; brl_24h_change?: number }>;
      for (const id of ids) {
        const r = json[id];
        if (r && typeof r.brl === 'number') {
          result[id] = { brl: r.brl, change24h: typeof r.brl_24h_change === 'number' ? r.brl_24h_change : null };
          this.cache.set(id, { at: Date.now(), price: result[id] });
        }
      }
    } catch (e) {
      this.log.warn(`Falha ao buscar cotações: ${(e as Error).message}`);
      for (const id of ids) { const old = this.cache.get(id); if (old) result[id] = old.price; }
    }
    return result;
  }
}
