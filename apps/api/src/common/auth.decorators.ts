import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Id do usuário autenticado — SEMPRE vem do token validado, nunca do corpo/URL. */
export const UserId = createParamDecorator((_d: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest().userId);
