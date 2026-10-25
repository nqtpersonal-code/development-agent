IF DB_ID('clinic') IS NULL CREATE DATABASE clinic;
GO
USE clinic;
GO
CREATE TABLE Patients (
  Id INT IDENTITY PRIMARY KEY,
  FullName NVARCHAR(120) NOT NULL,
  Phone NVARCHAR(20) NULL,
  IsDeleted BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE TABLE Doctors (
  Id INT IDENTITY PRIMARY KEY,
  FullName NVARCHAR(120) NOT NULL,
  Phone NVARCHAR(20) NULL
);
CREATE TABLE Appointments (
  Id INT IDENTITY PRIMARY KEY,
  PatientId INT NOT NULL REFERENCES Patients(Id),
  DoctorId INT NOT NULL REFERENCES Doctors(Id),
  StartsAt DATETIME2 NOT NULL,
  Status NVARCHAR(20) NOT NULL
);
-- AppointmentRef holds an Appointments.Id without a foreign key.
CREATE TABLE Invoices (
  Id INT IDENTITY PRIMARY KEY,
  AppointmentRef INT NOT NULL,
  Amount DECIMAL(12, 2) NOT NULL
);
GO
CREATE PROCEDURE dbo.usp_PatientContacts AS
BEGIN
  SELECT Id, FullName, Phone FROM Patients WHERE IsDeleted = 0 AND Phone IS NOT NULL;
END
GO
CREATE VIEW dbo.vw_TodayAppointments AS
SELECT a.Id, p.FullName, a.StartsAt FROM Appointments a JOIN Patients p ON p.Id = a.PatientId;
GO
INSERT INTO Patients (FullName, Phone, IsDeleted) VALUES (N'Ngô Bảo Châu', '0933000001', 0), (N'Lý Thu Trang', '0933000002', 0), (N'Đinh Văn Cũ', '0933000009', 1);
INSERT INTO Doctors (FullName, Phone) VALUES (N'BS. Trịnh Hoà', '0944000001');
INSERT INTO Appointments (PatientId, DoctorId, StartsAt, Status) VALUES (1, 1, '2026-10-26T09:00:00', 'booked'), (3, 1, '2026-10-26T10:00:00', 'booked');
INSERT INTO Invoices (AppointmentRef, Amount) VALUES (1, 350000);
GO
