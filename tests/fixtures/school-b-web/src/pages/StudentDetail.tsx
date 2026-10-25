import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/http';

interface Student {
  id: number;
  full_name: string;
  phone: string | null;
}

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  useEffect(() => {
    api.get<Student>('/students/' + id).then(setStudent);
  }, [id]);
  if (!student) return null;
  return (
    <section>
      <h1>{student.full_name}</h1>
      <p>Điện thoại: {student.phone ?? 'chưa có'}</p>
    </section>
  );
}
