/** Áreas do app. `primary` aparece na barra lateral e no menu inferior; o resto fica em "Mais". */
export const NAV = [
  { href: '/mensal', label: 'Mensal', short: 'Mês', icon: 'calendar', desc: 'Resumo e despesas do mês' },
  { href: '/cartao', label: 'Cartões', short: 'Cartões', icon: 'card', desc: 'Limites, faturas e parcelas' },
  { href: '/anual', label: 'Visão anual', short: 'Ano', icon: 'bars', desc: 'Gastos mês a mês' },
  { href: '/agenda', label: 'Agenda', short: 'Agenda', icon: 'clock', desc: 'Vencimentos dos próximos meses' },
  { href: '/investir', label: 'Investimentos', short: 'Investir', icon: 'sprout', desc: 'Planos e reserva de emergência' },
  { href: '/cripto', label: 'Cripto', short: 'Cripto', icon: 'coin', desc: 'Suas moedas, em tempo real' },
] as const;
export const NAV_FOOT = [
  { href: '/config', label: 'Configurações', icon: 'sliders', desc: 'Perfil, tema, privacidade e segurança' },
  { href: '/apoie', label: 'Apoie o projeto', icon: 'heart', desc: 'Pix e feedback' },
] as const;
/** Rodapé do menu no app local: sem doações. */
export const NAV_FOOT_LOCAL = [
  { href: '/config', label: 'Configurações', icon: 'sliders', desc: 'Perfil, tema, privacidade e backup' },
  { href: '/sobre', label: 'Sobre e ajuda', icon: 'help', desc: 'Versão, feedback e privacidade' },
] as const;
export const BOTTOM_PRIMARY = ['/mensal', '/cartao', '/anual'];
/** compat: lista simples (testes antigos / links) */
export const TABS = [...NAV.map((n) => ({ href: n.href, label: n.label })), { href: '/config', label: 'Config' }] as const;
