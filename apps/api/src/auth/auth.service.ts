import { Injectable } from '@nestjs/common';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AppError, unauthorized } from '../common/app-error';
import { Mailer } from './mailer';
import { PasswordService } from './password.service';
import { randomToken, sha256, SessionTokens, TokenService } from './token.service';

const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 30 * 60_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mailer: Mailer,
  ) {}

  /** Resposta idêntica para e-mail novo e já existente: não revela quem tem conta (anti-enumeração). */
  async register(email: string, password: string): Promise<{ requiresEmailVerification: boolean }> {
    const requires = env().REQUIRE_EMAIL_VERIFICATION;
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (!exists) {
      const passwordHash = await this.passwords.hash(password);
      const user = await this.prisma.user.create({
        data: { email, passwordHash, passwordAlgo: 'scrypt', emailVerifiedAt: requires ? null : new Date(), settings: { create: {} } },
      });
      if (requires) await this.sendVerification(user.id, email);
    }
    return { requiresEmailVerification: requires };
  }

  private async sendVerification(userId: string, email: string) {
    const token = randomToken();
    await this.prisma.authToken.create({ data: { userId, type: 'EMAIL_VERIFY', tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) } });
    await this.mailer.send({
      to: email, subject: 'Confirme seu e-mail — Minhas Despesas',
      text: `Para ativar sua conta, abra o link (vale por 24h):\n${env().WEB_URL}/verify-email?token=${token}\n\nSe não foi você, ignore este e-mail.`,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.type !== 'EMAIL_VERIFY' || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_TOKEN', 'Link inválido ou expirado');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
  }

  async login(email: string, password: string, userAgent?: string): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) { await this.passwords.dummyVerify(); throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'); }
    const ok = await this.passwords.verify(password, user.passwordHash, user.passwordAlgo);
    if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
    if (env().REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirme seu e-mail antes de entrar');
    }
    if (this.passwords.needsRehash(user.passwordAlgo)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(password), passwordAlgo: 'scrypt' } });
    }
    return this.tokens.issueSession(user.id, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string): Promise<SessionTokens> {
    const { userId: _u, ...session } = await this.tokens.rotate(refreshToken, userAgent);
    return session;
  }

  async logout(refreshToken: string): Promise<void> { await this.tokens.revokeFamilyByToken(refreshToken); }

  /** Sempre "ok", exista ou não o e-mail. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    await this.prisma.authToken.updateMany({ where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null }, data: { usedAt: new Date() } });
    const token = randomToken();
    await this.prisma.authToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
    await this.mailer.send({
      to: email, subject: 'Redefinir senha — Minhas Despesas',
      text: `Para criar uma nova senha, abra o link (vale por 30 minutos):\n${env().WEB_URL}/reset-password?token=${token}\n\nSe não foi você, ignore este e-mail.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const row = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.type !== 'PASSWORD_RESET' || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_TOKEN', 'Link inválido ou expirado');
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash, passwordAlgo: 'scrypt', emailVerifiedAt: new Date() } }),
      this.prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await this.tokens.revokeAllForUser(row.userId); // derruba todas as sessões abertas
  }

  async changePassword(userId: string, current: string, next: string, userAgent?: string): Promise<SessionTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.verify(current, user.passwordHash, user.passwordAlgo))) {
      throw new AppError(400, 'WRONG_PASSWORD', 'Senha atual incorreta');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.passwords.hash(next), passwordAlgo: 'scrypt' } });
    await this.tokens.revokeAllForUser(userId);
    return this.tokens.issueSession(userId, userAgent);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.verify(password, user.passwordHash, user.passwordAlgo))) {
      throw new AppError(400, 'WRONG_PASSWORD', 'Senha incorreta');
    }
    await this.prisma.user.delete({ where: { id: userId } }); // CASCADE apaga todos os dados do usuário
  }
}
