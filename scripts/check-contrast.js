/* eslint-disable no-console */
// Fails (exit 1) if any theme has unreadable text/background pairs.
// Run: npm run check:themes
const themes = require('../src/themes/themes.json')

function lum (hex) {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio (a, b) {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
	return (x + 0.05) / (y + 0.05)
}

// [foreground token, background token, minimum ratio, what it is]
const PAIRS = [
	['ink', 'panel', 7, 'body text on cards'],
	['ink', 'panel2', 7, 'text on inputs/unselected buttons'],
	['ink', 'surface', 7, 'text on page surface'],
	['soft', 'panel', 4.5, 'headings on cards'],
	['soft2', 'panel', 4.5, 'secondary headings on cards'],
	['accent', 'panel', 4.5, 'gold labels on cards'],
	['onprimary', 'primary', 4.5, 'primary button'],
	['onprimary', 'primaryl', 3, 'primary button (hover)'],
	['onaccent', 'accent', 4.5, 'accent button'],
	['onaccent', 'accentl', 3, 'accent button (hover)'],
	['onok', 'ok', 4.5, 'correct/start button'],
	['onok', 'okl', 3, 'correct/start button (hover)'],
	['onbad', 'bad', 4.5, 'danger button'],
	['onbad', 'badl', 3, 'danger button (hover)'],
	['oninfo', 'info', 4.5, 'info button'],
	['oninfo', 'infol', 3, 'info button (hover)']
]

let failed = 0
for (const [id, t] of Object.entries(themes)) {
	for (const [fg, bg, min, what] of PAIRS) {
		const r = ratio(t.vars[fg], t.vars[bg])
		if (r < min) {
			failed++
			console.log(`FAIL ${id}: ${what} (${fg} on ${bg}) = ${r.toFixed(2)}, needs ${min}`)
		}
	}
}
console.log(failed ? `\n${failed} contrast problem(s)` : `All ${Object.keys(themes).length} themes pass ${PAIRS.length} contrast checks.`)
process.exit(failed ? 1 : 0)
