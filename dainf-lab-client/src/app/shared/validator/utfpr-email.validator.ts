import { AbstractControl, ValidationErrors } from '@angular/forms';

const UTFPR_EMAIL_PATTERN =
  /^[^\s@]+@(utfpr\.edu\.br|alunos\.utfpr\.edu\.br|professores\.utfpr\.edu\.br)$/i;

export function utfprEmailValidator(): (
  control: AbstractControl,
) => ValidationErrors | null {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    return UTFPR_EMAIL_PATTERN.test(value) ? null : { utfprEmail: true };
  };
}
