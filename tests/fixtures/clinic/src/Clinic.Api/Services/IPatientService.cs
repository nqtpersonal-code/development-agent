using Clinic.Api.Models;

namespace Clinic.Api.Services;

public interface IPatientService
{
    Task<List<PatientDto>> ListAsync();
    Task<PatientDto?> GetAsync(int id);
    Task<PatientDto> CreateAsync(PatientDto input);
}
