import THEMES from './themes.json'

export const THEME_IDS = Object.keys(THEMES)
export const DEFAULT_THEME = 'classic'
export const STORAGE_KEY = 'sceneit-theme'
export { THEMES }

export function isTheme (id) {
	return typeof id === 'string' && Object.prototype.hasOwnProperty.call(THEMES, id)
}

function rgb (hex) {
	const h = hex.replace('#', '')
	return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`
}

// One CSS block per theme: [data-theme="x"] { --th-panel: 26 31 56; ... }
export function themeCss () {
	return THEME_IDS.map((id) => {
		const vars = Object.entries(THEMES[id].vars).map(([k, v]) => `--th-${k}:${rgb(v)};`).join('')
		return `${id === DEFAULT_THEME ? ':root,' : ''}[data-theme="${id}"]{${vars}}`
	}).join('\n')
}
