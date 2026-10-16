import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

/** Formato único de erro: { error: { code, message, details } } — nunca vaza stack/SQL. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Http');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: any = exception.getResponse();
      const code = body?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR');
      const message = status === 429 ? 'Muitas tentativas. Aguarde um pouco e tente de novo.' : (body?.message && typeof body.message === 'string' ? body.message : exception.message);
      return res.status(status).json({ error: { code, message, details: body?.details ?? [] } });
    }
    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.', details: [] } });
  }
}
