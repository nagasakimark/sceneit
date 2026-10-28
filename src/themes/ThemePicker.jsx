import { THEMES, THEME_IDS } from './themes'

// Row of theme buttons. Used by the quiz maker and the player's setup screen.
export default function ThemePicker ({ value, onChange, label = 'Theme' }) {
	return (
		<div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
			{THEME_IDS.map((id) => {
				const t = THEMES[id]
				const on = id === value
				return (
					<button
						key={id}
						type="button"
						role="radio"
						aria-checked={on}
						onClick={() => onChange(id)}
						className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border-2 font-bold text-sm transition-all ${on ? 'border-white bg-white/20 scale-105' : 'border-white/20 bg-black/30 hover:bg-white/10'}`}
					>
						<span className="flex -space-x-1" aria-hidden="true">
							{[t.vars.panel, t.vars.primary, t.vars.accent].map((c, i) => (
								<span key={i} className="w-4 h-4 rounded-full border border-white/50" style={{ background: c }} />
							))}
						</span>
						<span>{t.emoji} {t.label}</span>
					</button>
				)
			})}
		</div>
	)
}
