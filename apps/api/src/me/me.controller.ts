import { Controller, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { setPinSchema, updateSettingsSchema, verifyPinSchema } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { MeService } from './me.service';

@ApiTags('Me') @ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly s: MeService) {}
  @Get() me(@UserId() u: string) { return this.s.me(u); }
  @Patch('settings') settings(@UserId() u: string, @ZodBody(updateSettingsSchema) b: any) { return this.s.updateSettings(u, b); }
  @Put('pin') pin(@UserId() u: string, @ZodBody(setPinSchema) b: any) { return this.s.setPin(u, b.pin); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('pin/verify') @HttpCode(200)
  verify(@UserId() u: string, @ZodBody(verifyPinSchema) b: any) { return this.s.verifyPin(u, b.pin); }
  @Get('export') exportAll(@UserId() u: string) { return this.s.exportAll(u); }
}
