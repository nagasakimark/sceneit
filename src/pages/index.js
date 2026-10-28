import Head from 'next/head'
import { useState, useRef } from 'react'
import PageFooter from '@/components/PageFooter'
import playSound from '@/helpers/playSound'
import { withBasePath } from '@/helpers/basePath'

export default function Main () {
	const [started, setStarted] = useState(false)
	const videoRef = useRef(null)

	function handleStart () {
		playSound('pop')
		setStarted(true)
		// Give React a tick to mount the video, then play it
		setTimeout(() => {
			if (videoRef.current) {
				videoRef.current.play().catch(() => {})
			}
		}, 50)
	}

	function handlePlay () {
		playSound('pop')
		window.location.href = withBasePath('/play/scene-it')
	}

	if (!started) {
		return (
			<>
				<Head><title>Scene-it</title></Head>
				<main
					className="relative w-full min-h-screen flex flex-col items-center justify-center text-center text-white overflow-hidden"
					style={{
						backgroundImage: `url('${withBasePath('/play_bg.webp')}')`,
						backgroundColor: '#307de7',
						backgroundBlendMode: 'multiply',
						backgroundSize: 'cover',
						backgroundPosition: 'center'
					}}
				>
					<button
						onClick={handleStart}
						className="btn-primary bg-th-bad before:bg-th-badd hover:bg-th-badl uppercase px-16 py-7 text-4xl shadow-2xl"
						style={{ fontFamily: 'PrintClearly, sans-serif', letterSpacing: '0.08em' }}
					>
						<span style={{ position: 'relative', zIndex: 1 }}>▶ Start</span>
					</button>
				</main>
			</>
		)
	}

	return (
		<>
			<Head>
				<title>Scene-it</title>
			</Head>
			<main className="mainHome relative w-full min-h-screen flex flex-col items-center justify-end text-center text-white overflow-hidden" style={{ background: 'rgb(28, 35, 58)' }}>
				{/* Full-page background video — freezes on last frame */}
				<video
					ref={videoRef}
					src={withBasePath('/intro.mp4')}
					playsInline
					onEnded={(e) => { e.target.pause() }}
					style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
				/>

				{/* Buttons pinned to the bottom, above the video */}
				<div className="relative z-10 w-full flex flex-col items-center gap-4 pb-12 px-5">
					<button
						onClick={handlePlay}
						className="btn-primary uppercase px-8 py-5 text-2xl max-w-md w-full shadow-lg hover:scale-105 transition-transform"
					>
						Play
					</button>
					<a href={withBasePath('/editor')} className="btn-primary bg-purple-600 hover:bg-purple-700 border-none uppercase px-8 py-5 text-2xl max-w-md w-full block">
						Editor
					</a>
					<PageFooter />
				</div>
			</main>
			<style jsx global>{`
				#__next {
					display: block;
				}
			`}</style>
		</>
	)
}
