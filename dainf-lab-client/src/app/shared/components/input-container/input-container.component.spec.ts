import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { dateOrderValidator } from '@/shared/validator/date-order.validator';
import { InputContainerComponent } from './input-container.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputContainerComponent],
  template: `
    <form [formGroup]="form">
      <app-input-container label="Fim">
        <input formControlName="end" />
      </app-input-container>
    </form>
  `,
})
class HostComponent {
  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group(
    {
      start: [new Date('2026-07-08')],
      end: [null as Date | null, Validators.required],
    },
    { validators: dateOrderValidator('start', 'end') },
  );
}

// Regression coverage for a real bug found while fixing the date-order validators:
// `required`/`errorMessages` used to be Angular computed() signals reading
// `control.errors`, a plain mutable property (not a signal). Once evaluated,
// the computed cache never re-ran when a later cross-field validator changed the
// error key (e.g. required -> dateBeforeStart), so the DOM kept showing the first
// message forever even though the control's real validity had moved on. Fixed by
// making them plain methods, which templates re-evaluate every change-detection
// cycle. These tests render the real component to catch any regression back to
// computed().
describe('InputContainerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function errorText(): string {
    return (fixture.nativeElement as HTMLElement).textContent || '';
  }

  it('shows nothing before the control is touched or dirty', () => {
    expect(errorText()).not.toContain('Campo obrigatório.');
  });

  it('shows the required message once the empty control is touched', () => {
    host.form.get('end')?.markAsTouched();
    fixture.detectChanges();
    expect(errorText()).toContain('Campo obrigatório.');
  });

  it('switches to the cross-field message after the error key changes, without a stale cache', () => {
    host.form.get('end')?.markAsTouched();
    fixture.detectChanges();
    expect(errorText()).toContain('Campo obrigatório.');

    // end becomes non-null but before start -> required clears, dateBeforeStart sets
    host.form.patchValue({ end: new Date('2026-07-01') });
    fixture.detectChanges();

    expect(errorText()).toContain('A data não pode ser anterior à data inicial.');
    expect(errorText()).not.toContain('Campo obrigatório.');
  });

  it('clears the message once the control becomes fully valid', () => {
    host.form.get('end')?.markAsTouched();
    host.form.patchValue({ end: new Date('2026-07-09') });
    fixture.detectChanges();

    expect(errorText()).not.toContain('Campo obrigatório.');
    expect(errorText()).not.toContain('anterior à data inicial');
  });
});
