import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Patient {
  id: number;
  fullName: string;
  phone: string | null;
}

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly base = `${environment.apiUrl}/api/patients`;

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Patient[]>(this.base);
  }

  get(id: number) {
    return this.http.get<Patient>(`${this.base}/${id}`);
  }
}
