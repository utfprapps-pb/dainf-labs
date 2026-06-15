import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvironmentService } from './config.service';

export interface Notification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private environmentService = inject(EnvironmentService);

  private get apiUrl(): string {
    return `${this.environmentService.apiUrl}/notifications`;
  }

  getNotifications(unreadOnly: boolean = false, page: number = 0, size: number = 20): Observable<Page<Notification>> {
    let params = new HttpParams()
      .set('unreadOnly', unreadOnly.toString())
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<Page<Notification>>(this.apiUrl, { params });
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unread-count`);
  }

  markAsRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/read-all`, {});
  }
}
