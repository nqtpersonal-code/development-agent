import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getJson } from '../lib/api';

interface ClassDetail {
  id: number;
  name: string;
  teacher: string | null;
  students: { id: number; fullName: string }[];
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  useEffect(() => {
    getJson<ClassDetail>(`/api/classes/${id}`).then(setCls);
  }, [id]);
  if (!cls) return <p>Đang tải…</p>;
  return (
    <section>
      <h1>Lớp {cls.name}</h1>
      <p>Giáo viên: {cls.teacher}</p>
      <h2>Học sinh</h2>
      <ul>{cls.students.map((s) => <li key={s.id}>{s.fullName}</li>)}</ul>
    </section>
  );
}
