import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function dateOrderValidator(
  startControlName: string,
  endControlName: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const startControl = group.get(startControlName);
    const endControl = group.get(endControlName);
    if (!startControl || !endControl) return null;

    const start = startControl.value ? new Date(startControl.value) : null;
    const end = endControl.value ? new Date(endControl.value) : null;

    if (start && end && end < start) {
      endControl.setErrors({ ...endControl.errors, dateBeforeStart: true });
    } else if (endControl.errors?.['dateBeforeStart']) {
      const { dateBeforeStart, ...rest } = endControl.errors;
      endControl.setErrors(Object.keys(rest).length ? rest : null);
    }

    return null;
  };
}
