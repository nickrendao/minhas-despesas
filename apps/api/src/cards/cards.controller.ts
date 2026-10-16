import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PALETTE, createCardSchema, createPurchaseSchema, updateCardSchema, uuid } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { CardsService } from './cards.service';


@ApiTags('Credit cards') @ApiBearerAuth()
@Controller('credit-cards')
export class CardsController {
  constructor(private readonly s: CardsService) {}
  @Get() list(@UserId() u: string) { return this.s.list(u); }
  @Get(':id') get(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { return this.s.get(u, id); }
  @Post() async create(@UserId() u: string, @ZodBody(createCardSchema) b: any) {
    return this.s.create(u, { ...b, color: b.color ?? PALETTE[(await this.s.list(u)).length % PALETTE.length] });
  }
  @Patch(':id') update(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(updateCardSchema) b: any) { return this.s.update(u, id, b); }
  @Delete(':id') @HttpCode(204) async remove(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { await this.s.remove(u, id); }

  @Post(':id/purchases') addPurchase(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(createPurchaseSchema) b: any) { return this.s.addPurchase(u, id, b); }
  @Delete(':id/purchases/:purchaseId') @HttpCode(204)
  async removePurchase(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @Param('purchaseId', new ZodPipe(uuid)) pid: string) { await this.s.removePurchase(u, id, pid); }
}
