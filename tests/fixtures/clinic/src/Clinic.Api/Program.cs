using Clinic.Api.Data;
using Clinic.Api.Endpoints;
using Clinic.Api.Jobs;
using Clinic.Api.Repositories;
using Clinic.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<ClinicDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<AppointmentRepository>();
builder.Services.AddHostedService<ReminderJob>();
builder.Services.AddControllers();
builder.Services.AddRazorPages();

var app = builder.Build();
app.MapControllers();
app.MapRazorPages();
app.MapReminders();
app.Run();
