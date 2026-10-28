export function getBasePath () {
	// Baked in at build time via next.config.js (GITHUB_PAGES=1).
	// In dev/normal builds this will be ''.
	return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export function withBasePath (path) {
	const base = getBasePath()
	if (!path) return path
	if (path.startsWith('http://') || path.startsWith('https://')) return path
	if (!base) return path
	// Ensure exactly one slash between base and path.
	return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
