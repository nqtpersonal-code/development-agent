using Clinic.Api.Data;
using Clinic.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Clinic.Api.Services;

public class PatientService : IPatientService
{
    private readonly ClinicDbContext _db;

    public PatientService(ClinicDbContext db)
    {
        _db = db;
    }

    public async Task<List<PatientDto>> ListAsync()
    {
        return await _db.Patients
            .Where(p => !p.IsDeleted)
            .Select(p => new PatientDto(p.Id, p.FullName, p.Phone))
            .ToListAsync();
    }

    public async Task<PatientDto?> GetAsync(int id)
    {
        var p = await _db.Patients.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        return p is null ? null : new PatientDto(p.Id, p.FullName, p.Phone);
    }

    public async Task<PatientDto> CreateAsync(PatientDto input)
    {
        var entity = new Patient { FullName = input.FullName, Phone = input.Phone };
        _db.Patients.Add(entity);
        await _db.SaveChangesAsync();
        return new PatientDto(entity.Id, entity.FullName, entity.Phone);
    }
}
