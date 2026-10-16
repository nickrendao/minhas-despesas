import { EXPENSE_ICONS } from '@/components/Icon';

/** Despesas novas guardam a CHAVE de um ícone de linha (ex.: "home"). Despesas antigas guardam um emoji: mapeamos os comuns para o ícone equivalente. */
const LEGACY: [string, string][] = [['🏠', 'home'], ['🏡', 'home'], ['🛒', 'cart'], ['🌐', 'wifi'], ['📶', 'wifi'], ['💡', 'bolt'], ['⚡', 'bolt'], ['🚗', 'car'], ['🚌', 'bus'], ['⛽', 'fuel'],
  ['🍽', 'utensils'], ['🍔', 'utensils'], ['🍕', 'utensils'], ['🥖', 'utensils'], ['🏋', 'dumbbell'], ['💪', 'dumbbell'], ['💻', 'laptop'], ['🖥', 'laptop'], ['🏢', 'building'], ['🧾', 'receipt'],
  ['💧', 'droplet'], ['🔥', 'flame'], ['🐶', 'paw'], ['🐱', 'paw'], ['✈', 'plane'], ['🎁', 'gift'], ['🎬', 'film'], ['🎮', 'gamepad'], ['🎵', 'music'], ['📚', 'book'], ['💊', 'pill'], ['👕', 'shirt'], ['☕', 'coffee']];
const IDS = new Set(EXPENSE_ICONS.map((i) => i.id));
export function expenseIcon(value: string | null | undefined): string {
  const v = value ?? ''; if (IDS.has(v)) return v;
  return LEGACY.find(([k]) => v.startsWith(k))?.[1] ?? 'receipt';
}
export const iconLabel = (id: string) => EXPENSE_ICONS.find((i) => i.id === id)?.label ?? 'Geral';
