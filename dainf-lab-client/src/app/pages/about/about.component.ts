import { EnvironmentService } from '@/shared/services/config.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';

interface BackendInfo {
  version: string;
  artifact: string;
  name: string;
  buildTime: string;
}

interface FrontendBuildInfo {
  version: string;
  buildTime: string;
}

@Component({
  selector: 'app-info-skeleton',
  standalone: true,
  imports: [SkeletonModule],
  template: `
    <div class="flex flex-col gap-3">
      @for (i of [1, 2, 3]; track $index) {
        <p-skeleton height="1.5rem" />
      }
    </div>
  `,
})
export class InfoSkeletonComponent {}

@Component({
  selector: 'app-info-rows',
  standalone: true,
  imports: [CommonModule],
  template: `
    <dl class="flex flex-col gap-2">
      @for (row of rows; track row.label) {
        <div class="flex gap-2">
          <dt class="text-surface-500 min-w-24">{{ row.label }}</dt>
          <dd class="font-medium">{{ row.value }}</dd>
        </div>
      }
    </dl>
  `,
})
export class InfoRowsComponent {
  @Input() rows: { label: string; value: string }[] = [];
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, CardModule, InfoSkeletonComponent, InfoRowsComponent],
  template: `
    <div class="p-6 flex flex-col gap-6">
      <h2 class="text-2xl font-semibold">Sobre o Sistema</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <p-card header="Frontend">
          @if (loading()) {
            <app-info-skeleton />
          } @else {
            <app-info-rows [rows]="frontendRows()" />
          }
        </p-card>

        <p-card header="Backend">
          @if (loading()) {
            <app-info-skeleton />
          } @else {
            <app-info-rows [rows]="backendRows()" />
          }
        </p-card>
      </div>
    </div>
  `,
})
export class AboutComponent implements OnInit {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  loading = signal(true);
  frontendRows = signal<{ label: string; value: string }[]>([]);
  backendRows = signal<{ label: string; value: string }[]>([]);

  ngOnInit(): void {
    forkJoin({
      backend: this.http.get<BackendInfo>(`${this.env.apiUrl}/info`),
      frontend: this.http.get<FrontendBuildInfo>('/build-info.json'),
    }).subscribe({
      next: ({ backend, frontend }) => {
        this.frontendRows.set([
          { label: 'Versão', value: frontend.version },
          { label: 'Build', value: this.formatDate(frontend.buildTime) },
        ]);
        this.backendRows.set([
          { label: 'Versão', value: backend.version },
          { label: 'Artefato', value: backend.artifact },
          { label: 'Build', value: this.formatDate(backend.buildTime) },
        ]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  }
}
