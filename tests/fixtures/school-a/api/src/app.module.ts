import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { StudentsController } from './students/students.controller';
import { StudentsService } from './students/students.service';
import { ClassesController } from './classes/classes.controller';
import { ClassesService } from './classes/classes.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { FeesController } from './fees/fees.controller';
import { FeesService } from './fees/fees.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { FeeReminderJob } from './jobs/fee-reminder.job';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [StudentsController, ClassesController, AttendanceController, FeesController, ReportsController],
  providers: [PrismaService, StudentsService, ClassesService, AttendanceService, FeesService, ReportsService, FeeReminderJob],
})
export class AppModule {}
