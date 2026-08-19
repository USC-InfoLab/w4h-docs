#!/usr/bin/env node
/**
 * Generate DOCS_INDEX.md — structural map of markdown in w4h-docs.
 * Run: node scripts/generate-docs-index.mjs
 * Not hooked into any build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'DOCS_INDEX.md')

const SKIP_DIRS = new Set(['.git', 'node_modules', 'media', 'scripts'])
const SKIP_FILES = new Set(['LICENSE', 'CONTRIBUTING.md', 'CLAUDE.md'])

function walkMd(dir, base = ROOT) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkMd(full, base))
    } else if (entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

function readTitle(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fm) {
    const title = fm[1].match(/^title:\s*(.+)$/m)
    if (title) {
      return title[1].replace(/^["']|["']$/g, '').trim()
    }
  }
  const h1 = src.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()
  return path.posix.basename(rel, '.md')
}

function groupByTop(relPaths) {
  /** @type {Map<string, string[]>} */
  const groups = new Map()
  for (const rel of relPaths) {
    const parts = rel.split('/')
    const key = parts.length === 1 ? '(root)' : parts[0]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(rel)
  }
  // Prefer a stable section order
  const order = ['(root)', 'dev', 'guide', 'faq', 'releases']
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return keys.map((k) => [k, groups.get(k)])
}

function main() {
  const files = walkMd(ROOT).filter((f) => f !== 'AGENTS.md' && f !== 'DOCS_INDEX.md')
  const generatedAt = new Date().toISOString().slice(0, 10)
  const adrs = files.filter((f) => /\/ADR-?\d+/i.test(f) || /ADR-README/i.test(f))
  const sections = []

  for (const [key, rels] of groupByTop(files)) {
    const heading = key === '(root)' ? 'Root' : `\`${key}/\``
    sections.push(`## ${heading}`)
    sections.push('')
    sections.push('| File | Title |')
    sections.push('|------|-------|')
    for (const rel of rels) {
      const title = readTitle(rel).replace(/\|/g, '\\|')
      sections.push(`| \`${rel}\` | ${title} |`)
    }
    sections.push('')
  }

  const md = `# Docs Index

Structural map of \`w4h-docs\` for agents and humans. **Index only** — not a substitute for reading ADRs/MVP.

- Regenerate: \`node scripts/generate-docs-index.mjs\`
- Generated: ${generatedAt}
- Do not hand-edit the lists below; change docs, then re-run the script.

## Orientation

| Need | Start here |
|------|------------|
| Requirements / impl status | \`dev/mvp.md\` |
| Architecture | \`dev/architecture.md\` |
| ADR index | \`dev/ADR-README.md\` |
| Roles / ACL | \`dev/ADR-004-acl-roles.md\` |
| Quick start (users) | \`quick-start.md\` |
| Docs screenshots / fake users | \`dev/docs-fixtures.md\` |
| Guides | \`guide/\` |

ADRs in tree: **${adrs.length}**. Prefer MVP + relevant ADR before inventing product rules.

${sections.join('\n').trimEnd()}
`

  fs.writeFileSync(OUT, md.trimEnd() + '\n', 'utf8')
  const lineCount = md.trimEnd().split('\n').length
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${lineCount} lines, ${files.length} markdown files, ${adrs.length} ADRs)`)
  if (lineCount > 180) {
    console.warn(`Warning: DOCS_INDEX.md is ${lineCount} lines (prefer ~50–150).`)
  }
}

main()
