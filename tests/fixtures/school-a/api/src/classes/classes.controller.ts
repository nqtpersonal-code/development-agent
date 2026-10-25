import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.classes.detail(id);
  }
}
