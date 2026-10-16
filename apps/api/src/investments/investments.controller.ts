import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createInvestmentSchema, updateInvestmentSchema, uuid } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { InvestmentsService } from './investments.service';

@ApiTags('Investments') @ApiBearerAuth()
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly s: InvestmentsService) {}
  @Get() list(@UserId() u: string) { return this.s.list(u); }
  @Post() create(@UserId() u: string, @ZodBody(createInvestmentSchema) b: any) { return this.s.create(u, b); }
  @Patch(':id') update(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(updateInvestmentSchema) b: any) { return this.s.update(u, id, b); }
  @Delete(':id') @HttpCode(204) async remove(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { await this.s.remove(u, id); }
}
