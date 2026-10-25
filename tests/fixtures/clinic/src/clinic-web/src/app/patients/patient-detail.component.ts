import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Patient, PatientService } from './patient.service';

@Component({
  selector: 'app-patient-detail',
  template: `
    <h1>{{ patient?.fullName }}</h1>
    <p>Điện thoại: {{ patient?.phone ?? 'chưa có' }}</p>
  `,
})
export class PatientDetailComponent implements OnInit {
  patient?: Patient;

  constructor(private route: ActivatedRoute, private patients: PatientService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.patients.get(id).subscribe((p) => (this.patient = p));
  }
}
