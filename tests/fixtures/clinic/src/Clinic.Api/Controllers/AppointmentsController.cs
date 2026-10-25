using Clinic.Api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.Api.Controllers;

[ApiController]
[Route("api/appointments")]
public class AppointmentsController : ControllerBase
{
    private readonly AppointmentRepository _repo;

    public AppointmentsController(AppointmentRepository repo) => _repo = repo;

    [HttpGet("today")]
    public async Task<IActionResult> Today()
    {
        return Ok(await _repo.TodayAsync(DateTime.Today));
    }
}
