import type { CoverageReportOptions } from 'monocart-coverage-reports';

/** Só o código do app (src/app), sem node_modules, bundles do Angular nem os próprios testes. */
const isAppSource = (path: string) => /(^|\/)src\/app\//.test(path) && !/\.spec\.ts$/.test(path);

export const RAW_DIR = 'e2e/.coverage/raw';
export const REPORT_DIR = 'e2e/.coverage/report';

export const coverageOptions = (name: string): CoverageReportOptions => ({
  name,
  outputDir: `${RAW_DIR}/${name}`,
  reports: ['raw'],
  // só scripts servidos pelo ng serve (ignora about:blank, extensões etc.)
  entryFilter: (entry) => /localhost:4300\/.*\.js$/.test(entry.url),
  sourceFilter: (sourcePath) => isAppSource(sourcePath),
});
