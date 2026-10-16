import { HttpException } from '@nestjs/common';

/** Erro de negócio com código estável (o app/site decide a mensagem por `code`). */
export class AppError extends HttpException {
  constructor(status: number, public readonly code: string, message: string, public readonly details?: unknown[]) {
    super({ code, message, details }, status);
  }
}
export const notFound = (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} não encontrado`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unauthorized = (code = 'UNAUTHORIZED', message = 'Não autenticado') => new AppError(401, code, message);
