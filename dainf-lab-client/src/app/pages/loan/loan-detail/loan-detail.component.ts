import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef, DialogService } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { Loan, LoanItem } from '../loan';
import { LoanService } from '../loan.service';
import { ItemService } from '../../item/item.service';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { ReturnService } from '../../return/return.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TableModule,
    SearchSelectComponent,
    InputNumberModule
  ],
  providers: [ReturnService],
  selector: 'app-loan-detail-dialog',
  templateUrl: './loan-detail.component.html',
})
export class LoanDetailDialog implements OnInit {
  config = inject(DynamicDialogConfig);
  ref = inject(DynamicDialogRef);
  loanService = inject(LoanService);
  itemService = inject(ItemService);
  messageService = inject(MessageService);
  returnService = inject(ReturnService);

  loan!: Loan;
  showAddModal = signal(false);
  
  // Para adicionar novos itens
  newItems = signal<{ item: any; quantity: number }[]>([]);
  selectedItem: any = null;
  itemQuantity: number = 1;

  ngOnInit(): void {
    this.loan = this.config.data?.loan;
    this.returnService.findByLoan(this.loan).subscribe({
      next: (ret) => {
        if (ret && ret.items) {
          this.loan.items.forEach((item: any) => {
            const retItem = ret.items!.find((r: any) => r.item?.id === item.item?.id);
            item.returnedQuantity = retItem ? retItem.quantityReturned : 0;
          });
        }
      },
      error: () => {}
    });
  }

  getGroupedItems() {
    const groups: { [key: string]: LoanItem[] } = {};
    this.loan.items.forEach(item => {
      // Busca a categoria pai se existir para agrupar em "Ferramentas" ou "Componentes"
      let category = item.item.category;
      let groupName = category?.description || 'Outros';
      
      // Se for uma subcategoria, tenta pegar a descrição da categoria pai
      // Nota: No frontend o objeto Category pode não ter o objeto 'parent' carregado dependendo da API
      // Mas baseando-se no design, se a descrição contiver "Ferramenta" ou "Componente" ou se for o grupo principal.
      if (groupName.toLowerCase().includes('ferramenta')) groupName = 'Ferramentas';
      else if (groupName.toLowerCase().includes('componente')) groupName = 'Componentes';

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });
    return Object.entries(groups).map(([name, items]) => ({ name, items }));
  }

  openAddModal() {
    this.showAddModal.set(true);
    this.newItems.set([]);
    this.selectedItem = null;
    this.itemQuantity = 1;
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  addItemToList() {
    if (!this.selectedItem) return;
    
    const existing = this.newItems().find(i => i.item.id === this.selectedItem.id);
    if (existing) {
      existing.quantity += this.itemQuantity;
      this.newItems.set([...this.newItems()]);
    } else {
      this.newItems.update(items => [...items, { item: this.selectedItem, quantity: this.itemQuantity }]);
    }
    
    this.selectedItem = null;
    this.itemQuantity = 1;
  }

  removeItemFromList(index: number) {
    this.newItems.update(items => items.filter((_, i) => i !== index));
  }

  confirmAddItems() {
    if (this.newItems().length === 0) return;

    // Adiciona os novos itens ao empréstimo existente
    const updatedItems = [...this.loan.items];
    
    this.newItems().forEach(newItem => {
      const existing = updatedItems.find(li => li.item.id === newItem.item.id);
      if (existing) {
        existing.quantity += newItem.quantity;
      } else {
        updatedItems.push({
          item: newItem.item,
          quantity: newItem.quantity
        } as LoanItem);
      }
    });

    const payload = {
      ...this.loan,
      items: updatedItems
    };

    this.loanService.update(this.loan.id, payload).subscribe({
      next: (res) => {
        this.loan = res;
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Itens adicionados com sucesso' });
        this.closeAddModal();
        this.close(); // Close the main dialog to return to the loans list
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar itens' });
      }
    });
  }

  close() {
    this.ref.close(this.loan);
  }
}
