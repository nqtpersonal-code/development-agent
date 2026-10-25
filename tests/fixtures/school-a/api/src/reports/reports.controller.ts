import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('students.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  students(@Query('columns') columns = '') {
    return this.reports.studentsCsv(columns.split(',').filter(Boolean));
  }
}
