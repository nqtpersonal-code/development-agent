import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getJson } from '../lib/api';
import { feeTotal } from './fees/total';

interface Invoice {
  studentName: string;
  lines: { month: string; sessions: number; amount: number }[];
}

export default function FeeInvoicePage() {
  const { studentId } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  useEffect(() => {
    getJson<Invoice>(`/api/fees/${studentId}/invoice`).then(setInvoice);
  }, [studentId]);
  if (!invoice) return <p>Đang tải…</p>;
  return (
    <section>
      <h1>Hoá đơn học phí — {invoice.studentName}</h1>
      <table>
        <thead><tr><th>Tháng</th><th>Số buổi</th><th>Thành tiền</th><th>Dự tính lại</th></tr></thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.month}>
              <td>{l.month}</td>
              <td>{l.sessions}</td>
              <td>{l.amount.toLocaleString('vi-VN')} đ</td>
              <td>{feeTotal(l.sessions, 150000).toLocaleString('vi-VN')} đ</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
