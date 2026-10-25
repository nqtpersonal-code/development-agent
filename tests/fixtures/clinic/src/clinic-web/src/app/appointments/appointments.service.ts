import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface TodayAppointment {
  id: number;
  fullName: string;
  phone: string | null;
  startsAt: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  constructor(private http: HttpClient) {}

  today() {
    return this.http.get<TodayAppointment[]>(`${environment.apiUrl}/api/appointments/today`);
  }
}
