#!/usr/bin/env tsx
/**
 * Runs automated checks for the sales contact discovery pipeline.
 * Used for phase-7 validation before release.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const testFiles = [
  'lib/sales/validation/contactDiscoveryWorkflow.test.ts',
  'lib/sales/agents/contactDiscoveryPersistence.test.ts',
  'lib/sales/providers/contactCrawlPlanner.test.ts',
  'lib/sales/providers/contactPageDiscovery.test.ts',
  'lib/sales/providers/contactHtmlExtraction.test.ts',
  'lib/sales/providers/contactExtraction.test.ts',
  'lib/sales/providers/contactOutreachRanking.test.ts',
]

function run(label: string, command: string, args: string[], cwd = root): boolean {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`${label} failed (exit ${result.status ?? 1})`)
    return false
  }
  return true
}

let ok = true

ok =
  run('Contact discovery unit & workflow tests', 'npx', ['tsx', '--test', ...testFiles]) && ok

ok =
  run('TypeScript (contact discovery scope)', 'npx', [
    'tsc',
    '--noEmit',
    '-p',
    'tsconfig.contact-discovery.json',
  ]) && ok

const lintTargets = [
  'lib/sales/agents/contactDiscoveryExecutor.ts',
  'lib/sales/agents/contactDiscoveryPersistence.ts',
  'lib/sales/providers/basicWebsiteContactProvider.ts',
  'lib/sales/providers/contactCrawlPlanner.ts',
  'lib/sales/providers/contactHtmlExtraction.ts',
  'lib/sales/providers/contactOutreachRanking.ts',
  'lib/sales/repositories/salesContactRepository.ts',
  'hooks/useContactDiscovery.ts',
  'hooks/useSelectedContacts.ts',
  'components/sales-engine/ContactReviewTable.tsx',
  'components/sales-engine/SalesEnginePage.tsx',
]

ok = run('ESLint (contact discovery surfaces)', 'npx', ['eslint', ...lintTargets]) && ok

console.log(ok ? '\nAll contact discovery validation checks passed.\n' : '\nValidation failed.\n')
process.exit(ok ? 0 : 1)
