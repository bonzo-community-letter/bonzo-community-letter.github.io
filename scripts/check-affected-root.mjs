#!/usr/bin/env node
/**
 * Fail the build when the root the site is configured with is not the root of the list.
 *
 *   node scripts/check-affected-root.mjs
 *
 * The site ships the affected list and a root. The root lives in a GitHub repository
 * variable (`VITE_AFFECTED_ROOT`) and is the only thing a reader has to trust — so the
 * one failure mode that must be impossible is shipping a list that does not hash to it.
 * That is what this checks: recompute the root from `src/content/affected.ts` and compare.
 *
 * Locally (no variable) it only reports; in CI a missing variable is an error, because a
 * deployment that cannot be verified is worse than no deployment.
 */
import { createHash } from 'node:crypto'
import { AFFECTED_LEAVES, AFFECTED_ROOT } from '../src/content/affected.ts'

const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function merkleRoot(leaves) {
  let layer = [...leaves].sort()
  while (layer.length > 1) {
    const next = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1]
      next.push(right === undefined ? left : sha256Text(left <= right ? left + right : right + left))
    }
    layer = next
  }
  return `0x${layer[0]}`
}

const computed = merkleRoot(AFFECTED_LEAVES)
const configured = (process.env.VITE_AFFECTED_ROOT ?? process.argv[2] ?? '').trim().toLowerCase()
const inCi = process.env.CI === 'true' || process.env.CI === '1'

if (configured === '') {
  const message = `VITE_AFFECTED_ROOT is not set; the generated constant is ${computed}`
  if (inCi) {
    console.error(`✗ ${message}\n  Set it as a repository variable so the deployed root is the published one.`)
    process.exit(1)
  }
  console.log(`• ${message}`)
  process.exit(0)
}

if (configured !== computed) {
  console.error('✗ the configured root is not the root of the shipped leaves')
  console.error(`  VITE_AFFECTED_ROOT: ${configured}`)
  console.error(`  leaves hash to:     ${computed}`)
  console.error(`  (generated constant: ${AFFECTED_ROOT})`)
  console.error('  Either the variable is stale or the leaves were edited without regenerating.')
  process.exit(1)
}

console.log(`✓ ${AFFECTED_LEAVES.length} leaves hash to ${computed}`)
