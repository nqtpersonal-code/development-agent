import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPORTABLE = ['full_name', 'phone', 'address'];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Columns are chosen at runtime, so the SQL is built as a string.
  async studentsCsv(columns: string[]) {
    const cols = columns.filter((c) => EXPORTABLE.includes(c));
    const list = (cols.length ? cols : EXPORTABLE).join(', ');
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT ' + list + ' FROM students WHERE deleted_at IS NULL ORDER BY id',
    );
    const header = (cols.length ? cols : EXPORTABLE).join(',');
    return [header, ...rows.map((r) => Object.values(r).join(','))].join('\n');
  }
}
