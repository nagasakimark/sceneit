import '@/styles/globals.css'
import { Rubik } from '@next/font/google'
import Head from 'next/head'
import { useEffect } from 'react'
import NewGameForm from '@/components/Form/NewGameForm'
import { registerRacePackServiceWorkerOnly } from '@/helpers/racePack'
const rubik = Rubik({ subsets: ['latin'] })

export default function App ({ Component, pageProps }) {
	// Block mouse side-buttons (thumb back/forward) from triggering browser navigation
	useEffect(() => {
		const block = (e) => {
			if (e.button === 3 || e.button === 4) {
				e.preventDefault()
				e.stopPropagation()
			}
		}
		window.addEventListener('mousedown', block)
		window.addEventListener('mouseup', block)
		window.addEventListener('click', block)
		window.addEventListener('auxclick', block)
		return () => {
			window.removeEventListener('mousedown', block)
			window.removeEventListener('mouseup', block)
			window.removeEventListener('click', block)
			window.removeEventListener('auxclick', block)
		}
	}, [])

	// Register SW early so it can control the page before /race is needed.
	// We do NOT download/unzip the pack here (that happens lazily on game screens).
	useEffect(() => {
		registerRacePackServiceWorkerOnly().catch(() => {})
	}, [])
	return (
		<>
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<Component {...pageProps} />
			<NewGameForm />
			<style jsx global>{`
        html {
          font-family: ${rubik.style.fontFamily};
        }
      `}</style>
		</>
	)
}
