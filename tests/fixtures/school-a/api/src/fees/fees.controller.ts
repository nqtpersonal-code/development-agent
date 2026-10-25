import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FeesService } from './fees.service';

@Controller('fees')
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get(':studentId/invoice')
  invoice(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.fees.invoice(studentId);
  }
}
