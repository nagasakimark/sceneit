import { useCallback, useEffect, useRef, useState } from 'react'

// ---------- CoverShapeEditor ----------
// Lets the author drag/resize a colored rectangle over the question image.
// Positions are stored as percentages so they stay correct at any display size.
export default function CoverShapeEditor ({ imageFile, coverShape, onChange }) {
	const containerRef = useRef(null)
	const [imgUrl, setImgUrl] = useState(null)
	const draggingRef = useRef(null) // { type, startMousePct, startShape }

	useEffect(() => {
		if (!imageFile) return
		const url = URL.createObjectURL(imageFile)
		setImgUrl(url)
		return () => URL.revokeObjectURL(url)
	}, [imageFile])

	const getPct = useCallback((e) => {
		const rect = containerRef.current.getBoundingClientRect()
		return {
			x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
			y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
		}
	}, [])

	const onMouseDown = useCallback((e, type) => {
		e.preventDefault()
		e.stopPropagation()
		draggingRef.current = { type, start: getPct(e), shape: { ...coverShape } }
	}, [coverShape, getPct])

	const onMouseMove = useCallback((e) => {
		if (!draggingRef.current) return
		const { type, start, shape } = draggingRef.current
		const cur = getPct(e)
		const dx = cur.x - start.x
		const dy = cur.y - start.y
		const s = { ...shape }
		if (type === 'move') {
			s.x = Math.max(0, Math.min(100 - s.width, s.x + dx))
			s.y = Math.max(0, Math.min(100 - s.height, s.y + dy))
		} else {
			if (type.includes('r')) { s.width = Math.max(5, Math.min(100 - s.x, s.width + dx)) }
			if (type.includes('b')) { s.height = Math.max(5, Math.min(100 - s.y, s.height + dy)) }
			if (type.includes('l')) {
				const nx = Math.max(0, Math.min(s.x + s.width - 5, s.x + dx))
				s.width = s.width - (nx - s.x)
				s.x = nx
			}
			if (type.includes('t')) {
				const ny = Math.max(0, Math.min(s.y + s.height - 5, s.y + dy))
				s.height = s.height - (ny - s.y)
				s.y = ny
			}
		}
		// Update the start reference so deltas are incremental
		draggingRef.current = { type, start: cur, shape: s }
		onChange(s)
	}, [getPct, onChange])

	const onMouseUp = useCallback(() => { draggingRef.current = null }, [])

	if (!imageFile) return null

	const handles = [
		{ id: 't', style: { top: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
		{ id: 'b', style: { bottom: -6, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
		{ id: 'l', style: { left: -6, top: '50%', transform: 'translateY(-50%)', cursor: 'w-resize' } },
		{ id: 'r', style: { right: -6, top: '50%', transform: 'translateY(-50%)', cursor: 'e-resize' } },
		{ id: 'tl', style: { top: -6, left: -6, cursor: 'nwse-resize' } },
		{ id: 'tr', style: { top: -6, right: -6, cursor: 'nesw-resize' } },
		{ id: 'bl', style: { bottom: -6, left: -6, cursor: 'nesw-resize' } },
		{ id: 'br', style: { bottom: -6, right: -6, cursor: 'nwse-resize' } }
	]

	return (
		<div
			ref={containerRef}
			className="relative w-full select-none mt-2 rounded overflow-hidden border border-gray-600 bg-black"
			onMouseMove={onMouseMove}
			onMouseUp={onMouseUp}
			onMouseLeave={onMouseUp}
		>
			{imgUrl && <img src={imgUrl} className="w-full block pointer-events-none" alt="Preview" draggable={false} />}
			{!imgUrl && <div className="h-20 flex items-center justify-center text-gray-500 text-xs">Loading preview…</div>}
			{coverShape && (
				<div
					className="absolute cursor-grab flex items-center justify-center"
					style={{
						left: `${coverShape.x}%`,
						top: `${coverShape.y}%`,
						width: `${coverShape.width}%`,
						height: `${coverShape.height}%`,
						background: 'linear-gradient(135deg, rgb(var(--th-surface)) 0%, #2d3a5e 100%)',
						border: '2px solid rgb(var(--th-primary))',
						boxShadow: '0 0 12px #685af588'
					}}
					onMouseDown={(e) => onMouseDown(e, 'move')}
				>
					<div className="flex flex-col items-center pointer-events-none select-none gap-0.5">
						<span className="text-th-soft2 font-black" style={{ fontSize: 'clamp(10px,4cqw,2rem)' }}>?</span>
						<span className="text-yellow-300 text-[10px] font-bold opacity-70">drag to move</span>
					</div>
					{handles.map(h => (
						<div
							key={h.id}
							className="absolute w-3 h-3 bg-yellow-400 border-2 border-white rounded-full"
							style={{ position: 'absolute', ...h.style }}
							onMouseDown={(e) => onMouseDown(e, h.id)}
						/>
					))}
				</div>
			)}
		</div>
	)
}
