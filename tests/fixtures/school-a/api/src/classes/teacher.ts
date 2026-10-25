// Formatting for teachers. Note: fullName here is the teacher's name.
export interface TeacherRow {
  id: number;
  fullName: string;
}

export function teacherLabel(t: TeacherRow) {
  return `GV. ${t.fullName}`;
}
