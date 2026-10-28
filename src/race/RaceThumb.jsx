// Picker tile for a race: its track colours with three of its racers lined up.
export default function RaceThumb ({ race, children }) {
	const { sky, ground } = race.track
	return (
		<div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 38%, ${ground[0]} 38%, ${ground[1]} 100%)` }}>
			<div className="absolute inset-x-0 top-[6%] text-center text-2xl opacity-80">{race.track.decor[0]}</div>
			<div className="absolute inset-x-0 top-[34%] flex justify-around px-2 text-4xl md:text-5xl">
				{race.racers.slice(0, 3).map((e, i) => <span key={i} style={{ transform: `translateY(${i % 2 ? 6 : -4}px)` }}>{e}</span>)}
			</div>
			{children}
		</div>
	)
}
