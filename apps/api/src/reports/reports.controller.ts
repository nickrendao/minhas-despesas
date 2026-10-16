import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { duesQuery, summaryQuery, yearlyQuery } from '@fin/shared';
import { z } from 'zod';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ReportsService } from './reports.service';

@ApiTags('Reports') @ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly s: ReportsService) {}
  @Get('summary') summary(@UserId() u: string, @Query(new ZodPipe(summaryQuery)) q: any) { return this.s.summary(u, q.ym, q.reserveMonths); }
  @Get('yearly') yearly(@UserId() u: string, @Query(new ZodPipe(yearlyQuery)) q: any) { return this.s.yearly(u, q.year); }
  @Get('dues') dues(@UserId() u: string, @Query(new ZodPipe(duesQuery)) q: any) { return this.s.dues(u, q.ym); }
  @Get('agenda') agenda(@UserId() u: string, @Query(new ZodPipe(z.object({ months: z.coerce.number().int().min(1).max(12).default(3) }))) q: any) { return this.s.agenda(u, q.months); }
}
