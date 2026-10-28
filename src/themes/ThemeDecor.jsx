import { useEffect, useState } from 'react'
import { useTheme } from './useTheme'
import { THEMES } from './themes'

const COUNT = 16

// Falling snow, flying bats, rising eggs... Purely decorative: sits above the page,
// never takes clicks, and is hidden for people who prefer reduced motion.
export default function ThemeDecor () {
	const theme = useTheme((s) => s.theme)
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	const t = THEMES[theme]
	if (!mounted || !t || !t.decor.length) return null

	return (
		<div aria-hidden="true">
			{Array.from({ length: COUNT }, (_, i) => {
				// Deterministic spread so re-renders don't make particles jump.
				const r = (n) => ((i * 9301 + n * 49297) % 233280) / 233280
				// Bats cross a thin strip at the very top; everything else stays in the
				// side margins so it never covers cards, buttons or the video.
				const flies = t.motion === 'fly' && t.decor[i % t.decor.length] === '🦇'
				const motion = flies ? 'fly' : (t.motion === 'fly' ? 'fall' : t.motion)
				const left = i % 2 === 0 ? r(1) * 13 : 86 + r(1) * 11
				return (
					<span
						key={`${theme}-${i}`}
						className={`th-particle th-${motion}`}
						style={{
							left: flies ? undefined : `${left.toFixed(1)}%`,
							top: flies ? `${(1 + r(4) * 6).toFixed(1)}%` : undefined,
							fontSize: `${20 + Math.round(r(2) * 20)}px`,
							animationDuration: `${(flies ? 16 : 12) + Math.round(r(3) * 14)}s`,
							animationDelay: `-${Math.round(r(5) * 26)}s`
						}}
					>
						{t.decor[i % t.decor.length]}
					</span>
				)
			})}
			{t.corner && <span className="th-corner">{t.corner}</span>}
		</div>
	)
}
