import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { teacherLabel } from './teacher';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(id: number) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: { teacher: true, enrollments: { include: { student: true } } },
    });
    if (!cls) return null;
    return {
      id: cls.id,
      name: cls.name,
      teacher: cls.teacher ? teacherLabel(cls.teacher) : null,
      students: cls.enrollments
        .filter((e) => e.student.deletedAt === null)
        .map((e) => ({ id: e.student.id, fullName: e.student.fullName })),
    };
  }
}
