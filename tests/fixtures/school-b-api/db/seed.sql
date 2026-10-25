SET NAMES utf8mb4;
INSERT INTO students (full_name, phone) VALUES
  ('Vũ Hải Nam', '0981000001'), ('Đặng Mai Lan', '0981000002'), ('Bùi Tiến Phát', NULL);
INSERT INTO teachers (full_name, phone) VALUES ('Ngô Thanh Tâm', '0972000001');
INSERT INTO classes (name, teacher_id) VALUES ('B1', 1);
INSERT INTO enrollments (student_id, class_id) VALUES (1, 1), (2, 1), (3, 1);
INSERT INTO attendance (enrollment_id, date, status) VALUES (1, '2026-09-22', 'present'), (2, '2026-09-22', 'absent');
INSERT INTO sms_queue (student_id, message) VALUES (2, 'Con vắng học ngày 22/09');
