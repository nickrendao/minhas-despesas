import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema, deleteAccountSchema, forgotPasswordSchema, loginSchema, refreshSchema,
  registerSchema, resetPasswordSchema, verifyEmailSchema,
} from '@fin/shared';
import { Public, UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { AuthService } from './auth.service';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Throttle(STRICT) @Post('register') @HttpCode(201)
  register(@ZodBody(registerSchema) b: any) { return this.auth.register(b.email, b.password); }

  @Public() @Throttle(STRICT) @Post('verify-email') @HttpCode(204)
  async verify(@ZodBody(verifyEmailSchema) b: any) { await this.auth.verifyEmail(b.token); }

  @Public() @Throttle(STRICT) @Post('login') @HttpCode(200)
  login(@ZodBody(loginSchema) b: any, @Headers('user-agent') ua?: string) { return this.auth.login(b.email, b.password, ua); }

  @Public() @Throttle(STRICT) @Post('refresh') @HttpCode(200)
  refresh(@ZodBody(refreshSchema) b: any, @Headers('user-agent') ua?: string) { return this.auth.refresh(b.refreshToken, ua); }

  @Public() @Post('logout') @HttpCode(204)
  async logout(@ZodBody(refreshSchema) b: any) { await this.auth.logout(b.refreshToken); }

  @Public() @Throttle(STRICT) @Post('forgot-password') @HttpCode(202)
  async forgot(@ZodBody(forgotPasswordSchema) b: any) { await this.auth.forgotPassword(b.email); return { message: 'Se o e-mail existir, enviamos as instruções.' }; }

  @Public() @Throttle(STRICT) @Post('reset-password') @HttpCode(204)
  async reset(@ZodBody(resetPasswordSchema) b: any) { await this.auth.resetPassword(b.token, b.password); }

  @Throttle(STRICT) @Post('change-password') @HttpCode(200)
  change(@UserId() uid: string, @ZodBody(changePasswordSchema) b: any, @Headers('user-agent') ua?: string) {
    return this.auth.changePassword(uid, b.currentPassword, b.newPassword, ua);
  }

  @Throttle(STRICT) @Post('delete-account') @HttpCode(204)
  async del(@UserId() uid: string, @ZodBody(deleteAccountSchema) b: any) { await this.auth.deleteAccount(uid, b.password); }
}
