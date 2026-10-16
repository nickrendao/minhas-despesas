import { ApiError } from '@fin/api-client';

/** Texto amigável por `code` estável da API (a API nunca é a dona das mensagens da interface). */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de entrar. Enviamos um link para você.',
  VALIDATION_ERROR: 'Confira os dados informados.',
  LIMIT_REACHED: 'Você atingiu o limite permitido.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  INVALID_TOKEN: 'Link inválido ou expirado. Peça um novo.',
  API_UNAVAILABLE: 'Serviço indisponível no momento. Tente novamente.',
  FORBIDDEN_ORIGIN: 'Não foi possível concluir por segurança. Recarregue a página.',
  MONTH_NOT_EMPTY: 'O mês de destino já tem dados.',
  INVALID_BACKUP: 'Este arquivo não parece um backup válido do Minhas Despesas.',
  STORAGE_ERROR: 'Não foi possível salvar neste aparelho (sem espaço?).',
  PRIMARY_REQUIRED: 'Para trocar a renda principal, marque outra renda como principal.',
};
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    const first = e.details?.[0]?.message;
    if (e.code === 'VALIDATION_ERROR' && first) return first;
    return MESSAGES[e.code] ?? e.message ?? 'Algo deu errado. Tente novamente.';
  }
  return 'Sem conexão. Verifique sua internet e tente de novo.';
}
