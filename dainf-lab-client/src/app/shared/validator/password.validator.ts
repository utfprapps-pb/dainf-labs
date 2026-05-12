import { AbstractControl, ValidationErrors } from '@angular/forms';

export function passwordStrengthValidator(): (control: AbstractControl) => ValidationErrors | null {
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    return pattern.test(value) ? null : { passwordStrength: true };
  };
}
