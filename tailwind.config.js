/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				gray: {
					750: '#2d3748',
				},
				th: {
					'panel': 'rgb(var(--th-panel) / <alpha-value>)',
					'panel2': 'rgb(var(--th-panel2) / <alpha-value>)',
					'paneld': 'rgb(var(--th-paneld) / <alpha-value>)',
					'surface': 'rgb(var(--th-surface) / <alpha-value>)',
					'primary': 'rgb(var(--th-primary) / <alpha-value>)',
					'primaryd': 'rgb(var(--th-primaryd) / <alpha-value>)',
					'primaryl': 'rgb(var(--th-primaryl) / <alpha-value>)',
					'accent': 'rgb(var(--th-accent) / <alpha-value>)',
					'accentd': 'rgb(var(--th-accentd) / <alpha-value>)',
					'accentl': 'rgb(var(--th-accentl) / <alpha-value>)',
					'ok': 'rgb(var(--th-ok) / <alpha-value>)',
					'okd': 'rgb(var(--th-okd) / <alpha-value>)',
					'okl': 'rgb(var(--th-okl) / <alpha-value>)',
					'bad': 'rgb(var(--th-bad) / <alpha-value>)',
					'badd': 'rgb(var(--th-badd) / <alpha-value>)',
					'badl': 'rgb(var(--th-badl) / <alpha-value>)',
					'info': 'rgb(var(--th-info) / <alpha-value>)',
					'infod': 'rgb(var(--th-infod) / <alpha-value>)',
					'infol': 'rgb(var(--th-infol) / <alpha-value>)',
					'soft': 'rgb(var(--th-soft) / <alpha-value>)',
					'soft2': 'rgb(var(--th-soft2) / <alpha-value>)',
					'ink': 'rgb(var(--th-ink) / <alpha-value>)',
					'onprimary': 'rgb(var(--th-onprimary) / <alpha-value>)',
					'onaccent': 'rgb(var(--th-onaccent) / <alpha-value>)',
					'onok': 'rgb(var(--th-onok) / <alpha-value>)',
					'onbad': 'rgb(var(--th-onbad) / <alpha-value>)',
					'oninfo': 'rgb(var(--th-oninfo) / <alpha-value>)',
					'bg': 'rgb(var(--th-bg) / <alpha-value>)',
					'bg2': 'rgb(var(--th-bg2) / <alpha-value>)'
				}
			}
		}
	},
	plugins: []
}
