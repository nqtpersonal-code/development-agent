import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AttendanceRow {
  student_id: number;
  full_name: string;
  class_name: string;
  status: string;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // attendance.enrollment_ref points at enrollments.id (no foreign key).
  byDate(date: string) {
    return this.prisma.$queryRaw<AttendanceRow[]>`
      SELECT s.id AS student_id, s.full_name, c.name AS class_name, a.status
      FROM attendance a
      JOIN enrollments e ON e.id = a.enrollment_ref
      JOIN students s ON s.id = e.student_id
      JOIN classes c ON c.id = e.class_id
      WHERE a.date = ${new Date(date)}::date
      ORDER BY c.name, s.full_name`;
  }
}
