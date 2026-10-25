// nqt-leak-scan: ignore-file  (fictional fixture connection strings)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';
import { extractFunctions } from '../../plugin/scripts/lib/functions.mjs';
import { extractRoutes, extractApiCalls, linkCalls, enclosingFunction, normalizePath } from '../../plugin/scripts/lib/routes.mjs';
import { parseConnectionString, resolveDbUrl } from '../../plugin/scripts/lib/adapter.mjs';
import { efMappings } from '../../plugin/scripts/lib/efcore.mjs';
import { blastRadius } from '../../plugin/scripts/lib/radius.mjs';
import { readSchema } from '../../plugin/scripts/lib/schema.mjs';
import { analyzeImpact } from '../../plugin/scripts/lib/impact.mjs';
import { snapshot } from '../../plugin/scripts/lib/health.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const C = join(fx, 'clinic');
const answers = JSON.parse(readFileSync(join(fx, 'answers', 'clinic.json'), 'utf8'));
const api = join(C, 'src', 'Clinic.Api');
const web = join(C, 'src', 'clinic-web');
const CLINIC_URL = 'sqlserver://sa:Clinic_Local_123@localhost:51433/clinic';
const key = (r) => `${r.method} ${normalizePath(r.path).toLowerCase()}`;

test('C# methods are extracted with Allman braces, attributes and expression bodies', () => {
  const fns = extractFunctions([api]).filter((f) => /PatientsController\.cs$|PatientService\.cs$/.test(f.file));
  const names = fns.map((f) => `${f.file.split('/').pop()}:${f.name}`);
  for (const n of ['PatientService.cs:ListAsync', 'PatientService.cs:GetAsync', 'PatientService.cs:CreateAsync', 'PatientsController.cs:Create', 'PatientsController.cs:List']) {
    assert.ok(names.includes(n), `${n} in ${names.join(', ')}`);
  }
  const list = fns.find((f) => f.name === 'ListAsync');
  assert.ok(list.end - list.start >= 5, 'the body spans the braces on their own lines');
});

test('enclosingFunction understands C# signatures with the brace on the next line', () => {
  const text = readFileSync(join(api, 'Services', 'PatientService.cs'), 'utf8');
  const line = text.split(/\r?\n/).findIndex((l) => l.includes('new PatientDto(p.Id, p.FullName, p.Phone))')) + 1;
  assert.equal(enclosingFunction(text, line), 'ListAsync');
});

test('ASP.NET routes: controller tokens and constraints, minimal API groups, Razor Pages', () => {
  const keys = extractRoutes([api]).map(key);
  for (const r of answers.routes) assert.ok(keys.includes(`${r.split(' ')[0]} ${normalizePath(r.split(' ')[1]).toLowerCase()}`), `${r} in ${keys.join(', ')}`);
});

test('Angular calls built from environment and a base field link to the controller routes', () => {
  const links = linkCalls(extractRoutes([api]), extractApiCalls([web]));
  const by = (f) => links.filter((l) => l.call.file.endsWith(f)).map((l) => key(l.route));
  assert.ok(by('patient.service.ts').includes('GET /api/patients/:p'), JSON.stringify(by('patient.service.ts')));
  assert.ok(by('patient.service.ts').includes('GET /api/patients'));
  assert.ok(by('appointments.service.ts').includes('GET /api/appointments/today'));
});

test('Blazor HttpClient calls and Razor tag helpers are read as calls', () => {
  const root = tmp();
  writeFileSync(join(root, 'Students.razor'), '@code { protected override async Task OnInitializedAsync() { list = await Http.GetFromJsonAsync<List<S>>("api/students"); } }');
  writeFileSync(join(root, 'Index.cshtml'), '<a asp-controller="Students" asp-action="Edit" asp-route-id="1">Edit</a>');
  const calls = extractApiCalls([root]).map((c) => `${c.method ?? '*'} ${c.norm.toLowerCase()}`);
  assert.ok(calls.includes('GET /api/students'), calls.join(', '));
  assert.ok(calls.includes('* /students/edit'), calls.join(', '));
});

test('ADO.NET connection strings are understood for SQL Server, PostgreSQL and MySQL', () => {
  assert.deepEqual(parseConnectionString('Server=localhost,51433;Database=clinic;User Id=sa;Password=x;TrustServerCertificate=True'),
    { engine: 'sqlserver', host: 'localhost', port: 51433, database: 'clinic', user: 'sa', password: 'x' });
  assert.equal(parseConnectionString('Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=app;Integrated Security=True').host, 'localhost');
  assert.equal(parseConnectionString('Server=.;Database=app;Trusted_Connection=True').host, 'localhost');
  assert.equal(parseConnectionString('Host=127.0.0.1;Port=5433;Database=app;Username=u;Password=p').engine, 'postgres');
  assert.equal(parseConnectionString('Server=127.0.0.1;Port=3306;Database=app;Uid=u;Pwd=p').engine, 'mysql');
  assert.equal(parseConnectionString('Server=db.prod.internal;Database=app;User Id=u;Password=p').host, 'db.prod.internal');
});

