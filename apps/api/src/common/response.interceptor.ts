import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

/** Resposta de listas paginadas: o interceptor separa `data` e `meta`. */
export class Paginated<T> {
  constructor(public readonly items: T[], public readonly meta: Record<string, unknown>) {}
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((value) => {
      if (value instanceof Paginated) return { data: value.items, meta: value.meta };
      if (value === undefined) return undefined;
      return { data: value };
    }));
  }
}
