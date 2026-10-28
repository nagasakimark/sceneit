/* eslint-disable no-console */
/**
 * Creates an "obscured" build by:
 * - Packing `public/race/` into `public/packs/race.pack`
 * - Temporarily moving `public/race/` out of `public/` (so it won't be deployed)
 * - Running `next build` (and optionally `next export` if you pass EXPORT=1)
 * - Restoring `public/race/` afterwards
 *
 * Usage:
 * - `node scripts/build-obscured-race.js`
 * - `EXPORT=1 node scripts/build-obscured-race.js` (will run `npx next export`)
 */

const path = require('path')
const fsp = require('fs/promises')
const { spawn } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const RACE_DIR = path.join(ROOT, 'public', 'race')
// Important: this must NOT be inside `public/`, because `next export`
// copies `public/` into `out/` and would leak the stashed folder.
const STASH_DIR = path.join(ROOT, '__race_src__')

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT, ...opts })
    p.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}

async function exists(p) {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!await exists(RACE_DIR)) {
    console.error(`Missing folder: ${RACE_DIR}`)
    process.exitCode = 1
    return
  }
  if (await exists(STASH_DIR)) {
    console.error(`Refusing to run: stash folder already exists: ${STASH_DIR}`)
    process.exitCode = 1
    return
  }

  console.log('Packing race folder…')
  await run('node', ['scripts/pack-race.js'])

  console.log('Stashing public/race…')
  await fsp.rename(RACE_DIR, STASH_DIR)

  try {
    console.log('Building Next.js…')
    await run('npx', ['next', 'build'])

    if (process.env.EXPORT === '1') {
      console.log('Exporting static site…')
      await run('npx', ['next', 'export'])
    }
  } finally {
    console.log('Restoring public/race…')
    if (await exists(STASH_DIR) && !await exists(RACE_DIR)) {
      await fsp.rename(STASH_DIR, RACE_DIR)
    }
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

