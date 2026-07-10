import { FormBuilder, Validators } from '@angular/forms';
import { dateOrderValidator } from './date-order.validator';

describe('dateOrderValidator', () => {
  const fb = new FormBuilder();

  function buildGroup(startValue: Date | null, endValue: Date | null) {
    return fb.group(
      {
        start: [startValue],
        end: [endValue, Validators.required],
      },
      { validators: dateOrderValidator('start', 'end') },
    );
  }

  it('sets dateBeforeStart on the end control when end is before start', () => {
    const group = buildGroup(new Date('2026-07-08'), new Date('2026-07-01'));
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeTrue();
    expect(group.invalid).toBeTrue();
  });

  it('does not set dateBeforeStart when end equals start', () => {
    const same = new Date('2026-07-08');
    const group = buildGroup(same, new Date(same));
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeUndefined();
  });

  it('does not set dateBeforeStart when end is after start', () => {
    const group = buildGroup(new Date('2026-07-01'), new Date('2026-07-08'));
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeUndefined();
    expect(group.valid).toBeTrue();
  });

  it('does not set an error when start is missing', () => {
    const group = buildGroup(null, new Date('2026-07-01'));
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeUndefined();
  });

  it('leaves the end control\'s own required error untouched when end is missing', () => {
    const group = buildGroup(new Date('2026-07-08'), null);
    expect(group.get('end')?.errors?.['required']).toBeTrue();
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeUndefined();
  });

  it('clears dateBeforeStart once the end date is corrected to be after start', () => {
    const group = buildGroup(new Date('2026-07-08'), new Date('2026-07-01'));
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeTrue();

    group.get('end')?.setValue(new Date('2026-07-09'));

    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeUndefined();
    expect(group.valid).toBeTrue();
  });

  it('preserves other error keys already present on the end control', () => {
    const group = buildGroup(new Date('2026-07-08'), new Date('2026-07-01'));
    group.get('end')?.setErrors({ ...group.get('end')?.errors, custom: true });
    group.get('start')?.updateValueAndValidity();

    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeTrue();
    expect(group.get('end')?.errors?.['custom']).toBeTrue();
  });

  it('accepts string date values (as patched from a loaded entity before conversion)', () => {
    const group = fb.group(
      {
        start: ['2026-07-08'],
        end: ['2026-07-01', Validators.required],
      },
      { validators: dateOrderValidator('start', 'end') },
    );
    expect(group.get('end')?.errors?.['dateBeforeStart']).toBeTrue();
  });
});
