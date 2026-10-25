// Fictional seed data for the school-a fixture.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE attendance, fees, enrollments, classes, teachers, students RESTART IDENTITY CASCADE');
  const t1 = await prisma.teacher.create({ data: { fullName: 'Lê Thu Hà' } });
  const t2 = await prisma.teacher.create({ data: { fullName: 'Phạm Quốc Bảo' } });
  const l1 = await prisma.class.create({ data: { name: 'L1', teacherId: t1.id } });
  const l2 = await prisma.class.create({ data: { name: 'L2', teacherId: t2.id } });
  const names = ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Châu', 'Phạm Gia Dũng', 'Hoàng Thu Em'];
  const students = [];
  for (const [i, fullName] of names.entries()) {
    students.push(await prisma.student.create({
      data: { fullName, phone: `0900000${i + 10}`, parentName: `PH ${fullName}`, parentPhone: `0910000${i + 10}` },
    }));
  }
  // Soft-deleted student still enrolled and with attendance (trap T7).
  const gone = await prisma.student.create({ data: { fullName: 'Đỗ Văn Cũ', deletedAt: new Date('2026-08-01') } });
  const enroll = async (s, c) => prisma.enrollment.create({ data: { studentId: s.id, classId: c.id } });
  const e = [];
  for (const s of students.slice(0, 3)) e.push(await enroll(s, l1));
  for (const s of students.slice(3)) e.push(await enroll(s, l2));
  e.push(await enroll(gone, l1));
  const day = new Date('2026-09-22');
  const statuses = ['present', 'absent', 'excused', 'present', 'present', 'present'];
  for (const [i, en] of e.entries()) {
    await prisma.attendance.create({ data: { enrollmentRef: en.id, date: day, status: statuses[i] } });
  }
  for (const s of students) {
    await prisma.fee.create({ data: { studentId: s.id, month: '2026-09', sessions: 18 + s.id, pricePerDay: 150000 } });
  }
}

main().finally(() => prisma.$disconnect());
