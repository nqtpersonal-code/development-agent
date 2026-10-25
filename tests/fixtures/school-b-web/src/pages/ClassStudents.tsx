import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/http';

interface Row {
  id: number;
  full_name: string;
  phone: string | null;
}

export default function ClassStudents() {
  const { id } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api.get<Row[]>(`/classes/${id}/students`).then(setRows);
  }, [id]);
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}><td>{r.full_name}</td><td>{r.phone}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
