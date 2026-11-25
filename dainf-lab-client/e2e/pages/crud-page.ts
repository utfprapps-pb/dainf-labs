import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object do componente genérico `app-crud` (toolbar + tabela + dialog + filtros).
 * Todas as telas de cadastro usam esse componente, então os mesmos métodos servem para todas.
 */
export class CrudPage {
  constructor(
    readonly page: Page,
    readonly route: string,
  ) {}

  /** Espelha o `title` da config da tela (usado no header do dialog e no nome do CSV). */
  async goto(query = '') {
    await this.page.goto(`/${this.route}${query}`);
    await this.waitForTable();
  }

  async waitForTable() {
    await expect(this.page.locator('p-table')).toBeVisible();
  }

  // ---- toolbar
  get newButton() {
    return this.page.getByRole('button', { name: 'Novo' });
  }
  get filterButton() {
    return this.page.getByRole('button', { name: 'Filtrar' });
  }
  get exportButton() {
    return this.page.getByRole('button', { name: 'Exportar' });
  }

  // ---- tabela
  get rows(): Locator {
    return this.page.locator('p-table tbody tr').filter({ hasNot: this.page.locator('td[colspan]') });
  }
  row(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }
  get emptyMessage() {
    return this.page.getByText('Nenhum registro encontrado.');
  }
  get paginator() {
    return this.page.locator('p-paginator');
  }

  async expectRows(texts: (string | RegExp)[]) {
    await expect(this.rows).toHaveCount(texts.length);
    for (const t of texts) await expect(this.row(t)).toHaveCount(1);
  }

  editButton(text: string | RegExp) {
    return this.row(text).locator('button:has(.pi-pencil)');
  }
  deleteButton(text: string | RegExp) {
    return this.row(text).locator('button:has(.pi-trash)');
  }

  // ---- dialog de edição
  get dialog() {
    return this.page.locator('.p-dialog').filter({ has: this.page.getByRole('button', { name: 'Cancelar' }) });
  }
  get saveButton() {
    return this.dialog.getByRole('button', { name: 'Salvar' });
  }
  get cancelButton() {
    return this.dialog.getByRole('button', { name: 'Cancelar' });
  }

  async openNew() {
    await this.newButton.click();
    await expect(this.dialog).toBeVisible();
  }
  async openEdit(text: string | RegExp) {
    await this.editButton(text).click();
    await expect(this.dialog).toBeVisible();
  }
  async save() {
    await this.saveButton.click();
  }

  // ---- exclusão
  get confirm() {
    return this.page.locator('.p-confirmdialog');
  }
  async confirmYes() {
    await this.confirm.getByRole('button', { name: 'Sim' }).click();
  }
  async confirmNo() {
    await this.confirm.getByRole('button', { name: 'Não' }).click();
  }

  // ---- filtros
  get drawer() {
    return this.page.locator('.p-drawer');
  }
  async openFilters() {
    await this.filterButton.click();
    await expect(this.drawer).toBeVisible();
  }

  /** Campo (input/textarea) dentro de um `app-input-container` com o rótulo dado — no drawer ou no dialog. */
  field(scope: 'drawer' | 'dialog', label: string): Locator {
    const root = scope === 'drawer' ? this.drawer : this.dialog;
    return root.locator('app-input-container').filter({ hasText: label }).locator('input, textarea').first();
  }
  filterField(label: string) {
    return this.field('drawer', label);
  }
  formField(label: string) {
    return this.field('dialog', label);
  }

  /** Fecha o drawer de filtros (botão X) — necessário antes de clicar na tabela, pois ele é modal. */
  async closeFilters() {
    await this.drawer.locator('.p-drawer-close-button, button[data-pc-section="closebutton"]').first().click();
    await expect(this.drawer).toBeHidden();
  }

  // ---- paginação
  get pageReport() {
    return this.paginator.locator('.p-paginator-current');
  }
  async nextPage() {
    await this.paginator.locator('.p-paginator-next').click();
  }
}
