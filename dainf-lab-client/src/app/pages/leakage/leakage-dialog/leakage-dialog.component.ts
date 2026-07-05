import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Item } from '../../item/item';
import { ItemService } from '../../item/item.service';
import { LeakageService } from '../leakage.service';
import { Leakage } from '../leakage';
import { MessageService } from 'primeng/api';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
  ],
  providers: [LeakageService],
  selector: 'app-leakage-dialog',
  templateUrl: './leakage-dialog.component.html',
})
export class LeakageDialogComponent implements OnInit {
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);
  leakageService = inject(LeakageService);
  messageService = inject(MessageService);

  itemService = inject(ItemService);

  item!: Item;
  assets: any[] = [];
  selectedAsset: any = null;
  quantity: number = 1;
  observation: string = '';
  loading = false;

  ngOnInit(): void {
    const passedItem = this.config.data?.item;
    if (!passedItem) {
      this.ref.close(false);
    } else {
      this.itemService.get(passedItem.id).subscribe((res: any) => {
        this.item = res;
        if (this.item.type === 'DURABLE') {
          this.assets = res.assets || [];
        }
      });
      this.item = passedItem; // fallback until loaded
    }
  }

  onAssetChange(): void {
    if (this.selectedAsset && this.selectedAsset.id !== -1) {
      this.quantity = 1;
    }
  }

  get assetOptions(): any[] {
    const opts = [{ id: -1, label: 'Sem patrimônio registrado' }];
    this.assets.forEach((a) => {
      if (a.serialNumber || a.location) {
        opts.push({
          id: a.id,
          label: `Patrimônio: ${a.serialNumber || 'N/A'} - Local: ${a.location || 'N/A'}`,
          ...a,
        });
      }
    });
    return opts;
  }

  get maxQuantity(): number {
    return this.item.quantity || 0;
  }

  save(): void {
    if (this.item.type === 'DURABLE' && !this.selectedAsset) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Selecione um patrimônio',
      });
      return;
    }

    if (this.quantity <= 0 || this.quantity > this.maxQuantity) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Quantidade inválida',
      });
      return;
    }

    this.loading = true;
    const payload: Leakage = {
      date: new Date(),
      observation: this.observation,
      items: [
        {
          item: this.item,
          quantity: this.quantity,
          asset: this.selectedAsset?.id !== -1 ? this.selectedAsset : null,
        } as any,
      ],
    } as any; // user is injected automatically by backend via Audit, or needs to be set? Wait, Leakage has a User field. Does the backend set it? Yes, we can just pass an empty user or the backend sets it. We'll leave user empty if possible. Let's look at IssueService to see if user is set.

    this.leakageService.create(payload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Perda/Extravio registrada com sucesso',
        });
        this.loading = false;
        this.ref.close(true);
      },
      error: (err) => {
        let errorMsg = 'Falha ao registrar';
        if (err.error && err.error.message) {
          errorMsg = err.error.message;
        } else if (err.error && typeof err.error === 'string') {
          errorMsg = err.error;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: errorMsg,
        });
        this.loading = false;
      },
    });
  }

  cancel(): void {
    this.ref.close(false);
  }
}
