using Dapper;
using Microsoft.Data.SqlClient;

namespace Clinic.Api.Repositories;

public record TodayAppointment(int Id, string FullName, string? Phone, DateTime StartsAt);

public class AppointmentRepository
{
    private readonly string _cs;

    public AppointmentRepository(IConfiguration config)
    {
        _cs = config.GetConnectionString("DefaultConnection")!;
    }

    // Joins Patients by hand; note: no IsDeleted filter here.
    public async Task<IEnumerable<TodayAppointment>> TodayAsync(DateTime day)
    {
        using var conn = new SqlConnection(_cs);
        return await conn.QueryAsync<TodayAppointment>(
            @"SELECT a.Id, p.FullName, p.Phone, a.StartsAt
              FROM Appointments a
              JOIN Patients p ON p.Id = a.PatientId
              WHERE CAST(a.StartsAt AS date) = @day
              ORDER BY a.StartsAt",
            new { day = day.Date });
    }
}
