import { PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppError } from './app-error';

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos',
        r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
    }
    return r.data;
  }
}
