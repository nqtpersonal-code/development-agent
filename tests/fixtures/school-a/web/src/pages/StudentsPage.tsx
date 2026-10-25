import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';

interface StudentItem {
  id: number;
  fullName: string;
  phone: string | null;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  useEffect(() => {
    getJson<StudentItem[]>('/api/students').then(setStudents);
  }, []);
  return (
    <section>
      <h1>Học sinh</h1>
      <Link className="btn" to="/students/new">Thêm học sinh</Link>
      <table>
        <thead><tr><th>Mã</th><th>Họ tên</th><th>Học phí</th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.fullName}</td>
              <td><Link to={`/fees/${s.id}`}>Xem hoá đơn</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
