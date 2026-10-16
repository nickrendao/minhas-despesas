import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { JwtAuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { ConsoleMailer, Mailer, SmtpMailer } from './auth/mailer';
import { PasswordService } from './auth/password.service';
import { TokenService } from './auth/token.service';
import { MeController } from './me/me.controller';
import { MeService } from './me/me.service';
import { MonthsController } from './months/months.controller';
import { MonthsService } from './months/months.service';
import { IncomesController } from './incomes/incomes.controller';
import { IncomesService } from './incomes/incomes.service';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { CardsController } from './cards/cards.controller';
import { CardsService } from './cards/cards.service';
import { InvestmentsController } from './investments/investments.controller';
import { InvestmentsService } from './investments/investments.service';
import { CryptoController } from './crypto/crypto.controller';
import { CryptoService } from './crypto/crypto.service';
import { CoinGeckoProvider, PriceProvider } from './crypto/price.provider';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    PrismaModule,
    // Limite global por IP. Rotas sensíveis (login etc.) têm limite próprio, mais estrito.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => process.env.RATE_LIMIT_DISABLED === 'true' }),
  ],
  controllers: [AuthController, MeController, MonthsController, IncomesController, ExpensesController, CardsController, InvestmentsController, CryptoController, ReportsController, HealthController],
  providers: [
    AuthService, PasswordService, TokenService, MeService, MonthsService, IncomesService, ExpensesService, CardsService, InvestmentsService, CryptoService, ReportsService,
    { provide: Mailer, useFactory: () => (env().MAIL_MODE === 'smtp' ? new SmtpMailer() : new ConsoleMailer()) },
    { provide: PriceProvider, useClass: CoinGeckoProvider },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
