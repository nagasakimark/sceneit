import { useState } from 'react'
import { RaceGame, RaceThumb, RACES } from '@/race'

const RACERS = [
	{ id: '1', name: 'Red', color: '#ff1744' }, { id: '2', name: 'Blue', color: '#2979ff' },
	{ id: '3', name: 'Green', color: '#00c853' }, { id: '4', name: 'Yellow', color: '#ffd600' },
	{ id: '5', name: 'Purple', color: '#aa00ff' }
]

// Standalone race demo — also shows how the race module can run outside the quiz.
export default function RaceDemo () {
	const [race, setRace] = useState(null)
	const [order, setOrder] = useState(null)
	if (race) {
		return (
			<div className="fixed inset-0 bg-black">
				<RaceGame key={race.id + (order ? 'x' : '')} race={race} racers={RACERS} duration={14} onFinish={(o) => setOrder(o)} />
				<div className="absolute top-2 left-2 flex gap-2 items-center">
					<button className="px-3 py-1 rounded bg-white text-black font-bold" onClick={() => { setRace(null); setOrder(null) }}>Back</button>
					{order && <span className="bg-white/90 text-black px-3 py-1 rounded font-bold" data-testid="order">{order.join(',')}</span>}
				</div>
			</div>
		)
	}
	return (
		<div className="min-h-screen bg-gray-900 p-4 grid grid-cols-4 gap-3">
			{RACES.map((r) => (
				<button key={r.id} onClick={() => setRace(r)} className="relative h-40 rounded-xl overflow-hidden border-2 border-white/30">
					<RaceThumb race={r} />
					<span className="absolute bottom-1 inset-x-0 text-white text-xs font-black uppercase">{r.name}</span>
				</button>
			))}
		</div>
	)
}
