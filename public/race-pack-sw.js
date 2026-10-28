/* Service worker that serves /race/* from CacheStorage.
 *
 * This is intentionally minimal: the app pre-populates the cache by unzipping
 * `public/packs/race.pack` at runtime (in the page context) and writing each file
 * under its normal URL (e.g. /race/beyblade/index.html).
 *
 * Goal: make race assets non-obvious in the deployed output while still allowing
 * the existing iframe-based race pages to request /race/... normally.
 */
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'race-pack-v1'

self.addEventListener('install', (event) => {
  // Activate ASAP so we can serve cached responses on first use.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function isRaceRequest(url) {
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, '')
  // Handle both direct /race/* and the fallback rewrites you already have in next.config.js
  // (these are commonly requested by the embedded race HTML).
  return (
    url.pathname.startsWith(`${scopePath}/race/`) ||
    url.pathname.startsWith('/race/') ||
    url.pathname.startsWith(`${scopePath}/js/`) ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith(`${scopePath}/css/`) ||
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith(`${scopePath}/sounds/`) ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.startsWith(`${scopePath}/ajax.googleapis.com/`)
    || url.pathname.startsWith('/ajax.googleapis.com/')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (!isRaceRequest(url)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, '')

    // GitHub Pages project sites run under /<repo>/ (e.g. /quiz). Some embedded race
    // HTML uses root-absolute URLs like "/race/js/..." which would otherwise 404 on Pages.
    // Map those root requests to the scoped cached entries ("/quiz/race/js/...").
    const cacheLookupReq = (() => {
      if (!scopePath || scopePath === '/') return req
      const p = url.pathname
      if (p.startsWith('/race/') || p.startsWith('/js/') || p.startsWith('/css/') || p.startsWith('/sounds/') || p.startsWith('/ajax.googleapis.com/')) {
        const mappedUrl = new URL(req.url)
        mappedUrl.pathname = `${scopePath}${p}`
        return new Request(mappedUrl.toString(), { method: 'GET' })
      }
      return req
    })()

    // Race iframes frequently request `index.html?...` (query params). We cache the file
    // without the query, so ignoreSearch must be true here.
    const cached = await cache.match(cacheLookupReq, { ignoreSearch: true })
    if (cached) return cached
    return fetch(req)
  })())
})

