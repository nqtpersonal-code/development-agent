using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace Clinic.Api.Endpoints;

public record PatientContact(int Id, string FullName, string Phone);

public static class ReminderEndpoints
{
    public static void MapReminders(this WebApplication app)
    {
        var group = app.MapGroup("/api/reminders");
        group.MapPost("/send", async (IConfiguration config) =>
        {
            using var conn = new SqlConnection(config.GetConnectionString("DefaultConnection"));
            var contacts = await conn.QueryAsync<PatientContact>("usp_PatientContacts", commandType: CommandType.StoredProcedure);
            return Results.Ok(new { sent = contacts.Count(c => c.Phone.Length > 0) });
        });
    }
}
