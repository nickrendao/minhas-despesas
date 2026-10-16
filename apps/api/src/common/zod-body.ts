import { Body } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z, ZodType } from 'zod';
import { ZodPipe } from './zod.pipe';

/**
 * Valida o corpo com Zod E documenta o mesmo schema no Swagger.
 * Uma única fonte de verdade: o que a API aceita é exatamente o que a documentação mostra.
 */
export function ZodBody(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodPipe(schema))(target, key, index);
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete json.$schema;
    ApiBody({ schema: json as any })(target, key as string, Object.getOwnPropertyDescriptor(target, key as string)!);
  };
}
