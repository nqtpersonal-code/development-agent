import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJson } from '../lib/api';

// 18 fields in a fixed 3-column grid with a wide minimum width.
const FIELDS = [
  ['fullName', 'Họ tên học sinh'], ['birthDate', 'Ngày sinh'], ['gender', 'Giới tính'],
  ['phone', 'Số điện thoại'], ['email', 'Email'], ['address', 'Địa chỉ'],
  ['ward', 'Phường/Xã'], ['district', 'Quận/Huyện'], ['city', 'Tỉnh/Thành phố'],
  ['school', 'Trường đang học'], ['grade', 'Khối lớp'], ['note', 'Ghi chú'],
  ['parentName', 'Họ tên phụ huynh'], ['parentPhone', 'SĐT phụ huynh'], ['parentEmail', 'Email phụ huynh'],
  ['relation', 'Quan hệ'], ['source', 'Biết trung tâm qua'], ['startDate', 'Ngày bắt đầu học'],
] as const;

export default function StudentNewPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await postJson('/api/students', {
        fullName: data.fullName, birthDate: data.birthDate || undefined, phone: data.phone || undefined,
        address: data.address || undefined, parentName: data.parentName || undefined, parentPhone: data.parentPhone || undefined,
      });
      navigate('/students');
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} style={{ minWidth: 1200 }}>
      <h1>Thêm học sinh</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 380px)', gap: 16 }}>
        {FIELDS.map(([name, label]) => (
          <label key={name} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 120 }}>{label}</span>
            <input name={name} required={name === 'fullName'} />
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" style={{ padding: '2px 6px', fontSize: 11 }}>Lưu</button>
    </form>
  );
}
