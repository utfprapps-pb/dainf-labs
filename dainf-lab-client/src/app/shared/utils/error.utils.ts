export function extractErrorMessage(error: any, fallback = 'Operação falhou. Tente novamente.'): string {
  if (error?.error?.errors) {
    return Object.values(error.error.errors).join(', ');
  }
  return error?.error?.message || fallback;
}