test('resolveDbUrl reads the connection string from appsettings JSON', () => {
  assert.equal(resolveDbUrl(C, { dbEnvFile: 'src/Clinic.Api/appsettings.Development.json' }), CLINIC_URL);
  assert.equal(resolveDbUrl(C, { dbEnvFile: 'src/Clinic.Api/appsettings.Development.json', dbConnectionName: 'Missing' }), null);
});

test('EF Core mappings connect tables and columns to entity and property names', () => {
  const root = tmp();
  writeFileSync(join(root, 'Db.cs'), [
    'public class AppDb : DbContext {',
    '  public DbSet<PatientContact> Contacts { get; set; }',
    '  protected override void OnModelCreating(ModelBuilder b) {',
    '    b.Entity<PatientContact>().ToTable("tbl_patient_contact");',
    '    b.Entity<PatientContact>().Property(x => x.Phone).HasColumnName("phone_no");',
    '  }',
    '}',
    '[Table("tbl_invoice")]',
    'public class Invoice {',
    '  [Column("amount_vnd")]',
    '  public decimal Amount { get; set; }',
    '}',
  ].join('\n'));
  const m = efMappings([root]);
  assert.deepEqual(m.tables.tbl_patient_contact.sort(), ['Contacts', 'PatientContact']);
  assert.deepEqual(m.columns['tbl_patient_contact.phone_no'], ['Phone']);
  assert.deepEqual(m.tables.tbl_invoice, ['Invoice']);
  assert.deepEqual(m.columns['tbl_invoice.amount_vnd'], ['Amount']);
});

test('callers through a DI interface are found even when the class name differs', () => {
  const root = tmp();
  mkdirSync(join(root, 'api'));
  writeFileSync(join(root, 'api', 'StudentManager.cs'), [
    'public class StudentManager : IStudentService',
    '{',
    '    public string Name(int id)',
    '    {',
    '        return "x";',
    '    }',
    '}',
  ].join('\n'));
  writeFileSync(join(root, 'api', 'IStudentService.cs'), 'public interface IStudentService\n{\n    string Name(int id);\n}\n');
  writeFileSync(join(root, 'api', 'StudentsController.cs'), [
    '[ApiController]',
    '[Route("api/students")]',
    'public class StudentsController : ControllerBase',
    '{',
    '    private readonly IStudentService _s;',
    '    [HttpGet("{id}")]',
    '    public string Get(int id) => _s.Name(id);',
    '}',
  ].join('\n'));
  const r = blastRadius({ file: 'api/StudentManager.cs', fn: 'Name', projectRoot: root, components: [{ name: 'api', root: 'api', kind: 'be' }] });
  assert.ok(r.callers.some((c) => c.file === 'api/StudentsController.cs'), JSON.stringify(r.callers));
  assert.ok(!r.callers.some((c) => c.file === 'api/IStudentService.cs'), 'an interface declaration is not a call');
  assert.deepEqual(r.routes, ['GET /api/students/{id}']);
});

async function clinicSchema(t) {
  try {
    return await readSchema(CLINIC_URL, getDataDir());
  } catch (e) {
    t.skip(`clinic SQL Server not reachable: ${e.message}`);
    return null;
  }
}

test('SQL Server schema: foreign keys, inferred relations, procedures and views', async (t) => {
  const s = await clinicSchema(t);
  if (!s) return;
  assert.equal(s.engine, 'sqlserver');
  assert.ok(s.fks.some((r) => r.from.table === 'Appointments' && r.from.column === 'PatientId' && r.to.table === 'Patients'));
  assert.ok(s.implicit.some((r) => r.from.table === 'Invoices' && r.from.column === 'AppointmentRef' && r.to.table === 'Appointments'));
  assert.ok(s.procedures.some((p) => p.name === 'usp_PatientContacts' && /Phone/.test(p.sql)));
  assert.ok(s.views.some((v) => v.name === 'vw_TodayAppointments'));
});

test('impact of Patients.Phone in the .NET clinic reaches every expected place and the procedure', async (t) => {
  const s = await clinicSchema(t);
  if (!s) return;
  const q = answers.questions[0];
  const r = analyzeImpact({ start: q.start, schema: s, projectRoot: C, components: answers.components });
  const byFile = new Map(r.places.map((p) => [p.file, p]));
  for (const e of q.expectedPlaces) assert.ok(byFile.has(e.file), `missing ${e.file}`);
  for (const n of q.mustNotInclude) assert.ok(!byFile.has(n.file), `must not include ${n.file}`);
  for (const proc of q.expectedProcedures) assert.ok(r.places.some((p) => p.file === `db:procedure/${proc}`), `procedure ${proc}`);
  assert.equal(byFile.get('src/clinic-web/src/app/patients/patient-detail.component.ts').screen, '/patients/:id');
  assert.equal(byFile.get('src/Clinic.Api/Pages/Admin/Patients.cshtml.cs').screen, '/Admin/Patients');
});

test('health snapshot of a .NET project lists csproj packages and data libraries', () => {
  const sn = snapshot({ projectRoot: C, components: answers.components });
  assert.ok(sn.packages.includes('src/Clinic.Api'), sn.packages.join(', '));
  for (const lib of ['Dapper', 'Microsoft.EntityFrameworkCore.SqlServer', 'Microsoft.Data.SqlClient']) assert.ok(sn.dataLibs.includes(lib), `${lib} in ${sn.dataLibs}`);
});
