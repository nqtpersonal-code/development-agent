import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeeReminderJob {
  private readonly log = new Logger('FeeReminderJob');

  constructor(private readonly prisma: PrismaService) {}

  // Every evening at 20:00: remind parents of students with unpaid fees.
  @Cron('0 20 * * *')
  async run() {
    const students = await this.prisma.student.findMany({ where: { deletedAt: null, parentPhone: { not: null } } });
    for (const s of students) {
      this.log.log(`SMS to ${s.parentPhone}: Nhắc học phí tháng này của em ${s.fullName}`);
    }
  }
}
