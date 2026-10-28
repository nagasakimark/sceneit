/* eslint-disable no-console */
/**
 * Packs `public/race/` into a single zip file at `public/packs/race.pack`.
 *
 * Why:
 * - GitHub Pages/static hosting will otherwise expose `/race/...` as a browsable directory.
 * - This creates one opaque-ish file that we only unpack/cache at runtime when needed.
 *
 * Notes:
 * - This does NOT delete `public/race/`. For an obscured deploy, run the companion build
 *   script that temporarily moves it out of `public/` before building/exporting.
 */

const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const JSZip = require('jszip')

const ROOT = path.resolve(__dirname, '..')
const RACE_DIR = path.join(ROOT, 'public', 'race')
const OUT_DIR = path.join(ROOT, 'public', 'packs')
const OUT_FILE = path.join(OUT_DIR, 'race.pack')

async function exists(p) {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function walk(dir) {
  const out = []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...await walk(full))
    } else if (ent.isFile()) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  if (!await exists(RACE_DIR)) {
    console.error(`Missing folder: ${RACE_DIR}`)
    process.exitCode = 1
    return
  }

  await fsp.mkdir(OUT_DIR, { recursive: true })

  const zip = new JSZip()
  const files = await walk(RACE_DIR)

  // Keep paths rooted at /race/ so runtime cache keys match iframe URLs.
  const base = path.join(ROOT, 'public') + path.sep

  for (const file of files) {
    const rel = file.startsWith(base) ? file.slice(base.length) : path.relative(ROOT, file)
    const zipPath = rel.split(path.sep).join('/') // zip uses forward slashes
    const data = await fsp.readFile(file)
    zip.file(zipPath, data, { binary: true })
  }

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  await fsp.writeFile(OUT_FILE, buf)

  const mb = (buf.length / (1024 * 1024)).toFixed(2)
  console.log(`Wrote ${OUT_FILE} (${mb} MB) with ${files.length} files`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

