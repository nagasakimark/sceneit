import JSZip from 'jszip'
import { compressVideo } from '@/helpers/compressVideo'

export const MAX_MOVIES = 10

let counter = Date.now()
export const uid = () => ++counter

export const newQuestion = () => ({ id: uid(), question: '', answers: ['', '', '', ''], correct: -1, image: null, coverShape: null })
export const newMovie = (over = {}) => ({ id: uid(), title: '', poster: null, video: null, coveredImage: null, coveredImageBlurred: true, questions: [], ...over })

export const correctText = (q) => (q.correct >= 0 && q.answers[q.correct] ? q.answers[q.correct].trim() : '')

// "cool_movie-clip.mp4" -> "Cool Movie Clip"
export function titleFromFilename (name) {
	return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
		.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function formatBytes (n) {
	if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
	return `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`
}

// Grabs one frame of a video as a JPEG File (used for automatic posters).
export function grabFrame (videoFile, atSeconds = 1) {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(videoFile)
		const v = document.createElement('video')
		let finished = false
		const done = (f) => { if (finished) return; finished = true; URL.revokeObjectURL(url); resolve(f) }
		v.muted = true
		v.preload = 'auto'
		v.playsInline = true
		v.onloadedmetadata = () => { v.currentTime = Math.min(atSeconds, (v.duration || 2) * 0.5) }
		v.onseeked = () => {
			try {
				const c = document.createElement('canvas')
				c.width = v.videoWidth
				c.height = v.videoHeight
				c.getContext('2d').drawImage(v, 0, 0)
				c.toBlob((b) => done(b ? new File([b], 'poster.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.9)
			} catch (e) { done(null) }
		}
		v.onerror = () => done(null)
		v.src = url
		setTimeout(() => done(null), 15000)
	})
}

// ---------- open an existing quiz zip ----------
export async function loadQuizForEditing (file) {
	const zip = await JSZip.loadAsync(file)
	const jsonFile = zip.file('quiz.json')
	if (!jsonFile) throw new Error('This does not look like a quiz file (quiz.json is missing).')
	const quizData = JSON.parse(await jsonFile.async('string'))

	async function extractAsFile (path) {
		if (!path) return null
		let entry = zip.file(path)
		if (!entry) {
			const basename = path.split('/').pop()
			const key = Object.keys(zip.files).find((k) => k.endsWith(basename))
			if (!key) return null
			entry = zip.file(key)
		}
		if (!entry) return null
		const blob = await entry.async('blob')
		return new File([blob], path.split('/').pop())
	}

	const movies = []
	for (let i = 0; i < (quizData.movies || []).length; i++) {
		const m = quizData.movies[i]
		const questions = []
		for (let j = 0; j < (m.questions || []).length; j++) {
			const q = m.questions[j]
			const answers = [...(q.answers || []), '', '', '', ''].slice(0, Math.max(4, (q.answers || []).length))
			const want = (q.correctAnswer || '').trim()
			questions.push({
				id: q.id || uid(),
				question: q.question || '',
				answers,
				correct: want ? answers.findIndex((a) => a && a.trim() === want) : -1,
				image: await extractAsFile(q.image),
				coverShape: q.coverShape || null
			})
		}
		movies.push({
			id: m.id || uid(),
			title: m.title || '',
			poster: await extractAsFile(m.poster),
			video: await extractAsFile(m.video),
			coveredImage: await extractAsFile(m.coveredImage),
			coveredImageBlurred: !!m.coveredImageBlurred,
			questions
		})
	}
	return { movies, theme: quizData.theme, title: quizData.title || '' }
}

// ---------- checks ----------
const unmatched = (s) => ((s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length)

// Returns [{ level: 'error' | 'warn', movie, question, text }]
export function validate (movies) {
	const out = []
	const add = (level, movie, question, text) => out.push({ level, movie, question, text })
	if (movies.length === 0) {
		add('error', null, null, 'Add at least one movie clip.')
		return out
	}
	movies.forEach((m, i) => {
		if (!m.title.trim()) add('error', i, null, 'Needs a title.')
		else if (unmatched(m.title)) add('warn', i, null, 'Title has an unmatched bracket, so the small Japanese text may not show properly.')
		if (!m.video) add('error', i, null, 'Needs a video clip.')
		if (!m.poster) add('error', i, null, 'Needs a poster (the picture shown when the answer is revealed).')
		if (!m.coveredImageBlurred && !m.coveredImage) add('error', i, null, 'Needs a cover image, or switch to the blurred poster.')
		if (m.questions.length === 0) add('error', i, null, 'Needs at least one question.')
		m.questions.forEach((q, j) => {
			if (!q.question.trim()) add('error', i, j, 'Question text is empty.')
			else if (unmatched(q.question)) add('warn', i, j, 'Question has an unmatched bracket.')
			const filled = q.answers.filter((a) => a && a.trim()).length
			if (filled < 2) add('error', i, j, 'Needs at least 2 answers.')
			else if (filled < 4) add('warn', i, j, `Only ${filled} answers filled in (4 is usual).`)
			if (q.correct < 0) add('error', i, j, 'Click the circle next to the correct answer.')
			else if (!correctText(q)) add('error', i, j, 'The answer marked correct is empty.')
			if (q.answers.some((a) => a && unmatched(a))) add('warn', i, j, 'An answer has an unmatched bracket.')
		})
	})
	return out
}

// ---------- save ----------
export async function buildQuizZip ({ title, theme, movies, compress, onProgress }) {
	const zip = new JSZip()
	const assets = zip.folder('assets')
	const quiz = { type: 'scene-it', title, theme, created: new Date().toISOString(), movies: [] }

	for (let i = 0; i < movies.length; i++) {
		const m = movies[i]
		const entry = { id: m.id, title: m.title, questions: [] }
		const put = (file, tag) => {
			const name = `movie_${i}_${tag}.${file.name.split('.').pop()}`
			assets.file(name, file)
			return `assets/${name}`
		}
		if (m.poster) entry.poster = put(m.poster, 'poster')
		if (m.video) {
			let video = m.video
			if (compress) {
				onProgress && onProgress(`Compressing clip ${i + 1} of ${movies.length}…`, 0)
				video = await compressVideo(m.video, (p) => onProgress && onProgress(`Compressing clip ${i + 1} of ${movies.length}…`, p))
			}
			entry.video = put(video, 'video')
		}
		if (m.coveredImageBlurred) entry.coveredImageBlurred = true
		else if (m.coveredImage) entry.coveredImage = put(m.coveredImage, 'covered')

		m.questions.forEach((q, j) => {
			const qe = { id: q.id, question: q.question, answers: q.answers, correctAnswer: correctText(q) }
			if (q.image) qe.image = put(q.image, `q_${j}`)
			if (q.coverShape) qe.coverShape = q.coverShape
			entry.questions.push(qe)
		})
		quiz.movies.push(entry)
	}
	zip.file('quiz.json', JSON.stringify(quiz, null, 2))
	onProgress && onProgress('Packing the quiz file…', 1)
	return zip.generateAsync({ type: 'blob' })
}

// ---------- draft autosave (IndexedDB keeps the actual video/image files) ----------
const DB = 'sceneit-maker'
function openDb () {
	return new Promise((resolve, reject) => {
		const r = indexedDB.open(DB, 1)
		r.onupgradeneeded = () => r.result.createObjectStore('drafts')
		r.onsuccess = () => resolve(r.result)
		r.onerror = () => reject(r.error)
	})
}
async function tx (mode, fn) {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const t = db.transaction('drafts', mode)
		const req = fn(t.objectStore('drafts'))
		t.oncomplete = () => resolve(req && req.result)
		t.onerror = () => reject(t.error)
	})
}
export const saveDraft = (d) => tx('readwrite', (s) => s.put({ ...d, savedAt: Date.now() }, 'current')).catch(() => {})
export const loadDraft = () => tx('readonly', (s) => s.get('current')).catch(() => null)
export const clearDraft = () => tx('readwrite', (s) => s.delete('current')).catch(() => {})
