-- No foreign keys on purpose: relations exist only by naming and in queries.
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL,
  deleted_at DATETIME NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  teacher_id INT NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  class_id INT NOT NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(10) NOT NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE sms_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  sent_at DATETIME NULL
) DEFAULT CHARSET=utf8mb4;
