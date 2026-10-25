import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateStudentDto, StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list() {
    return this.students.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.students.get(id);
  }

  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }
}
