import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createIncomeSchema, updateIncomeSchema, uuid, ym } from '@fin/shared';
import { z } from 'zod';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { IncomesService } from './incomes.service';

@ApiTags('Incomes') @ApiBearerAuth()
@Controller('incomes')
export class IncomesController {
  constructor(private readonly s: IncomesService) {}
  @Get() list(@UserId() u: string, @Query(new ZodPipe(z.object({ ym }))) q: any) { return this.s.list(u, q.ym); }
  @Post() create(@UserId() u: string, @ZodBody(createIncomeSchema) b: any) { return this.s.create(u, b); }
  @Patch(':id') update(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(updateIncomeSchema) b: any) { return this.s.update(u, id, b); }
  @Delete(':id') @HttpCode(204) async remove(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { await this.s.remove(u, id); }
}
