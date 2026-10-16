import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { copyMonthSchema, ym as ymSchema } from '@fin/shared';
import { UserId } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ZodBody } from '../common/zod-body';
import { MonthsService } from './months.service';

@ApiTags('Months') @ApiBearerAuth()
@Controller('months')
export class MonthsController {
  constructor(private readonly months: MonthsService) {}

  @Post(':ym/open') @HttpCode(200)
  open(@UserId() uid: string, @Param('ym', new ZodPipe(ymSchema)) ym: string) { return this.months.open(uid, ym); }

  @Post(':ym/copy') @HttpCode(200)
  copy(@UserId() uid: string, @Param('ym', new ZodPipe(ymSchema)) ym: string, @ZodBody(copyMonthSchema) b: any) {
    return this.months.copy(uid, ym, b.target, b.overwrite);
  }
}
