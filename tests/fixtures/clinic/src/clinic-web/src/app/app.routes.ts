import { Routes } from '@angular/router';
import { PatientDetailComponent } from './patients/patient-detail.component';

export const routes: Routes = [
  { path: 'patients/:id', component: PatientDetailComponent },
];
