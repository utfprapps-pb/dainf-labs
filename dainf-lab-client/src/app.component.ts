import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ToastModule],
  template: `<router-outlet></router-outlet> <p-toast [style]="{zIndex: 99999}" />`,
})
export class AppComponent {}
