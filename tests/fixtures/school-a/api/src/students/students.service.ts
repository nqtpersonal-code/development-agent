import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateStudentDto {
  fullName: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.student.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, phone: true },
      orderBy: { id: 'asc' },
    });
  }

  get(id: number) {
    return this.prisma.student.findFirst({ where: { id, deletedAt: null } });
  }

  async create(dto: CreateStudentDto) {
    const existing = await this.prisma.student.findFirst({ where: { fullName: dto.fullName, deletedAt: null } });
    if (existing) throw new ConflictException('Học sinh đã tồn tại');
    return this.prisma.student.create({
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined },
    });
  }
}
