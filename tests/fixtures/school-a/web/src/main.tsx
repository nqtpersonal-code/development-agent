import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import StudentsPage from './pages/StudentsPage';
import StudentNewPage from './pages/StudentNewPage';
import ClassDetailPage from './pages/ClassDetailPage';
import AttendancePage from './pages/AttendancePage';
import FeeInvoicePage from './pages/FeeInvoicePage';

function App() {
  return (
    <BrowserRouter>
      <header>
        <Link to="/students">Học sinh</Link>
        <Link to="/classes/1">Lớp L1</Link>
        <Link to="/attendance">Điểm danh</Link>
      </header>
      <main>
        <Routes>
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/new" element={<StudentNewPage />} />
          <Route path="/classes/:id" element={<ClassDetailPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/fees/:studentId" element={<FeeInvoicePage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
