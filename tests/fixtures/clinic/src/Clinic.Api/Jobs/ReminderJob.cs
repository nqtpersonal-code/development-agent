using Clinic.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Clinic.Api.Jobs;

// Background job: reminds patients of tomorrow's appointments.
public class ReminderJob : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ReminderJob> _log;

    public ReminderJob(IServiceProvider services, ILogger<ReminderJob> log)
    {
        _services = services;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
            var patients = await db.Patients.Where(p => !p.IsDeleted && p.Phone != null).ToListAsync(stoppingToken);
            foreach (var p in patients) _log.LogInformation("SMS to {Phone} for {Name}", p.Phone, p.FullName);
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}
