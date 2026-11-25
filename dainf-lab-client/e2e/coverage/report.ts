/**
 * Junta os relatórios "raw" de cada worker e gera o relatório final:
 *   E2E_COVERAGE=1 npx playwright test && npx tsx e2e/coverage/report.ts   (ou npm run e2e:coverage)
 * Saída: e2e/.coverage/report/index.html + resumo no terminal.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import MCR from 'monocart-coverage-reports';
import { RAW_DIR, REPORT_DIR } from './options';

async function main() {
  if (!existsSync(RAW_DIR)) throw new Error(`Nada em ${RAW_DIR}. Rode os testes com E2E_COVERAGE=1.`);
  const inputDir = readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(RAW_DIR, d.name, 'raw'));

  const mcr = MCR({
    name: 'Cobertura E2E (src/app)',
    inputDir,
    outputDir: REPORT_DIR,
    reports: ['v8', 'console-summary', 'json-summary', ['json', { file: 'coverage.json' }]],
    sourceFilter: (p: string) => /(^|\/)src\/app\//.test(p) && !/\.spec\.ts$/.test(p),
  });
  await mcr.generate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
