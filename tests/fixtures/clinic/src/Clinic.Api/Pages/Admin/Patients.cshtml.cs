using Clinic.Api.Models;
using Clinic.Api.Services;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Clinic.Api.Pages.Admin;

public class PatientsModel : PageModel
{
    private readonly IPatientService _patients;

    public PatientsModel(IPatientService patients) => _patients = patients;

    public List<PatientDto> Items { get; private set; } = new();

    public async Task OnGetAsync()
    {
        Items = await _patients.ListAsync();
    }
}
