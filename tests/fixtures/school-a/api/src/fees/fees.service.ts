import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  // Fee total = sessions * price per day, 10% off from the 20th session.
  total(sessions: number, pricePerDay: number) {
    const base = sessions * pricePerDay;
    return sessions >= 20 ? Math.round(base * 0.9) : base;
  }

  async invoice(studentId: number) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) return null;
    const fees = await this.prisma.fee.findMany({ where: { studentId }, orderBy: { month: 'asc' } });
    return {
      studentName: student.fullName,
      lines: fees.map((f) => ({ month: f.month, sessions: f.sessions, amount: this.total(f.sessions, f.pricePerDay) })),
    };
  }
}
