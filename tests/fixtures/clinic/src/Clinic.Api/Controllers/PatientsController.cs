using Clinic.Api.Models;
using Clinic.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patients;

    public PatientsController(IPatientService patients)
    {
        _patients = patients;
    }

    [HttpGet]
    public async Task<ActionResult<List<PatientDto>>> List()
    {
        return await _patients.ListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PatientDto>> Get(int id)
    {
        var p = await _patients.GetAsync(id);
        return p is null ? NotFound() : p;
    }

    [HttpPost]
    public async Task<ActionResult<PatientDto>> Create(PatientDto input) => await _patients.CreateAsync(input);
}
