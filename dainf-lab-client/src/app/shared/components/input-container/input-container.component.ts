import { CommonModule } from '@angular/common';
import { Component, computed, contentChild, input } from '@angular/core';
import { NgControl } from '@angular/forms';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-input-container',
  template: `
    <div class="flex flex-col gap-1">
      <label class="block font-bold">
        {{ label() || '&#8203;' }}
        @if (required()) {
          <span class="text-red-500">*</span>
        }
      </label>

      <ng-content></ng-content>

      @if (control()?.invalid && (control()?.touched || control()?.dirty)) {
        <div class="text-sm text-red-500">
          @if (control()?.errors) {
            @for (error of errorMessages(); track $index) {
              <div>{{ error }}</div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class InputContainerComponent {
  label = input<string>();
  ngControl = contentChild(NgControl, { read: NgControl });

  control = computed(() => this.ngControl()?.control);

  // Plain methods, not computed(): control.errors is a mutable property on the
  // FormControl, not a signal, so a computed() here would cache its result after
  // the first read and never notice later setErrors() calls (e.g. from cross-field
  // validators). Template method calls are re-evaluated on every change detection
  // cycle instead, so they stay in sync.
  required(): boolean {
    const control = this.control();
    if (!control) return false;
    return control.errors?.['required'] === true;
  }

  errorMessages(): string[] {
    const control = this.control();
    if (!control || !control.errors) return [];
    return Object.entries(control.errors)
      .filter(([key]) => key in errorMap)
      .map(([key, error]) => errorMap[key](error));
  }
}

const errorMap: Record<string, (error: any) => string> = {
  required: () => 'Campo obrigatório.',
  email: () => 'E-mail inválido.',
  minlength: (e) => `Mínimo de ${e.requiredLength} caracteres.`,
  maxlength: (e) => `Máximo de ${e.requiredLength} caracteres.`,
  pattern: () => 'Formato inválido.',
  name: () => 'Por favor informe nome e sobrenome',
  invalidCnpj: () => 'CNPJ inválido.',
  invalidPhone: () => 'Telefone inválido.',
  passwordStrength: () => 'A senha deve conter ao menos uma letra maiúscula, uma minúscula e um número.',
  passwordMismatch: () => 'As senhas não coincidem.',
  dateBeforeStart: () => 'A data não pode ser anterior à data inicial.',
  min: (e) => `Valor mínimo: ${e.min}.`,
  max: (e) => `Valor máximo: ${e.max}.`,
};
