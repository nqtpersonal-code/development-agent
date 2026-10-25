using Clinic.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.Api.Controllers;

// Doctor contact card: Phone here is the doctor's phone.
[ApiController]
[Route("api/doctors")]
public class DoctorsController : ControllerBase
{
    private readonly ClinicDbContext _db;

    public DoctorsController(ClinicDbContext db) => _db = db;

    [HttpGet("{id}")]
    public IActionResult Get(int id)
    {
        var d = _db.Doctors.Find(id);
        return d is null ? NotFound() : Ok(new { d.Id, d.FullName, d.Phone });
    }
}
