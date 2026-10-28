// Race simulation. Pure maths, no DOM, no React: easy to test and easy to reuse in a standalone app.
// Every race is random. Nobody is secretly favoured: all racers get the same rules.

export function mulberry32 (seed) {
	let a = seed | 0
	return () => {
		a = (a + 0x6D2B79F5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// count: number of racers. duration: rough seconds for the leader to cross the line.
export function createRace ({ count, duration = 14, seed = (Math.random() * 2 ** 32) >>> 0 }) {
	const rand = mulberry32(seed)
	const base = 1 / duration
	const racers = Array.from({ length: count }, () => ({
		pos: 0, v: base, mult: 1, change: rand() * 0.6, boost: 0, stumble: 0, finish: null
	}))
	const race = { t: 0, racers, order: [], done: false, firstFinish: null, seed }

	race.step = (dt) => {
		if (race.done) return
		race.t += dt
		const avg = racers.reduce((s, r) => s + r.pos, 0) / count
		let crossed = false
		for (const r of racers) {
			if (r.finish !== null) continue
			r.change -= dt
			r.boost = Math.max(0, r.boost - dt)
			r.stumble = Math.max(0, r.stumble - dt)
			if (r.change <= 0) {
				r.change = 0.5 + rand() * 0.9
				r.mult = 0.7 + rand() * 0.65 // each racer picks a new pace every second or so
				const e = rand()
				if (e < 0.07) r.boost = 0.9 // sudden burst
				else if (e < 0.12) r.stumble = 0.7 // little stumble
			}
			let m = r.mult
			if (r.boost > 0) m *= 1.6
			if (r.stumble > 0) m *= 0.3
			// Gentle rubber band so the pack stays close and the lead keeps changing.
			const catchup = clamp(1 + 1.1 * (avg - r.pos), 0.78, 1.28)
			let target = base * m * catchup
			if (race.firstFinish !== null) target *= 1.35 // once someone wins, the rest hurry up
			r.v += (target - r.v) * Math.min(1, dt * 6)
			r.pos += r.v * dt
			if (r.pos >= 1) {
				r.finish = race.t - (r.pos - 1) / Math.max(r.v, 1e-6)
				r.pos = 1
				crossed = true
			}
		}
		if (crossed) {
			race.order = racers.map((r, i) => i).filter((i) => racers[i].finish !== null).sort((a, b) => racers[a].finish - racers[b].finish)
			if (race.firstFinish === null) race.firstFinish = race.t
		}
		if (race.order.length === count) race.done = true
	}
	race.leader = () => racers.reduce((best, r, i) => (r.pos > racers[best].pos ? i : best), 0)
	return race
}
