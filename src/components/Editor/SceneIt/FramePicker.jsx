import { useEffect, useRef, useState } from 'react'

// Lets the teacher scrub the movie's clip and grab the current frame as a JPEG File.
export default function FramePicker ({ video, onPick, label = '🎞 Pick a frame from the video' }) {
	const [open, setOpen] = useState(false)
	const [url, setUrl] = useState(null)
	const videoRef = useRef(null)

	useEffect(() => {
		if (!open || !video) return
		const u = URL.createObjectURL(video)
		setUrl(u)
		return () => URL.revokeObjectURL(u)
	}, [open, video])

	if (!video) {
		return <span className="text-xs text-white/50 mt-2 block">Add a video clip to this movie first to pick a frame from it.</span>
	}

	const step = (d) => {
		const v = videoRef.current
		if (!v) return
		v.pause()
		v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + d))
	}

	const grab = async () => {
		const v = videoRef.current
		if (!v) return
		// Wait until the frame at the current position is actually decoded.
		if (v.seeking || v.readyState < 2) {
			await new Promise((resolve) => {
				const done = () => { v.removeEventListener('seeked', done); v.removeEventListener('loadeddata', done); resolve() }
				v.addEventListener('seeked', done)
				v.addEventListener('loadeddata', done)
				setTimeout(done, 3000)
			})
		}
		if (!v.videoWidth) return
		const c = document.createElement('canvas')
		c.width = v.videoWidth
		c.height = v.videoHeight
		c.getContext('2d').drawImage(v, 0, 0)
		c.toBlob((b) => {
			if (!b) return
			onPick(new File([b], `frame_${v.currentTime.toFixed(2)}s.jpg`, { type: 'image/jpeg' }))
			setOpen(false)
		}, 'image/jpeg', 0.92)
	}

	const btn = 'px-3 py-1 rounded text-xs font-bold bg-th-panel2 hover:bg-white/20 text-th-ink'
	return (
		<div className="mt-2">
			<button type="button" onClick={() => setOpen(!open)} className="text-sm text-th-soft hover:underline font-bold">
				{open ? 'Close video' : label}
			</button>
			{open && url && (
				<div className="mt-2 bg-black/30 p-2 rounded-lg">
					<video ref={videoRef} src={url} controls preload="auto" className="w-full rounded max-h-64 bg-black" />
					<div className="flex flex-wrap gap-2 mt-2">
						<button type="button" onClick={() => step(-1)} className={btn}>◀◀ 1s</button>
						<button type="button" onClick={() => step(-0.04)} className={btn}>◀ Frame</button>
						<button type="button" onClick={() => step(0.04)} className={btn}>Frame ▶</button>
						<button type="button" onClick={() => step(1)} className={btn}>1s ▶▶</button>
						<button type="button" onClick={grab} className="px-3 py-1 rounded text-xs font-black bg-th-ok hover:bg-th-okl text-th-onok ml-auto">Use this frame</button>
					</div>
				</div>
			)}
		</div>
	)
}
