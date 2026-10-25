using Clinic.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clinic.Api.Data;

public class ClinicDbContext : DbContext
{
    public ClinicDbContext(DbContextOptions<ClinicDbContext> options) : base(options) { }

    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Doctor> Doctors => Set<Doctor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>().ToTable("Patients");
        modelBuilder.Entity<Patient>().Property(p => p.Phone).HasColumnName("Phone");
        modelBuilder.Entity<Doctor>().ToTable("Doctors");
    }
}
