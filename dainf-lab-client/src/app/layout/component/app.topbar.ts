import { AuthService } from '@/pages/auth/services/auth.service';
import { CartComponent } from '@/shared/components/cart-component/cart.component';
import { CartService } from '@/shared/services/cart.service';
import {
  NotificationService,
  Notification,
} from '@/shared/services/notification.service';
import { ContextStore } from '@/shared/store/context-store.service';
import { UserService } from '@/pages/user/user.service';
import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { PopoverModule } from 'primeng/popover';
import { StyleClassModule } from 'primeng/styleclass';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, EMPTY, map } from 'rxjs';
import { LayoutService } from '../service/layout.service';
import { AppConfigurator } from './app.configurator';
import { LogoComponent } from './logo.component';
import { UserDropdownComponent } from './user-dropdown.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    StyleClassModule,
    AppConfigurator,
    LogoComponent,
    UserDropdownComponent,
    BadgeModule,
    TooltipModule,
    PopoverModule,
    CartComponent,
  ],
  providers: [UserService, DatePipe],
  template: `
    <div class="layout-topbar">
      <div class="layout-topbar-logo-container">
        <button
          class="layout-menu-button layout-topbar-action"
          (click)="layoutService.onMenuToggle()"
        >
          <i class="pi pi-bars"></i>
        </button>
        <a class="layout-topbar-logo" routerLink="/dashboard">
          <app-logo></app-logo>
          <span>DAELE</span>
        </a>
      </div>

      <div class="layout-topbar-actions mr-8 md:mr-16">
        <div class="layout-config-menu">
          <button
            type="button"
            class="layout-topbar-action"
            (click)="toggleDarkMode()"
            pTooltip="Mudar Tema"
            tooltipPosition="bottom"
          >
            <i
              [ngClass]="{
                'pi ': true,
                'pi-moon': layoutService.isDarkTheme(),
                'pi-sun': !layoutService.isDarkTheme(),
              }"
            ></i>
          </button>
          <div class="relative">
            <app-configurator />
          </div>
        </div>

        <button
          class="layout-topbar-menu-button layout-topbar-action lg:hidden"
          pStyleClass="@next"
          enterFromClass="hidden"
          enterActiveClass="animate-scalein"
          leaveToClass="hidden"
          leaveActiveClass="animate-fadeout"
          [hideOnOutsideClick]="true"
        >
          <i class="pi pi-ellipsis-v"></i>
        </button>

        <div
          class="layout-topbar-menu hidden lg:flex lg:items-center pr-8 mr-4"
        >
          <div
            class="layout-topbar-menu-content flex items-start justify-start gap-2 "
          >
            @if (userCanUseCart$ | async) {
              <!-- BOTÃO DO CARRINHO -->
              <button
                class="layout-topbar-action max-w-min p-overlay-badge"
                pTooltip="Carrinho de Itens"
                tooltipPosition="bottom"
                (click)="cartPopover.toggle($event)"
              >
                <i class="pi pi-shopping-cart text-lg"></i>
                @if (cartItemCount() > 0) {
                  <p-badge
                    [value]="cartItemCount()"
                    severity="danger"
                  ></p-badge>
                }
              </button>

              <!-- POPOVER -->
              <p-popover #cartPopover [dismissable]="true">
                <app-cart></app-cart>
              </p-popover>
            }

            <!-- BOTÃO DE NOTIFICAÇÕES -->
            <button
              class="layout-topbar-action max-w-min p-overlay-badge"
              pTooltip="Notificações"
              tooltipPosition="bottom"
              (click)="toggleNotifications($event, notifPopover)"
            >
              <i class="pi pi-bell text-lg"></i>
              @if (unreadCount() > 0) {
                <p-badge [value]="unreadCount()" severity="danger"></p-badge>
              }
            </button>

            <!-- POPOVER DE NOTIFICAÇÕES -->
            <p-popover
              #notifPopover
              [dismissable]="true"
              styleClass="notif-popover"
            >
              <div class="w-80 max-h-96 flex flex-col">
                <div
                  class="p-3 border-b flex justify-between items-center bg-gray-50"
                >
                  <span class="font-bold text-gray-700">Notificações</span>
                  <button
                    *ngIf="unreadCount() > 0"
                    class="text-xs text-blue-600 hover:underline"
                    (click)="markAllAsRead()"
                  >
                    Marcar todas como lidas
                  </button>
                </div>
                <div class="overflow-y-auto flex-1 p-2">
                  <div
                    *ngIf="notifications.length === 0"
                    class="p-4 text-center text-gray-500 text-sm"
                  >
                    Nenhuma notificação não lida.
                  </div>
                  <div
                    *ngFor="let notif of notifications"
                    (click)="onNotificationClick(notif, notifPopover)"
                    class="cursor-pointer p-3 mb-2 rounded border bg-white shadow-sm flex flex-col gap-1 relative group transition-colors hover:bg-gray-50"
                  >
                    <div class="flex justify-between items-start">
                      <span class="font-semibold text-sm text-gray-800">{{
                        notif.title
                      }}</span>
                      <span class="text-[10px] text-gray-400">{{
                        formatDate(notif.createdAt)
                      }}</span>
                    </div>
                    <span class="text-xs text-gray-600">{{
                      notif.message
                    }}</span>
                    <button
                      class="absolute top-2 right-2 text-gray-300 hover:text-blue-500 hidden group-hover:block"
                      (click)="$event.stopPropagation(); markAsRead(notif.id)"
                      pTooltip="Marcar como lida"
                      tooltipPosition="left"
                    >
                      <i class="pi pi-check-circle"></i>
                    </button>
                  </div>
                </div>
              </div>
            </p-popover>

            <!-- USUÁRIO -->
            <app-user-dropdown [items]="userMenuItems"></app-user-dropdown>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .cart-popover {
        width: 350px;
        padding: 0;
        overflow: hidden;
      }
      :host ::ng-deep .notif-popover {
        padding: 0;
      }
    `,
  ],
})
export class AppTopbar implements OnInit {
  userMenuItems: MenuItem[] = [
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
    },
  ];

  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  router = inject(Router);
  cartService = inject(CartService);
  userService = inject(UserService);
  context = inject(ContextStore);
  notificationService = inject(NotificationService);
  datePipe = inject(DatePipe);
  messageService = inject(MessageService);

  cartItemCount = this.cartService.itemCount;
  userCanUseCart$ = this.userService
    .hasAdvancedPrivileges()
    .pipe(map((hasPrivileges) => !hasPrivileges));

  unreadCount = signal<number>(0);
  notifications: Notification[] = [];
  pollingInterval: any;
  isFirstLoad = true;

  ngOnInit(): void {
    this.cartService.loadCart();
    this.loadUnreadCount();
    this.pollingInterval = setInterval(() => {
      this.loadUnreadCount();
    }, 15000); // 15 seconds
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  loadUnreadCount() {
    this.notificationService
      .getUnreadCount()
      .pipe(
        catchError((err) => {
          console.error(
            '[Notificações] Erro ao buscar contagem não lida:',
            err,
          );
          return EMPTY;
        }),
      )
      .subscribe((count) => {
        const prev = this.unreadCount();
        if (!this.isFirstLoad && count > prev) {
          this.messageService.add({
            severity: 'info',
            summary: 'Nova Notificação',
            detail: 'Você tem uma nova notificação não lida.',
          });
        }
        this.unreadCount.set(count);
        this.isFirstLoad = false;
      });
  }

  toggleNotifications(event: any, popover: any) {
    if (!popover.overlayVisible) {
      this.notificationService
        .getNotifications(true, 0, 10)
        .subscribe((res) => {
          this.notifications = res.content;
        });
    }
    popover.toggle(event);
  }

  markAsRead(id: number) {
    this.notificationService.markAsRead(id).subscribe(() => {
      this.notifications = this.notifications.filter((n) => n.id !== id);
      this.unreadCount.set(Math.max(0, this.unreadCount() - 1));
    });
  }

  onNotificationClick(notif: Notification, popover: any) {
    this.markAsRead(notif.id);
    if (notif.actionUrl) {
      popover.hide();
      this.router.navigateByUrl(notif.actionUrl);
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notifications = [];
      this.unreadCount.set(0);
    });
  }

  formatDate(dateStr: string): string {
    return this.datePipe.transform(dateStr, 'dd/MM/yy HH:mm') || '';
  }

  toggleDarkMode() {
    this.layoutService.layoutConfig.update((state) => ({
      ...state,
      darkTheme: !state.darkTheme,
    }));
  }

  logout() {
    this.cartService.resetCartState();
    this.context.clear();
    this.authService.logout();
    this.router.navigate(['login']);
  }
}
