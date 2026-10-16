export const MAX_INCOMES_PER_MONTH = 3;
/** Versão atual do tutorial de primeiro acesso. Suba este número para que TODOS vejam o tutorial de novo após uma atualização grande. */
export const TUTORIAL_VERSION = 1;
export const MAX_CREDIT_CARDS = 5;
/** Cartão em alerta a partir de 80% do limite (regra do site atual). */
export const CARD_WARN_RATIO = 0.8;
/** Quando não há despesas no mês, a reserva usa 70% da renda como base (regra do site atual). */
export const RESERVE_FALLBACK_RATIO = 0.7;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
export const SUPPORTED_LOCALES = ['pt', 'en', 'es', 'fr'] as const;

export const INVESTMENT_TYPES = [
  'tesouro_selic', 'cdb', 'fundos_di', 'poupanca', 'acoes', 'fiis', 'cripto', 'outro',
] as const;

export const CRYPTO_COINS = [
  'bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple', 'cardano', 'dogecoin', 'polkadot',
  'matic-network', 'avalanche-2', 'litecoin', 'chainlink', 'shiba-inu', 'tron', 'cosmos',
  'uniswap', 'stellar', 'monero', 'tether', 'usd-coin',
] as const;

/** Mesma paleta de 20 cores do site atual; usada como padrão quando o cliente não escolhe cor. */
export const PALETTE = ['#B85C38','#C9A227','#1F6F54','#3B6B8C','#7A4B8C','#8C5B3B','#4B7A5B','#8C3B5B','#5B6B8C','#556B2F','#A8497A','#2C8C99','#5A4FA8','#C97064','#4FAF7A','#495867','#A13D3D','#8067B7','#A0622D','#2E5945'] as const;
