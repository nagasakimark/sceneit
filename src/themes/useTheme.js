import { create } from 'zustand'
import { DEFAULT_THEME, STORAGE_KEY, isTheme } from './themes'

function save (id) {
	try { localStorage.setItem(STORAGE_KEY, id) } catch (e) {}
}

export const useTheme = create((set) => ({
	theme: DEFAULT_THEME,
	// remember: true for a teacher's manual pick; false when a quiz file sets it.
	setTheme: (id, remember = false) => {
		if (!isTheme(id)) return
		if (remember) save(id)
		set({ theme: id })
	}
}))
