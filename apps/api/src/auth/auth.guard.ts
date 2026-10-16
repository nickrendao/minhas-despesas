import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../common/auth.decorators';
import { unauthorized } from '../common/app-error';
import { TokenService } from './token.service';

/** Guard GLOBAL: toda rota exige token, exceto as marcadas com @Public(). Seguro por padrão. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw unauthorized('MISSING_TOKEN', 'Autenticação necessária');
    req.userId = this.tokens.verifyAccess(header.slice(7));
    return true;
  }
}
