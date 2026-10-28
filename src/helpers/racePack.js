import JSZip from 'jszip'
import { getBasePath } from './basePath'

const CACHE_NAME = 'race-pack-v1'

function normalizeZipPath (p) {
	// zip paths are forward-slash; remove any leading "./"
	return (p || '').replace(/^\.\//, '')
}

function guessMimeType (path) {
	const ext = (path.split('.').pop() || '').toLowerCase()

	// HTML / JS / CSS
	if (ext === 'html' || ext === 'htm') return 'text/html; charset=utf-8'
	if (ext === 'js') return 'text/javascript; charset=utf-8'
	if (ext === 'css') return 'text/css; charset=utf-8'
	if (ext === 'json') return 'application/json; charset=utf-8'
	if (ext === 'txt') return 'text/plain; charset=utf-8'

	// Images
	if (ext === 'png') return 'image/png'
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
	if (ext === 'gif') return 'image/gif'
	if (ext === 'webp') return 'image/webp'
	if (ext === 'svg') return 'image/svg+xml'
	if (ext === 'ico') return 'image/x-icon'

	// Audio / Video
	if (ext === 'mp3') return 'audio/mpeg'
	if (ext === 'wav') return 'audio/wav'
	if (ext === 'ogg' || ext === 'oga') return 'audio/ogg'
	if (ext === 'mp4' || ext === 'm4v') return 'video/mp4'
	if (ext === 'webm') return 'video/webm'

	// Fonts
	if (ext === 'woff') return 'font/woff'
	if (ext === 'woff2') return 'font/woff2'
	if (ext === 'ttf') return 'font/ttf'
	if (ext === 'otf') return 'font/otf'

	return ''
}

function shouldCachePath (zipPath, opts) {
	const p = normalizeZipPath(zipPath)
	// pack includes paths like "race/..." (no leading slash)
	if (!p) return false

	// Always ignore obvious junk
	if (p.endsWith('.log')) return false

	const mode = opts?.mode || 'full'
	if (mode === 'thumbnails') {
		// Only cache race thumbnails used by the picker grid
		return /^race\/[^/]+\/thumbnail\.webp$/i.test(p)
	}

	if (mode === 'race') {
		const dir = opts?.raceDir
		if (!dir) return false
		// Selected race + shared dependencies used by race HTML
		if (p.startsWith(`race/${dir}/`)) return true
		if (p.startsWith('race/js/')) return true
		if (p.startsWith('race/css/')) return true
		if (p.startsWith('race/sounds/')) return true
		if (p.startsWith('race/ajax.googleapis.com/')) return true
		// Some races rely on the top-level index.html (rare, but cheap)
		if (p === 'race/index.html') return true
		return false
	}

	// Default: full pack
	return true
}

async function registerRaceServiceWorker () {
	if (typeof window === 'undefined') return null
	if (!('serviceWorker' in navigator)) return null

	const basePath = getBasePath()
	const scope = basePath ? `${basePath}/` : '/'

	// Register once; if it fails (e.g. unsupported on some contexts), we just fall back
	// to normal network requests (which will work in dev where /public/race exists).
	try {
		const reg = await navigator.serviceWorker.register(`${basePath}/race-pack-sw.js`, { scope })
		// Wait until a SW is controlling the page (helps first-use reliability).
		await navigator.serviceWorker.ready
		if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
		return reg
	} catch (e) {
		console.warn('[racePack] service worker registration failed', e)
		return null
	}
}

export async function registerRacePackServiceWorkerOnly () {
	return registerRaceServiceWorker()
}

async function cacheHasKey (keyUrl) {
	if (typeof window === 'undefined' || !('caches' in window)) return false
	try {
		const cache = await caches.open(CACHE_NAME)
		const res = await cache.match(keyUrl)
		return !!res
	} catch {
		return false
	}
}

let inflightPromise = null
let inflightKey = null

export async function ensureRacePackCached (opts = {}) {
	if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }

	const basePath = getBasePath()
	const mode = opts.mode || 'full'
	const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
	const readinessKey =
		mode === 'thumbnails'
			? `${basePath}/race/beyblade/thumbnail.webp`
			: mode === 'race'
				? `${basePath}/race/${opts.raceDir || 'beyblade'}/index.html`
				: `${basePath}/race/index.html`

	// Coalesce only identical work. If a different mode/race is requested while another
	// job is running (e.g. thumbnails while user clicks a race), wait for the current
	// job then run the requested one so we don't "return early" without caching the race.
	if (inflightPromise) {
		if (inflightKey === readinessKey) return inflightPromise
		try {
			await inflightPromise
		} catch {
			// If the previous job failed, continue and attempt the requested job anyway.
		}
	}

	inflightPromise = (async () => {
		await registerRaceServiceWorker()
		const packUrl = `${basePath}/packs/race.pack`

		// Cache keys we can quickly probe to know "enough is ready"
		inflightKey = readinessKey

		if (!opts.force) {
			const already = await cacheHasKey(readinessKey)
			if (already) return { ok: true, fromCache: true }
		}

		// Fetch the packed zip file.
		const packRes = await fetch(packUrl, { cache: 'force-cache' })
		if (!packRes.ok) {
			// Dev/back-compat: if you still have `public/race/` present, races can load without the pack.
			try {
				const raceRes = await fetch(`${basePath}/race/index.html`, { method: 'GET', cache: 'no-store' })
				if (raceRes.ok) return { ok: true, fromCache: false, mode: 'public-race-folder' }
			} catch {}
			console.warn('[racePack] pack fetch failed', packRes.status)
			return { ok: false, reason: `pack-fetch-${packRes.status}` }
		}

		const packBuf = await packRes.arrayBuffer()
		const zip = await JSZip.loadAsync(packBuf)

		const cache = await caches.open(CACHE_NAME)

		const entries = []
		zip.forEach((relativePath, file) => {
			if (file.dir) return
			const p = normalizeZipPath(relativePath)
			if (!shouldCachePath(p, { mode, raceDir: opts.raceDir })) return
			entries.push({ relativePath: p, file })
		})

		if (onProgress) {
			onProgress({
				phase: 'start',
				mode,
				cached: 0,
				total: entries.length
			})
		}

		// Write all files to CacheStorage under their final URL.
		// Important: keep them addressable at /race/... so existing iframe HTML works unchanged.
		// Avoid massive concurrency (can stall some browsers).
		// Cache in small batches to keep memory and CacheStorage pressure manageable.
		const BATCH_SIZE = 25
		for (let i = 0; i < entries.length; i += BATCH_SIZE) {
			const batch = entries.slice(i, i + BATCH_SIZE)
			// eslint-disable-next-line no-await-in-loop
			await Promise.all(batch.map(async ({ relativePath, file }) => {
				const data = await file.async('uint8array')
				const mimeType = guessMimeType(relativePath)
				const blob = new Blob([data], mimeType ? { type: mimeType } : undefined)

				const urlPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
				const url = `${basePath}${urlPath}`
				const headers = new Headers()
				if (mimeType) headers.set('Content-Type', mimeType)

				// A Response over a Blob is streamable and SW-cache friendly.
				const resp = new Response(blob, { status: 200, headers })
				await cache.put(url, resp)
			}))
			// Yield to keep the UI responsive during large packs.
			// eslint-disable-next-line no-await-in-loop
			await new Promise(resolve => setTimeout(resolve, 0))

			if (onProgress) {
				const done = Math.min(i + batch.length, entries.length)
				onProgress({
					phase: 'caching',
					mode,
					cached: done,
					total: entries.length
				})
			}
		}

		if (onProgress) {
			onProgress({
				phase: 'done',
				mode,
				cached: entries.length,
				total: entries.length
			})
		}

		return { ok: true, fromCache: false, files: entries.length }
	})()

	try {
		return await inflightPromise
	} finally {
		inflightPromise = null
		inflightKey = null
	}
}
