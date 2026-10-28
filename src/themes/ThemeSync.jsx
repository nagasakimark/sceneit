import { useEffect } from 'react'
import { useTheme } from './useTheme'
import { STORAGE_KEY, isTheme } from './themes'

// Keeps <html data-theme> in step with the store. Start-up order: ?theme= in the URL,
// then the teacher's saved choice. A loaded quiz file can override it afterwards.
export default function ThemeSync () {
	const theme = useTheme((s) => s.theme)

	useEffect(() => {
		let start = null
		try { start = new URLSearchParams(window.location.search).get('theme') || localStorage.getItem(STORAGE_KEY) } catch (e) {}
		if (isTheme(start)) useTheme.getState().setTheme(start)
	}, [])

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme)
	}, [theme])

	return null
}
