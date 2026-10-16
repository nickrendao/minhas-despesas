import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { unauthorized } from '../common/app-error';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

export interface SessionTokens { accessToken: string; refreshToken: string; expiresIn: number; tokenType: 'Bearer' }

/**
 * Access token: JWT HS256 curto (15 min), sem estado — o app/site envia em "Authorization: Bearer".
 * Refresh token: opaco, aleatório, guardado SÓ como hash (sha256) no banco, ROTATIVO:
 * cada uso gera um novo e invalida o anterior. Reuso de um token já trocado = possível roubo
 * → toda a "família" de sessões é revogada.
 */
@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  signAccess(userId: string): { token: string; expiresIn: number } {
    const expiresIn = env().ACCESS_TOKEN_TTL_SECONDS;
    return { token: jwt.sign({ sub: userId, typ: 'access' }, env().JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn }), expiresIn };
  }

  verifyAccess(token: string): string {
    try {
      const p = jwt.verify(token, env().JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (p.typ !== 'access' || typeof p.sub !== 'string') throw new Error('bad payload');
      return p.sub;
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Sessão inválida ou expirada');
    }
  }

  async issueSession(userId: string, userAgent?: string, familyId: string = randomUUID()): Promise<SessionTokens> {
    const refreshToken = randomToken();
    const expiresAt = new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: sha256(refreshToken), expiresAt, userAgent: userAgent?.slice(0, 200) },
    });
    const { token, expiresIn } = this.signAccess(userId);
    return { accessToken: token, refreshToken, expiresIn, tokenType: 'Bearer' };
  }

  async rotate(refreshToken: string, userAgent?: string): Promise<SessionTokens & { userId: string }> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row) throw unauthorized('INVALID_REFRESH_TOKEN', 'Sessão inválida. Entre novamente.');
    if (row.revokedAt) {
      // Reuso de token já usado: derruba a família inteira.
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw unauthorized('REFRESH_TOKEN_REUSED', 'Sessão encerrada por segurança. Entre novamente.');
    }
    if (row.expiresAt < new Date()) throw unauthorized('REFRESH_TOKEN_EXPIRED', 'Sessão expirada. Entre novamente.');

    const next = randomToken();
    const expiresAt = new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (claimed.count !== 1) throw unauthorized('REFRESH_TOKEN_REUSED', 'Sessão encerrada por segurança. Entre novamente.');
      const created = await tx.refreshToken.create({
        data: { userId: row.userId, familyId: row.familyId, tokenHash: sha256(next), expiresAt, userAgent: userAgent?.slice(0, 200) },
      });
      await tx.refreshToken.update({ where: { id: row.id }, data: { replacedById: created.id } });
    });
    const { token, expiresIn } = this.signAccess(row.userId);
    return { accessToken: token, refreshToken: next, expiresIn, tokenType: 'Bearer', userId: row.userId };
  }

  async revokeFamilyByToken(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (row) await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
