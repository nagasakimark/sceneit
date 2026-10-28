import { useEffect, useRef, useState } from 'react'
import { createRace } from './engine'
import { FACES_LEFT } from './raceTypes'
import { beep, go, crossLine, fanfare } from './sound'

const EMOJI_FONT = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'
const TEXT_FONT = 'Rubik, "Noto Sans JP", sans-serif'
const MEDALS = ['🥇', '🥈', '🥉']
const COUNTDOWN = 3 // seconds of 3-2-1 before GO

// How each kind of racer moves. Returns small offsets/rotation/squash for this frame.
function motionFor (style, { t, i, speed, size, laneH, pos }) {
	const ph = t * (5 + speed * 7) + i * 1.7
	switch (style) {
		case 'drive': return { dy: Math.sin(ph * 2) * size * 0.025, rot: Math.sin(ph) * 0.015 }
		case 'float': return { dy: Math.sin(ph * 0.9) * size * 0.08, rot: Math.sin(ph * 0.9 + 1) * 0.08 }
		case 'hop': { const h = Math.abs(Math.sin(ph * 0.7)); return { dy: -h * size * 0.28, sx: 1.1 - 0.1 * h, sy: 0.88 + 0.12 * h } }
		case 'run': return { dy: -Math.abs(Math.sin(ph * 1.3)) * size * 0.12, rot: 0.12 + Math.sin(ph * 1.3) * 0.06 }
		case 'gallop': return { dy: -Math.abs(Math.sin(ph * 1.1)) * size * 0.16, rot: Math.sin(ph * 1.1) * 0.12 }
		case 'tumble': return { rot: pos * 60 + i }
		case 'slide': return { dy: Math.sin(ph * 0.6) * laneH * 0.12, rot: Math.cos(ph * 0.6) * 0.25 }
		case 'fly': return { dy: Math.sin(ph * 0.8) * laneH * 0.18 - size * 0.05, rot: Math.cos(ph * 0.8) * 0.18 }
		case 'spin': return { rot: pos * 120 + t * 8, dy: Math.sin(ph * 3) * 2 }
		default: return {}
	}
}

function fitText (ctx, text, maxW, startPx) {
	let px = startPx
	ctx.font = `900 ${px}px ${TEXT_FONT}`
	while (px > 10 && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `900 ${px}px ${TEXT_FONT}` }
	return px
}

