import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import StudentDetail from './pages/StudentDetail';
import ClassStudents from './pages/ClassStudents';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/students/:id" element={<StudentDetail />} />
      <Route path="/classes/:id/students" element={<ClassStudents />} />
    </Routes>
  </BrowserRouter>,
);
