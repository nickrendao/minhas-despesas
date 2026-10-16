import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCryptoSchema, updateCryptoSchema, uuid } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { CryptoService } from './crypto.service';

@ApiTags('Crypto') @ApiBearerAuth()
@Controller('crypto-holdings')
export class CryptoController {
  constructor(private readonly s: CryptoService) {}
  @Get() list(@UserId() u: string) { return this.s.list(u); }
  @Get('valuation') valuation(@UserId() u: string) { return this.s.valuation(u); }
  @Post() create(@UserId() u: string, @ZodBody(createCryptoSchema) b: any) { return this.s.create(u, b); }
  @Patch(':id') update(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string, @ZodBody(updateCryptoSchema) b: any) { return this.s.update(u, id, b); }
  @Delete(':id') @HttpCode(204) async remove(@UserId() u: string, @Param('id', new ZodPipe(uuid)) id: string) { await this.s.remove(u, id); }
}
