// Every race is data: which emoji race, how they move, and what the track looks like.
// Adding a race = adding an entry here. Swap emoji for images later without touching the engine.
//
// motion: drive | float | hop | run | gallop | tumble | slide | fly | spin
// track:  sky (top gradient), ground (lane gradient), line (lane divider colour),
//         decor (emoji scenery along the top), fx (particle colour behind fast racers)

// Emoji that face LEFT in Noto (Chromebook) emoji. The renderer flips these so everyone races to the right.
export const FACES_LEFT = new Set(['🏎️', '🚗', '🚙', '🚓', '🚕', '🛺', '🚜', '🏍️', '🛵', '🚤', '🚌', '🐄', '🐖', '🐑', '🐢', '🐇', '🦌', '🛷', '⛷️', '🚂', '🦈', '🐊', '🦒', '🐘', '🐕', '🐌', '🦆', '🐝', '🐓', '🦀', '🦜', '🐺', '🦉', '🐻', '🛹', '🚲'])

export const RACES = [
	{ id: 'cars', name: 'Car Race', emoji: '🏎️', motion: 'drive', racers: ['🏎️', '🚗', '🚙', '🚓', '🚕', '🛺', '🚜', '🏍️', '🛵', '🚌'], track: { sky: ['#7dd3fc', '#e0f2fe'], ground: ['#4b5563', '#374151'], line: '#f9fafb', decor: ['☁️', '🌳', '🏢', '☁️'], fx: '#d1d5db' } },
	{ id: 'karts', name: 'Go Cart Race', emoji: '🏁', motion: 'drive', racers: ['🛵', '🏍️', '🚲', '🛺', '🛹', '🏎️', '🚜', '🚗', '🚙', '🚓'], track: { sky: ['#fdba74', '#fef3c7'], ground: ['#a16207', '#854d0e'], line: '#fef3c7', decor: ['🌵', '☁️', '🚧', '🌵'], fx: '#fde68a' } },
	{ id: 'boats', name: 'Speed Boat Race', emoji: '🚤', motion: 'float', racers: ['🚤', '⛵', '🛶', '🚢', '🦆', '🐢', '🐧', '🦈', '🐙', '🐊'], track: { sky: ['#bae6fd', '#f0f9ff'], ground: ['#0ea5e9', '#0369a1'], line: '#e0f2fe', decor: ['☁️', '🏝️', '☁️', '🌴'], fx: '#ffffff' } },
	{ id: 'pirates', name: 'Pirate Race', emoji: '🏴‍☠️', motion: 'float', racers: ['⛵', '🚢', '🛶', '🚤', '🦈', '🐙', '🐊', '🦀', '🦜', '🐢'], track: { sky: ['#fcd34d', '#fde68a'], ground: ['#0f766e', '#134e4a'], line: '#99f6e4', decor: ['☁️', '🏝️', '🦜', '☁️'], fx: '#ccfbf1' } },
	{ id: 'monsters', name: 'Monsters Race', emoji: '👾', motion: 'hop', racers: ['👾', '👹', '👽', '🤖', '👻', '🦖', '🐙', '🦇', '🐲', '🦑'], track: { sky: ['#4c1d95', '#7c3aed'], ground: ['#312e81', '#1e1b4b'], line: '#a78bfa', decor: ['🌙', '🍄', '⭐', '🍄'], fx: '#c4b5fd' } },
	{ id: 'food', name: 'Food Race', emoji: '🍕', motion: 'run', racers: ['🍕', '🍔', '🍟', '🌭', '🍩', '🍎', '🍌', '🥕', '🍉', '🧀'], track: { sky: ['#fecaca', '#fef2f2'], ground: ['#dc2626', '#991b1b'], line: '#fee2e2', decor: ['🍴', '🥤', '🍴', '🍰'], fx: '#fde68a' } },
	{ id: 'farm', name: 'Farm Race', emoji: '🐮', motion: 'gallop', racers: ['🐄', '🐖', '🐑', '🐎', '🐕', '🐇', '🦆', '🐓', '🐢', '🐌'], track: { sky: ['#93c5fd', '#dbeafe'], ground: ['#65a30d', '#3f6212'], line: '#d9f99d', decor: ['☀️', '🌻', '🌾', '☁️'], fx: '#d6d3d1' } },
	{ id: 'toys', name: 'Toy Race', emoji: '🧸', motion: 'hop', racers: ['🧸', '🤖', '🚂', '🪁', '🎲', '🧩', '🚀', '🪅', '🎈', '🪀'], track: { sky: ['#fbcfe8', '#fdf2f8'], ground: ['#d6a35c', '#b07d36'], line: '#fde68a', decor: ['🧩', '🎨', '🎲', '🧩'], fx: '#fef08a' } },
	{ id: 'blocks', name: 'Block Race', emoji: '🧱', motion: 'tumble', racers: ['🟥', '🟦', '🟩', '🟨', '🟪', '🟧', '🧱', '📦', '🧊', '🎲'], track: { sky: ['#bfdbfe', '#eff6ff'], ground: ['#2563eb', '#1e3a8a'], line: '#bfdbfe', decor: ['☁️', '🧱', '☁️', '🏗️'], fx: '#ffffff' } },
	{ id: 'ski', name: 'Downhill Ski Race', emoji: '⛷️', motion: 'slide', racers: ['⛷️', '🏂', '🛷', '🐧', '🦌', '🐻', '⛄', '🧊', '🐺', '🦉'], track: { sky: ['#bae6fd', '#f8fafc'], ground: ['#e0f2fe', '#bae6fd'], line: '#7dd3fc', decor: ['🌲', '🏔️', '❄️', '🌲'], fx: '#ffffff' } },
	{ id: 'halloween', name: 'Halloween Race', emoji: '🎃', motion: 'float', racers: ['👻', '🎃', '🦇', '🧙', '🕷️', '💀', '🧛', '🦉', '🐺', '🕸️'], track: { sky: ['#1e1b4b', '#4c1d95'], ground: ['#2e1065', '#170b33'], line: '#fb923c', decor: ['🌕', '🪦', '🕸️', '🌳'], fx: '#fdba74' } },
	{ id: 'santa', name: 'Santa Race', emoji: '🎅', motion: 'fly', racers: ['🎅', '🦌', '🛷', '⛄', '🎁', '🧝', '🎄', '🔔', '⭐', '🍪'], track: { sky: ['#1e3a8a', '#312e81'], ground: ['#1e293b', '#0f172a'], line: '#fecaca', decor: ['⭐', '🌙', '❄️', '🎄'], fx: '#ffffff' } },
	{ id: 'easter', name: 'Easter Race', emoji: '🐣', motion: 'hop', racers: ['🐰', '🐣', '🥚', '🐇', '🐥', '🌷', '🦋', '🐑', '🐝', '🌼'], track: { sky: ['#fbcfe8', '#e0f2fe'], ground: ['#86efac', '#4ade80'], line: '#dcfce7', decor: ['🌈', '🌷', '☁️', '🌼'], fx: '#fef9c3' } },
	{ id: 'spin', name: 'Spin Race', emoji: '🌀', motion: 'spin', racers: ['🌀', '🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⚪', '🔶', '💫'], track: { sky: ['#111827', '#1f2937'], ground: ['#1e293b', '#0f172a'], line: '#38bdf8', decor: ['⚡', '✨', '⚡', '✨'], fx: '#38bdf8' } },
	{ id: 'silly', name: 'Silly Animals', emoji: '🦄', motion: 'hop', racers: ['🦈', '🐊', '🐘', '🦒', '🐙', '🦄', '🐌', '🐧', '🦖', '🍌'], track: { sky: ['#fde047', '#fef9c3'], ground: ['#f472b6', '#be185d'], line: '#fce7f3', decor: ['🎈', '🌈', '🎈', '⭐'], fx: '#fbcfe8' } }
]

export const getRace = (id) => RACES.find((r) => r.id === id) || RACES[0]
