import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import type { Plugin } from 'vite'

/**
 * Computes the letter hash at build time, not in the browser.
 *
 * The hash is what a signature commits to, so it must not be able to differ
 * between what the page shows and what a signer's wallet submits. Deriving it
 * once, at compile time, from the same file that ships in the bundle removes
 * that whole class of mismatch: there is no runtime hashing path at all.
 *
 * `src/content/letter.ts` is TypeScript, so it is bundled with esbuild (already
 * a Vite dependency) and imported from a data URL — no extra loader, no eval of
 * untrusted code, no Node version requirement.
 */
export const VIRTUAL_LETTER_ID = 'virtual:letter'
const RESOLVED_ID = '\0' + VIRTUAL_LETTER_ID

export interface LetterModule {
  /** campaign subject, e.g. "bonzo-exploit-open-letter" */
  subject: string
  letterText: string
  /** SHA-256 of letterText, lowercase hex — the value signatures commit to */
  letterHash: string
  /** UTF-8 byte length of the text */
  letterBytes: number
  isDraft: boolean
}

interface RawLetterModule {
  SUBJECT?: unknown
  letterText?: unknown
  letterIsDraft?: unknown
}

export async function loadLetter(root: string): Promise<LetterModule> {
  const entry = path.resolve(root, 'src/content/letter.ts')
  const source = await readFile(entry, 'utf8')
  if (source.length === 0) throw new Error(`${entry} is empty`)

  const result = await build({
    stdin: { contents: source, loader: 'ts', resolveDir: path.dirname(entry) },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  })

  const code = result.outputFiles?.[0]?.text
  if (!code) throw new Error('esbuild produced no output for the letter module')

  const url = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`
  const mod = (await import(url)) as RawLetterModule

  const letterText = typeof mod.letterText === 'string' ? mod.letterText : ''
  const subject = typeof mod.SUBJECT === 'string' ? mod.SUBJECT : ''

  return {
    subject,
    letterText,
    letterHash: createHash('sha256').update(letterText, 'utf8').digest('hex'),
    letterBytes: Buffer.byteLength(letterText, 'utf8'),
    isDraft: mod.letterIsDraft !== false,
  }
}

function render(letter: LetterModule): string {
  return [
    `export const subject = ${JSON.stringify(letter.subject)};`,
    `export const letterText = ${JSON.stringify(letter.letterText)};`,
    `export const letterHash = ${JSON.stringify(letter.letterHash)};`,
    `export const letterBytes = ${letter.letterBytes};`,
    `export const isDraft = ${letter.isDraft};`,
    '',
  ].join('\n')
}

export function letterHashPlugin(): Plugin {
  let root = process.cwd()

  return {
    name: 'letter-hash',

    configResolved(config) {
      root = config.root
    },

    async buildStart() {
      const letter = await loadLetter(root)
      if (letter.letterBytes === 0) {
        this.warn(
          'src/content/letter.ts has no text yet — letterHash is the SHA-256 of the empty string, ' +
            'so every signature would bind to nothing. Signing must stay closed until the text exists.',
        )
      }
      this.info(`letter hash ${letter.letterHash} (${letter.letterBytes} bytes)`)
    },

    resolveId(id) {
      return id === VIRTUAL_LETTER_ID ? RESOLVED_ID : null
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null
      return render(await loadLetter(root))
    },

    configureServer(server) {
      const file = path.resolve(root, 'src/content/letter.ts')
      server.watcher.add(file)
      server.watcher.on('change', (changed) => {
        if (path.resolve(changed) !== file) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
