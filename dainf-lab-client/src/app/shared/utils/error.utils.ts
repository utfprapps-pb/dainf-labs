export const FORBIDDEN_MESSAGE = 'Você não tem permissão para realizar essa ação.';

export function extractErrorMessage(error: any, fallback = 'Operação falhou. Tente novamente.'): string {
  if (error?.status === 403) {
    return FORBIDDEN_MESSAGE;
  }
  if (error?.error?.errors) {
    return Object.values(error.error.errors).join(', ');
  }
  return error?.error?.message || fallback;
}
