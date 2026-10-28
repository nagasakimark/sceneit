// Tiny synthesised sounds (no audio files to download or license).
let ctx = null
function audio () {
	if (typeof window === 'undefined') return null
	if (!ctx) {
		const AC = window.AudioContext || window.webkitAudioContext
		if (!AC) return null
		ctx = new AC()
	}
	if (ctx.state === 'suspended') ctx.resume().catch(() => {})
	return ctx
}

export function tone (freq, dur = 0.15, { type = 'square', vol = 0.12, delay = 0 } = {}) {
	const a = audio()
	if (!a) return
	const t0 = a.currentTime + delay
	const o = a.createOscillator()
	const g = a.createGain()
	o.type = type
	o.frequency.setValueAtTime(freq, t0)
	g.gain.setValueAtTime(0.0001, t0)
	g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
	o.connect(g).connect(a.destination)
	o.start(t0)
	o.stop(t0 + dur + 0.02)
}

export const beep = () => tone(440, 0.18)
export const go = () => { tone(880, 0.4); tone(1320, 0.4, { delay: 0.05, vol: 0.06 }) }
export const crossLine = () => tone(660, 0.12, { type: 'triangle', vol: 0.1 })
export const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.14, delay: i * 0.13 }))
