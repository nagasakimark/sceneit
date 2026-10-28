/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === '1'

const nextConfig = {
	reactStrictMode: false,
	// GitHub Pages (project site) runs under /<repoName>/, not at domain root.
	// Use `GITHUB_PAGES=1` for export builds so routing/assets work.
	basePath: isGithubPages ? (process.env.BASE_PATH || '/sceneit') : '',
	assetPrefix: isGithubPages ? (process.env.BASE_PATH || '/sceneit') + '/' : '',
	trailingSlash: true,
	images: { unoptimized: true },
	env: {
		NEXT_PUBLIC_BASE_PATH: isGithubPages ? (process.env.BASE_PATH || '/sceneit') : '',
	},
	// Fallback rewrites: if any race resource still resolves to /js/ or /css/
	// instead of /race/js/ (e.g. from dynamic CreateJS manifest loads), redirect it.
	async rewrites() {
		return {
			fallback: [
				{ source: '/js/:path*', destination: '/race/js/:path*' },
				{ source: '/css/:path*', destination: '/race/css/:path*' },
				{ source: '/sounds/:path*', destination: '/race/sounds/:path*' },
				{ source: '/ajax.googleapis.com/:path*', destination: '/race/ajax.googleapis.com/:path*' },
			],
		}
	},
}

module.exports = nextConfig