// racers: [{ id, name, color }]. onFinish(orderOfIds) fires once, just after everyone has crossed the line.
export default function RaceGame ({ race, racers, duration = 14, muted: mutedProp = false, onFinish }) {
	const canvasRef = useRef(null)
	const wrapRef = useRef(null)
	const onFinishRef = useRef(onFinish)
	const mutedRef = useRef(mutedProp)
	const [muted, setMuted] = useState(mutedProp)
	useEffect(() => { onFinishRef.current = onFinish }, [onFinish])
	useEffect(() => { mutedRef.current = muted }, [muted])

	useEffect(() => {
		const canvas = canvasRef.current
		const wrap = wrapRef.current
		const ctx = canvas.getContext('2d')
		const N = racers.length
		const sim = createRace({ count: N, duration })
		const parts = []
		const medalSeen = new Set()
		let W = 0; let H = 0; let dpr = 1
		let raf = 0; let last = performance.now(); let clock = 0
		let phase = 'countdown'; let lastCount = null; let doneAt = null; let reported = false; let confetti = false
		const say = (fn) => { if (!mutedRef.current) fn() }

		const resize = () => {
			dpr = Math.min(2, window.devicePixelRatio || 1)
			W = wrap.clientWidth; H = wrap.clientHeight
			canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
			canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		}
		resize()
		const ro = new ResizeObserver(resize)
		ro.observe(wrap)

		const emojiAt = (i) => race.racers[i % race.racers.length]

		const burst = (x, y, n, color) => {
			for (let k = 0; k < n; k++) parts.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, life: 0.6 + Math.random() * 0.5, age: 0, r: 3 + Math.random() * 5, color })
		}

		const frame = (now) => {
			raf = requestAnimationFrame(frame)
			const dt = Math.min(0.05, (now - last) / 1000)
			last = now
			clock += dt

			// ----- update -----
			if (phase === 'countdown') {
				const left = COUNTDOWN + 0.4 - clock
				const shown = left > 0.4 ? Math.ceil(left - 0.4) : 0
				if (shown !== lastCount) { lastCount = shown; say(shown > 0 ? beep : go) }
				if (left <= 0) { phase = 'racing'; clock = 0 }
			} else if (phase === 'racing') {
				const before = sim.order.length
				sim.step(dt)
				if (sim.order.length > before) say(crossLine)
				if (sim.done) { phase = 'done'; doneAt = clock; say(fanfare) }
			}
			if (phase === 'done') {
				if (!confetti) {
					confetti = true
					for (let k = 0; k < 90; k++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 200, life: 3 + Math.random() * 2, age: 0, r: 5 + Math.random() * 6, color: `hsl(${Math.random() * 360} 90% 60%)`, square: true })
				}
				if (!reported && clock - doneAt > 0.8) {
					reported = true
					onFinishRef.current && onFinishRef.current(sim.order.map((i) => racers[i].id))
				}
			}

			// ----- layout -----
			const tr = race.track
			const skyH = H * 0.15
			const top = skyH
			const laneH = (H - skyH - H * 0.02) / N
			const x0 = W * 0.17
			const x1 = W * 0.87
			const size = Math.min(laneH * 0.86, 120)

			ctx.clearRect(0, 0, W, H)
			// sky
			let g = ctx.createLinearGradient(0, 0, 0, skyH)
			g.addColorStop(0, tr.sky[0]); g.addColorStop(1, tr.sky[1])
			ctx.fillStyle = g; ctx.fillRect(0, 0, W, skyH)
			ctx.font = `${skyH * 0.5}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
			tr.decor.forEach((d, k) => {
				const span = W + 240
				const x = (((k * span / tr.decor.length) - clock * 18) % span + span) % span - 120
				ctx.fillText(d, x, skyH * 0.58)
			})
			// ground
			g = ctx.createLinearGradient(0, top, 0, H)
			g.addColorStop(0, tr.ground[0]); g.addColorStop(1, tr.ground[1])
			ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top)
			for (let k = 0; k < N; k++) {
				if (k % 2) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, top + k * laneH, W, laneH) }
			}
			ctx.strokeStyle = tr.line; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; ctx.setLineDash([18, 16])
			for (let k = 1; k < N; k++) { ctx.beginPath(); ctx.moveTo(0, top + k * laneH); ctx.lineTo(W, top + k * laneH); ctx.stroke() }
			ctx.setLineDash([]); ctx.globalAlpha = 1
			// start + finish lines
			ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x0 - 3, top, 6, H - top)
			const sq = Math.max(8, laneH / 4)
			for (let y = top, row = 0; y < H; y += sq, row++) {
				for (let c = 0; c < 2; c++) { ctx.fillStyle = (row + c) % 2 ? '#111' : '#fff'; ctx.fillRect(x1 + size * 0.55 + c * sq, y, sq, Math.min(sq, H - y)) }
			}

			// ----- lane labels -----
			for (let k = 0; k < N; k++) {
				const cy = top + k * laneH + laneH / 2
				const h = Math.min(laneH * 0.7, 56); const w = x0 - 28
				ctx.fillStyle = racers[k].color || '#3b82f6'
				ctx.beginPath(); ctx.roundRect(12, cy - h / 2, w, h, h / 3); ctx.fill()
				ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke()
				const px = fitText(ctx, racers[k].name, w - 16, Math.min(h * 0.5, 30))
				ctx.font = `900 ${px}px ${TEXT_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
				ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(racers[k].name, 12 + w / 2, cy + 1)
				ctx.fillStyle = '#fff'; ctx.fillText(racers[k].name, 12 + w / 2, cy + 1)
			}

			// ----- racers -----
			const base = 1 / duration
			const leader = phase === 'racing' ? sim.leader() : -1
			for (let k = 0; k < N; k++) {
				const r = sim.racers[k]
				const cy = top + k * laneH + laneH / 2
				const cx = x0 + size * 0.5 + r.pos * (x1 - x0 - size * 0.5)
				const speed = phase === 'racing' ? Math.min(2.2, r.v / base) : (phase === 'done' ? 0.4 : 0.15)
				const emoji = emojiAt(k)
				const m = motionFor(race.motion, { t: clock, i: k, speed, size, laneH, pos: r.pos })

				if (phase === 'racing' && r.finish === null && speed > 0.95 && Math.random() < 0.35) burst(cx - size * 0.4, cy + size * 0.25, 1, tr.fx)
				if (r.boost > 0 && r.finish === null) { ctx.font = `${size * 0.5}px ${EMOJI_FONT}`; ctx.fillText('🔥', cx - size * 0.75, cy + (m.dy || 0)) }

				ctx.save()
				ctx.translate(cx, cy + (m.dy || 0))
				ctx.rotate(m.rot || 0)
				ctx.scale((m.sx || 1) * (FACES_LEFT.has(emoji) ? -1 : 1), m.sy || 1)
				ctx.font = `${size}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
				ctx.fillText(emoji, 0, 0)
				ctx.restore()

				if (r.stumble > 0 && r.finish === null) { ctx.font = `${size * 0.4}px ${EMOJI_FONT}`; ctx.fillText('💫', cx, cy - size * 0.6) }
				if (k === leader && r.finish === null && clock > 1.5) { ctx.font = `${size * 0.38}px ${EMOJI_FONT}`; ctx.fillText('👑', cx, cy - size * 0.62) }
				if (r.finish !== null) {
					const rank = sim.order.indexOf(k)
					if (!medalSeen.has(k)) { medalSeen.add(k); burst(x1, cy, 14, '#fde047') }
					ctx.font = `${Math.min(size * 0.7, 60)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'
					if (rank < 3) ctx.fillText(MEDALS[rank], x1 + size * 0.55 + sq * 3.2, cy)
					else { ctx.font = `900 ${Math.min(size * 0.55, 44)}px ${TEXT_FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(String(rank + 1), x1 + size * 0.55 + sq * 3.2, cy); ctx.fillStyle = '#fff'; ctx.fillText(String(rank + 1), x1 + size * 0.55 + sq * 3.2, cy) }
				}
			}

			// ----- particles -----
			for (let k = parts.length - 1; k >= 0; k--) {
				const p = parts[k]
				p.age += dt
				if (p.age > p.life) { parts.splice(k, 1); continue }
				p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.square ? 40 : 160) * dt
				ctx.globalAlpha = Math.max(0, 1 - p.age / p.life)
				ctx.fillStyle = p.color
				if (p.square) ctx.fillRect(p.x, p.y, p.r, p.r * 1.6)
				else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill() }
			}
			ctx.globalAlpha = 1
			if (parts.length > 500) parts.splice(0, parts.length - 500)

			// ----- overlays -----
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
			if (phase === 'countdown') {
				ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)
				const left = COUNTDOWN + 0.4 - clock
				const shown = left > 0.4 ? Math.ceil(left - 0.4) : 0
				const frac = left > 0.4 ? (left - 0.4) % 1 : 0
				const label = shown > 0 ? String(shown) : 'GO!'
				const s = Math.min(W, H) * (0.34 + (1 - frac) * 0.1)
				ctx.font = `900 ${s}px ${TEXT_FONT}`
				ctx.lineWidth = s * 0.08; ctx.strokeStyle = '#000'; ctx.strokeText(label, W / 2, H / 2)
				ctx.fillStyle = shown > 0 ? '#fde047' : '#4ade80'; ctx.fillText(label, W / 2, H / 2)
			}
			if (phase === 'done') {
				const s = Math.min(W * 0.09, 90)
				ctx.font = `900 ${s}px ${TEXT_FONT}`; ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#000'
				ctx.strokeText('🏁 FINISH! 🏁', W / 2, skyH * 0.5); ctx.fillStyle = '#fde047'; ctx.fillText('🏁 FINISH! 🏁', W / 2, skyH * 0.5)
			}
		}
		raf = requestAnimationFrame(frame)
		return () => { cancelAnimationFrame(raf); ro.disconnect() }
	}, [])

	return (
		<div ref={wrapRef} className="relative w-full h-full overflow-hidden select-none">
			<canvas ref={canvasRef} className="block" role="img" aria-label={`${race.name}: ${racers.length} racers`} />
			<button
				type="button"
				onClick={() => setMuted((m) => !m)}
				className="absolute top-2 right-2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-lg border border-white/30"
				aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
			>{muted ? '🔇' : '🔊'}</button>
		</div>
	)
}
