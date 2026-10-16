import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/auth.decorators';
import { AppError } from '../common/app-error';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  /** Liveness simples + confere o banco (usado por hospedagens para saber se o serviço está de pé). */
  @Public() @SkipThrottle() @Get()
  async health() {
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { throw new AppError(503, 'DB_UNAVAILABLE', 'Banco indisponível'); }
    return { status: 'ok' };
  }
}
