import { useEffect, useState } from 'react';
import { getJson } from '../lib/api';

interface AttendanceItem {
  student_id: number;
  full_name: string;
  class_name: string;
  status: string;
}

const LABEL: Record<string, string> = { present: 'Có mặt', absent: 'Vắng', excused: 'Vắng có phép' };

export default function AttendancePage() {
  const [date, setDate] = useState('2026-09-22');
  const [rows, setRows] = useState<AttendanceItem[]>([]);
  useEffect(() => {
    getJson<AttendanceItem[]>(`/api/attendance?date=${date}`).then(setRows);
  }, [date]);
  return (
    <section>
      <h1>Điểm danh</h1>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <table>
        <thead><tr><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.class_name}-${r.student_id}`}>
              <td>{r.class_name}</td>
              <td>{r.full_name}</td>
              <td>{LABEL[r.status] ?? r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
