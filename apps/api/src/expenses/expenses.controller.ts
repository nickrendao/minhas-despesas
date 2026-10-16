import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createExpenseSchema, listExpensesQuery, updateExpenseSchema, uuid } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses') @ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly s: ExpensesService) {}
  @Get() list(@UserId() u: string, @Query(new ZodPipe(listExpensesQuery)) q: any) { return this.s.list(u, q); }
  @Post() create(@UserId() u: string, @ZodBody(createExpenseSchema) b: any) { return this.s.create(u, b); }
  @Patch(':id') update(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(updateExpenseSchema) b: any) { return this.s.update(u, id, b); }
  @Delete(':id') @HttpCode(204) async remove(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { await this.s.remove(u, id); }
}
