namespace Clinic.Api.Models;

public class Patient
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Doctor
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string? Phone { get; set; }
}

public record PatientDto(int Id, string FullName, string? Phone);
