import { expect, type Locator, type Page } from '@playwright/test';

/** Toast do PrimeNG contendo o texto. */
export const toast = (page: Page, text: string | RegExp): Locator =>
  page.locator('p-toast .p-toast-message').filter({ hasText: text });

/** p-select: abre e escolhe a opção pelo rótulo. */
export async function selectOption(page: Page, select: Locator, label: string | RegExp) {
  await select.click();
  await page.getByRole('option', { name: label }).first().click();
}

/** p-multiselect: abre, marca as opções e fecha. */
export async function multiSelect(page: Page, select: Locator, labels: (string | RegExp)[]) {
  await select.click();
  for (const label of labels) {
    await page.getByRole('option', { name: label }).first().click();
  }
  // clique fora fecha o overlay (Escape fecharia o dialog inteiro)
  await page.mouse.click(4, 4);
  await expect(page.locator('.p-multiselect-overlay')).toHaveCount(0);
}

/** Garante que o overlay do select/multiselect fechou. */
export async function expectNoOverlay(page: Page) {
  await expect(page.locator('.p-select-overlay, .p-multiselect-overlay')).toHaveCount(0);
}

/** p-datepicker: digita a data no formato dd/MM/yyyy (o componente usa dateFormat="dd/mm/yy"). */
export async function fillDate(datepicker: Locator, ddmmyyyy: string) {
  const input = datepicker.locator('input').first();
  await input.click();
  await input.pressSequentially(ddmmyyyy); // fill() não dispara o parse do PrimeNG
  await input.press('Tab'); // Enter/Escape fechariam o dialog
  await expect(input).toHaveValue(ddmmyyyy);
}

/** app-search-select (p-autocomplete com dropdown): abre as opções e escolhe pelo texto. */
export async function pickFromSearchSelect(page: Page, searchSelect: Locator, text: string | RegExp) {
  await searchSelect.locator('.p-autocomplete-dropdown').click();
  await page.locator('.p-autocomplete-overlay').getByRole('option', { name: text }).first().click();
}

/** Formata uma data como dd/MM/yyyy (fuso local). */
export function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * p-inputmask: digita só os dígitos e confere o resultado. A máscara reposiciona o cursor logo após o foco
 * (de forma assíncrona), o que pode embaralhar os dígitos; por isso limpa e repete até o valor sair certo.
 */
export async function typeMasked(input: Locator, digits: string) {
  await expect(async () => {
    await input.click();
    await input.press('Control+A');
    await input.press('Backspace');
    await input.pressSequentially(digits);
    await expect.poll(async () => (await input.inputValue()).replace(/\D/g, ''), { timeout: 1000 }).toBe(digits);
  }).toPass({ timeout: 10000 });
  await input.press('Tab');
}
