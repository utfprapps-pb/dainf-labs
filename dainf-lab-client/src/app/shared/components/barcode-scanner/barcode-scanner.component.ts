import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { ItemService } from '../../../pages/item/item.service';
import { UserService } from '../../../pages/user/user.service';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule],
  template: `
    @if(isAdvancedUser()) {
      <div class="flex items-center gap-2 mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
        <i class="pi pi-barcode text-blue-500 text-2xl"></i>
        <div class="flex-1">
          <label class="block text-sm font-semibold text-blue-800 mb-1">Leitura Rápida (Código de Barras)</label>
          <input 
            pInputText 
            type="text" 
            class="w-full" 
            placeholder="Bipe a matrícula do aluno ou código/patrimônio do item..." 
            [(ngModel)]="barcode"
            (keyup.enter)="onScan()"
            autofocus
          />
          <small class="text-blue-600 block mt-1">
            O sistema identificará automaticamente se o código pertence a um aluno ou item.
          </small>
        </div>
      </div>
    }
  `
})
export class BarcodeScannerComponent {
  @Output() userScanned = new EventEmitter<any>();
  @Output() itemScanned = new EventEmitter<any>();

  barcode: string = '';

  private userService = inject(UserService);
  private itemService = inject(ItemService);
  private messageService = inject(MessageService);
  
  isAdvancedUser = toSignal(this.userService.hasAdvancedPrivileges(), { initialValue: false });

  onScan() {
    const code = this.barcode?.trim();
    if (!code) return;

    this.barcode = ''; // reset input for next scan

    // Tenta primeiro buscar aluno por documento
    this.userService.search({ filters: [{ field: 'documento', value: code, type: 'EQUALS' }] }).subscribe({
      next: (userPage: any) => {
        if (userPage.content && userPage.content.length > 0) {
          const user = userPage.content[0];
          this.messageService.add({ severity: 'success', summary: 'Aluno Encontrado', detail: `Matrícula: ${user.documento} - ${user.nome}` });
          this.userScanned.emit(user);
        } else {
          // Tenta buscar item por siorg
          this.searchItemBySiorg(code);
        }
      },
      error: () => this.searchItemBySiorg(code)
    });
  }

  private searchItemBySiorg(code: string) {
    this.itemService.search({ filters: [{ field: 'siorg', value: code, type: 'EQUALS' }] }).subscribe({
      next: (itemPage: any) => {
        if (itemPage.content && itemPage.content.length > 0) {
          const item = itemPage.content[0];
          this.messageService.add({ severity: 'success', summary: 'Item Encontrado', detail: `Siorg: ${item.siorg} - ${item.name}` });
          this.itemScanned.emit(item);
        } else {
          // Tenta buscar item por patrimônio (serialNumber) através do assets
          this.searchItemByAsset(code);
        }
      },
      error: () => this.searchItemByAsset(code)
    });
  }

  private searchItemByAsset(code: string) {
    // Busca um item que tenha um asset com esse serialNumber
    // Nota: O backend precisa suportar nested filtering como assets.serialNumber
    this.itemService.search({ filters: [{ field: 'assets.serialNumber', value: code, type: 'EQUALS' }] }).subscribe({
      next: (itemPage: any) => {
        if (itemPage.content && itemPage.content.length > 0) {
          const item = itemPage.content[0];
          this.messageService.add({ severity: 'success', summary: 'Ativo Encontrado', detail: `Patrimônio: ${code} - ${item.name}` });
          this.itemScanned.emit(item);
        } else {
          this.messageService.add({ severity: 'error', summary: 'Não Encontrado', detail: 'O código bipado não corresponde a nenhum aluno ou item cadastrado.' });
        }
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro de Busca', detail: 'Erro ao pesquisar código.' });
      }
    });
  }
}
