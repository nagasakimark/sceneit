import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import FramePicker from './FramePicker'
import CoverShapeEditor from './CoverShapeEditor'
import ThemePicker from '@/themes/ThemePicker'
import { useTheme } from '@/themes/useTheme'
import { isTheme } from '@/themes/themes'
import {
	MAX_MOVIES, newMovie, newQuestion, titleFromFilename, formatBytes, grabFrame,
	loadQuizForEditing, validate, buildQuizZip, saveDraft, loadDraft, clearDraft
} from './model'

// ---------- small building blocks ----------
const TONES = {
	primary: 'bg-th-primary before:bg-th-primaryd',
	ok: 'bg-th-ok before:bg-th-okd',
	accent: 'bg-th-accent before:bg-th-accentd',
	bad: 'bg-th-bad before:bg-th-badd',
	soft: 'bg-th-panel2 before:bg-th-paneld'
}

function Btn ({ tone = 'primary', className = '', ...p }) {
	return <button type="button" {...p} className={`btn-primary ${TONES[tone]} px-5 py-2 font-black uppercase tracking-wide text-sm ${className}`} />
}

const card = 'bg-th-panel border-2 border-white/10 rounded-2xl p-5'
const input = 'w-full bg-th-panel2 border-2 border-white/10 focus:border-th-accent outline-none rounded-lg px-3 py-2 text-th-ink placeholder-white/40'
const label = 'block text-xs font-black uppercase tracking-wide text-th-soft mb-1'
const hint = 'text-xs text-white/60 mt-1'

function useObjectUrl (file) {
	const [url, setUrl] = useState(null)
	useEffect(() => {
		if (!file) { setUrl(null); return }
		const u = URL.createObjectURL(file)
		setUrl(u)
		return () => URL.revokeObjectURL(u)
	}, [file])
	return url
}

function Thumb ({ file, className = '' }) {
	const url = useObjectUrl(file)
	// eslint-disable-next-line @next/next/no-img-element
	return url ? <img src={url} alt="" className={`object-cover ${className}`} /> : <div className={`grid place-items-center bg-black/30 text-white/40 text-xs ${className}`}>none</div>
}

const STEPS = ['Start', 'Movies', 'Questions', 'Check & Save']

function Stepper ({ step, setStep, canGo }) {
	return (
		<ol className="flex flex-wrap gap-2 mb-6">
			{STEPS.map((s, i) => {
				const on = i === step
				const ok = canGo(i)
				return (
					<li key={s}>
						<button
							type="button"
							disabled={!ok}
							onClick={() => setStep(i)}
							className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-sm border-2 transition-all ${on ? 'bg-th-primary text-th-onprimary border-white' : 'bg-black/30 text-th-ink border-white/20 hover:bg-white/10'} ${ok ? '' : 'opacity-40 cursor-not-allowed'}`}
						>
							<span className={`w-6 h-6 grid place-items-center rounded-full text-xs ${on ? 'bg-th-ink text-th-panel' : 'bg-white/20'}`}>{i + 1}</span>
							{s}
						</button>
					</li>
				)
			})}
		</ol>
	)
}

// ---------- step 1: start ----------
function StepStart ({ title, setTitle, theme, setTheme, draft, onResume, onOpen, onNew, busy }) {
	return (
		<div className="grid gap-5">
			<div className={card}>
				<h2 className="text-2xl font-black mb-1">Make a Scene It quiz</h2>
				<p className="text-white/70 mb-4">Students watch a short movie clip, answer questions, then see the poster revealed. You will add clips, write questions, and save one quiz file to open in the game.</p>
				<label className={label} htmlFor="quiz-title">Quiz name (optional)</label>
				<input id="quiz-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Halloween Movies, Grade 6" />
				<div className="mt-5">
					<span className={label}>Pick a look</span>
					<ThemePicker value={theme} onChange={setTheme} label="Quiz theme" />
					<p className={hint}>You can see the look change on this page. Students will see it in the game.</p>
				</div>
			</div>

			<div className="grid sm:grid-cols-3 gap-4">
				<button type="button" onClick={onNew} className={`${card} text-left hover:border-th-accent transition-colors`}>
					<div className="text-3xl mb-2">✨</div>
					<div className="font-black text-lg">Start a new quiz</div>
					<div className="text-sm text-white/60">Begin with your movie clips</div>
				</button>
				<label className={`${card} text-left hover:border-th-accent transition-colors cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
					<div className="text-3xl mb-2">📂</div>
					<div className="font-black text-lg">{busy ? 'Opening…' : 'Open a saved quiz'}</div>
					<div className="text-sm text-white/60">Choose a .zip you saved before</div>
					<input type="file" accept=".zip" className="hidden" onChange={onOpen} />
				</label>
				<button type="button" disabled={!draft} onClick={onResume} className={`${card} text-left transition-colors ${draft ? 'hover:border-th-accent' : 'opacity-40 cursor-not-allowed'}`}>
					<div className="text-3xl mb-2">↩️</div>
					<div className="font-black text-lg">Continue where I left off</div>
					<div className="text-sm text-white/60">
						{draft ? `${draft.title || 'Untitled quiz'} · ${draft.movies.length} movie${draft.movies.length === 1 ? '' : 's'} · saved ${new Date(draft.savedAt).toLocaleString()}` : 'No automatic draft yet'}
					</div>
				</button>
			</div>
		</div>
	)
}

// ---------- step 2: movies ----------
function MovieCard ({ m, i, count, problems, patch, remove, move }) {
	const posterInput = useRef(null)
	const coverInput = useRef(null)
	const videoInput = useRef(null)
	return (
		<div className={`${card} ${problems.length ? 'border-th-bad/60' : 'border-th-ok/50'}`}>
			<div className="flex gap-4 flex-col sm:flex-row">
				<div className="sm:w-48 shrink-0">
					<Thumb file={m.poster} className="w-full h-28 rounded-lg" />
					<div className="flex flex-col gap-1 mt-2 items-start">
						<button type="button" onClick={() => posterInput.current.click()} className="text-sm text-th-soft font-bold hover:underline">Change poster picture</button>
						<FramePicker video={m.video} label="🎞 Poster from a video frame" onPick={(f) => patch({ poster: f })} />
					</div>
					<input ref={posterInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && patch({ poster: e.target.files[0] })} />
				</div>

				<div className="flex-1 min-w-0 grid gap-3">
					<div className="flex items-center gap-2">
						<span className="w-8 h-8 grid place-items-center rounded-full bg-th-primary text-th-onprimary font-black shrink-0">{i + 1}</span>
						<input className={input} value={m.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Movie title, e.g. Frozen (アナと雪の女王)" aria-label="Movie title" />
					</div>
					<p className={hint}>Tip: put Japanese in (brackets) after a word to show it small above the English.</p>

					<div className="flex flex-wrap items-center gap-3 text-sm">
						<span className="font-bold">🎬 {m.video ? `${m.video.name} · ${formatBytes(m.video.size)}` : 'No video clip yet'}</span>
						<button type="button" onClick={() => videoInput.current.click()} className="text-th-soft font-bold hover:underline">{m.video ? 'Replace clip' : 'Add clip'}</button>
						<input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={async (e) => {
							const f = e.target.files[0]
							if (!f) return
							patch({ video: f })
							if (!m.poster) patch({ poster: await grabFrame(f) })
						}} />
					</div>

					<div className="flex flex-wrap items-center gap-3 text-sm">
						<span className="font-bold">Cover shown before the reveal:</span>
						<label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={m.coveredImageBlurred} onChange={() => patch({ coveredImageBlurred: true })} /> Blurred poster (easy)</label>
						<label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!m.coveredImageBlurred} onChange={() => patch({ coveredImageBlurred: false })} /> My own picture</label>
						{!m.coveredImageBlurred && (
							<>
								<button type="button" onClick={() => coverInput.current.click()} className="text-th-soft font-bold hover:underline">{m.coveredImage ? m.coveredImage.name : 'Choose picture'}</button>
								<input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && patch({ coveredImage: e.target.files[0] })} />
							</>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{problems.length === 0
							? <span className="px-3 py-1 rounded-full bg-th-ok text-th-onok text-xs font-black">✓ Ready · {m.questions.length} question{m.questions.length === 1 ? '' : 's'}</span>
							: problems.map((p, k) => <span key={k} className="px-3 py-1 rounded-full bg-th-bad/25 border border-th-bad text-xs font-bold">{p.text}</span>)}
						<span className="flex-1" />
						<button type="button" disabled={i === 0} onClick={() => move(-1)} className="px-2 py-1 rounded bg-black/30 disabled:opacity-30" aria-label="Move up">↑</button>
						<button type="button" disabled={i === count - 1} onClick={() => move(1)} className="px-2 py-1 rounded bg-black/30 disabled:opacity-30" aria-label="Move down">↓</button>
						<button type="button" onClick={() => window.confirm(`Delete "${m.title || 'this movie'}" and its questions?`) && remove()} className="px-3 py-1 rounded bg-th-bad/30 hover:bg-th-bad/60 text-sm font-bold">Delete</button>
					</div>
				</div>
			</div>
		</div>
	)
}

function StepMovies ({ movies, issues, addFiles, addBlank, patchMovie, removeMovie, moveMovie, preparing }) {
	const [over, setOver] = useState(false)
	const pick = useRef(null)
	const full = movies.length >= MAX_MOVIES
	return (
		<div className="grid gap-4">
			<div
				onDragOver={(e) => { e.preventDefault(); setOver(true) }}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}
				onClick={() => !full && pick.current.click()}
				className={`rounded-2xl border-4 border-dashed p-8 text-center cursor-pointer transition-colors ${over ? 'border-th-accent bg-th-accent/10' : 'border-white/30 hover:border-white/60'} ${full ? 'opacity-50 cursor-not-allowed' : ''}`}
			>
				<div className="text-4xl mb-2">🎬</div>
				<div className="text-xl font-black">{full ? `Maximum ${MAX_MOVIES} movies` : 'Drop your movie clips here'}</div>
				<div className="text-white/60 text-sm">{preparing ? 'Getting posters ready…' : 'or click to choose. Each clip becomes one movie. The title and poster are filled in for you.'}</div>
				<input ref={pick} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
			</div>

			{movies.map((m, i) => (
				<MovieCard
					key={m.id}
					m={m}
					i={i}
					count={movies.length}
					problems={issues.filter((x) => x.level === 'error' && x.movie === i && x.question === null && !x.text.startsWith('Needs at least one question'))}
					patch={(p) => patchMovie(i, p)}
					remove={() => removeMovie(i)}
					move={(d) => moveMovie(i, d)}
				/>
			))}
			{movies.length > 0 && !full && <div><Btn tone="soft" onClick={addBlank}>+ Add a movie without a clip</Btn></div>}
		</div>
	)
}

// ---------- step 3: questions ----------
function QuestionCard ({ q, j, movie, patch, remove, duplicate }) {
	const [showPic, setShowPic] = useState(!!q.image)
	const picInput = useRef(null)
	const setAnswer = (k, v) => patch({ answers: q.answers.map((a, n) => (n === k ? v : a)) })
	return (
		<div className={card}>
			<div className="flex items-center gap-2 mb-3">
				<span className="px-3 py-1 rounded-full bg-th-accent text-th-onaccent font-black text-sm">Question {j + 1}</span>
				<span className="flex-1" />
				<button type="button" onClick={duplicate} className="text-sm text-th-soft font-bold hover:underline">Duplicate</button>
				<button type="button" onClick={() => window.confirm('Delete this question?') && remove()} className="text-sm text-th-badl font-bold hover:underline">Delete</button>
			</div>

			<label className={label}>Question</label>
			<input className={input} value={q.question} onChange={(e) => patch({ question: e.target.value })} placeholder="e.g. What colour is Elsa's dress?" />

			<div className="flex items-baseline justify-between mt-4">
				<label className={label}>Answers</label>
				<span className="text-xs text-white/60">Click the circle next to the correct one</span>
			</div>
			<div className="grid sm:grid-cols-2 gap-2">
				{q.answers.map((a, k) => {
					const right = q.correct === k
					return (
						<label key={k} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 cursor-pointer transition-colors ${right ? 'border-th-okl bg-th-ok/25' : 'border-white/10 bg-th-panel2'}`}>
							<input type="radio" name={`correct-${q.id}`} checked={right} onChange={() => patch({ correct: k })} className="w-5 h-5 shrink-0" aria-label={`Answer ${k + 1} is correct`} />
							<input
								className="flex-1 min-w-0 bg-transparent outline-none py-1 text-th-ink placeholder-white/40"
								value={a}
								onChange={(e) => setAnswer(k, e.target.value)}
								placeholder={`Answer ${'ABCD'[k]}`}
								aria-label={`Answer ${'ABCD'[k]}`}
							/>
							{right && <span className="text-xs font-black text-th-okl shrink-0">✓ CORRECT</span>}
						</label>
					)
				})}
			</div>

			<div className="mt-4">
				{!showPic
					? <button type="button" onClick={() => setShowPic(true)} className="text-th-soft font-bold hover:underline text-sm">＋ Add a picture clue (optional)</button>
					: (
						<div className="rounded-xl bg-black/20 p-3">
							<div className="flex flex-wrap items-center gap-3">
								<span className={label + ' mb-0'}>Picture clue</span>
								{q.image && <Thumb file={q.image} className="w-16 h-10 rounded" />}
								<button type="button" onClick={() => picInput.current.click()} className="text-sm text-th-soft font-bold hover:underline">{q.image ? 'Replace picture' : 'Upload a picture'}</button>
								<input ref={picInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && patch({ image: e.target.files[0] })} />
								<FramePicker video={movie.video} onPick={(f) => patch({ image: f })} />
								<span className="flex-1" />
								<button type="button" onClick={() => { patch({ image: null, coverShape: null }); setShowPic(false) }} className="text-sm text-th-badl font-bold hover:underline">Remove</button>
							</div>
							{q.image && (
								<div className="mt-3">
									<div className="flex items-center gap-3 mb-2">
										<span className={label + ' mb-0'}>Hide part of the picture</span>
										{q.coverShape
											? <button type="button" onClick={() => patch({ coverShape: null })} className="text-sm text-th-badl font-bold hover:underline">Remove cover</button>
											: <button type="button" onClick={() => patch({ coverShape: { x: 20, y: 20, width: 40, height: 30 } })} className="text-sm text-th-accent font-bold hover:underline">+ Add a cover</button>}
									</div>
									{q.coverShape && <p className={hint}>Drag the box to move it. Drag its edges or corners to resize.</p>}
									<CoverShapeEditor imageFile={q.image} coverShape={q.coverShape} onChange={(s) => patch({ coverShape: s })} />
								</div>
							)}
						</div>
					)}
			</div>
		</div>
	)
}

function StepQuestions ({ movies, active, setActive, issues, addQuestion, patchQuestion, removeQuestion, duplicateQuestion }) {
	const m = movies[active]
	if (!m) return <div className={card}>Add a movie first.</div>
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap gap-2">
				{movies.map((mv, i) => {
					const bad = issues.some((x) => x.level === 'error' && x.movie === i && x.question !== null)
					return (
						<button
							key={mv.id}
							type="button"
							onClick={() => setActive(i)}
							className={`px-4 py-2 rounded-full font-black text-sm border-2 ${i === active ? 'bg-th-primary text-th-onprimary border-white' : 'bg-black/30 border-white/20 hover:bg-white/10'}`}
						>
							{i + 1}. {mv.title || 'Untitled'} <span className="opacity-70">({mv.questions.length})</span>{bad ? ' ⚠️' : ''}
						</button>
					)
				})}
			</div>
			{m.questions.length === 0 && <div className={`${card} text-center text-white/70`}>No questions for this movie yet. Add the first one below.</div>}
			{m.questions.map((q, j) => (
				<QuestionCard
					key={q.id}
					q={q}
					j={j}
					movie={m}
					patch={(p) => patchQuestion(active, j, p)}
					remove={() => removeQuestion(active, j)}
					duplicate={() => duplicateQuestion(active, j)}
				/>
			))}
			<div><Btn tone="ok" onClick={() => addQuestion(active)}>+ Add a question</Btn></div>
		</div>
	)
}

// ---------- step 4: check & save ----------
function StepSave ({ movies, issues, compress, setCompress, onSave, saving, progress, savedName, goFix }) {
	const errors = issues.filter((x) => x.level === 'error')
	const warns = issues.filter((x) => x.level === 'warn')
	const bytes = movies.reduce((n, m) => n + (m.video ? m.video.size : 0) + (m.poster ? m.poster.size : 0), 0)
	const qCount = movies.reduce((n, m) => n + m.questions.length, 0)
	const where = (x) => (x.movie === null ? 'Quiz' : `Movie ${x.movie + 1}${movies[x.movie] && movies[x.movie].title ? ` (${movies[x.movie].title})` : ''}${x.question !== null ? `, question ${x.question + 1}` : ''}`)
	return (
		<div className="grid gap-4">
			<div className={card}>
				<h2 className="text-2xl font-black mb-1">{errors.length ? `${errors.length} thing${errors.length === 1 ? '' : 's'} to fix` : '✅ Your quiz is ready to save'}</h2>
				<p className="text-white/70">{movies.length} movie{movies.length === 1 ? '' : 's'} · {qCount} question{qCount === 1 ? '' : 's'} · clips total {formatBytes(bytes)}</p>

				{[...errors, ...warns].length > 0 && (
					<ul className="mt-4 grid gap-2">
						{errors.map((x, k) => (
							<li key={`e${k}`} className="flex items-center gap-3 bg-th-bad/20 border-l-4 border-th-bad rounded p-3 text-sm">
								<span className="flex-1"><b>{where(x)}:</b> {x.text}</span>
								<button type="button" className="font-black underline shrink-0" onClick={() => goFix(x)}>Fix</button>
							</li>
						))}
						{warns.map((x, k) => (
							<li key={`w${k}`} className="flex items-center gap-3 bg-th-accent/15 border-l-4 border-th-accent rounded p-3 text-sm">
								<span className="flex-1"><b>{where(x)}:</b> {x.text}</span>
								<button type="button" className="font-black underline shrink-0" onClick={() => goFix(x)}>Look</button>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className={card}>
				<label className="flex items-start gap-3 cursor-pointer">
					<input type="checkbox" className="w-5 h-5 mt-1" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
					<span>
						<b>Make the video files smaller</b>
						<span className="block text-sm text-white/60">Recommended. Keeps full quality on a TV, but the quiz loads much faster on school Wi-Fi. Takes a little while when saving.</span>
					</span>
				</label>
				<div className="mt-5 flex flex-wrap items-center gap-4">
					<Btn tone="ok" disabled={errors.length > 0 || saving} onClick={onSave} className="text-lg px-8 py-3">{saving ? '⏳ Saving…' : '⬇ Save quiz file'}</Btn>
					{saving && <span className="font-bold">{progress}</span>}
					{savedName && !saving && <span className="font-bold text-th-okl">✓ Saved {savedName}. Open it from the game screen.</span>}
				</div>
				{savedName && !saving && <p className="mt-3"><Link href="/play/scene-it" className="text-th-soft font-black underline">Open the game →</Link></p>}
			</div>
		</div>
	)
}

// ---------- the maker ----------
export default function QuizMaker () {
	const theme = useTheme((s) => s.theme)
	const setTheme = useTheme((s) => s.setTheme)
	const [step, setStep] = useState(0)
	const [title, setTitle] = useState('')
	const [movies, setMovies] = useState([])
	const [active, setActive] = useState(0)
	const [draft, setDraft] = useState(null)
	const [opening, setOpening] = useState(false)
	const [preparing, setPreparing] = useState(false)
	const [compress, setCompress] = useState(true)
	const [saving, setSaving] = useState(false)
	const [progress, setProgress] = useState('')
	const [savedName, setSavedName] = useState('')
	const [draftSavedAt, setDraftSavedAt] = useState(null)
	const dirty = useRef(false)

	const issues = validate(movies)

	useEffect(() => { loadDraft().then((d) => d && d.movies && setDraft(d)) }, [])

	// Autosave a few seconds after the last change.
	useEffect(() => {
		if (!dirty.current) return
		const t = setTimeout(async () => {
			await saveDraft({ title, theme, movies })
			setDraftSavedAt(Date.now())
		}, 1500)
		return () => clearTimeout(t)
	}, [title, theme, movies])

	const touch = useCallback((fn) => { dirty.current = true; setSavedName(''); fn() }, [])
	const patchMovie = (i, p) => touch(() => setMovies((ms) => ms.map((m, n) => (n === i ? { ...m, ...p } : m))))
	const patchQuestion = (i, j, p) => touch(() => setMovies((ms) => ms.map((m, n) => (n === i ? { ...m, questions: m.questions.map((q, k) => (k === j ? { ...q, ...p } : q)) } : m))))

	const addFiles = async (fileList) => {
		const vids = [...fileList].filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name)).slice(0, MAX_MOVIES - movies.length)
		if (!vids.length) return
		const made = vids.map((f) => newMovie({ video: f, title: titleFromFilename(f.name), questions: [newQuestion()] }))
		touch(() => setMovies((ms) => [...ms, ...made]))
		setPreparing(true)
		for (const m of made) {
			const poster = await grabFrame(m.video)
			setMovies((ms) => ms.map((x) => (x.id === m.id ? { ...x, poster } : x)))
		}
		setPreparing(false)
	}

	const openZip = async (e) => {
		const file = e.target.files[0]
		if (!file) return
		setOpening(true)
		try {
			const q = await loadQuizForEditing(file)
			dirty.current = true
			setMovies(q.movies)
			setTitle(q.title)
			if (isTheme(q.theme)) setTheme(q.theme)
			setActive(0)
			setStep(1)
		} catch (err) {
			window.alert(err.message || 'Could not open that file.')
		}
		setOpening(false)
	}

	const resume = () => {
		dirty.current = true
		setMovies(draft.movies)
		setTitle(draft.title || '')
		if (isTheme(draft.theme)) setTheme(draft.theme)
		setStep(1)
	}

	const save = async () => {
		setSaving(true)
		try {
			const blob = await buildQuizZip({ title, theme, movies, compress, onProgress: (t, p) => setProgress(`${t} ${Math.round(p * 100)}%`) })
			const slug = (title || 'scene-it-quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene-it-quiz'
			const a = document.createElement('a')
			a.href = URL.createObjectURL(blob)
			a.download = `${slug}.zip`
			a.click()
			setTimeout(() => URL.revokeObjectURL(a.href), 10000)
			setSavedName(`${slug}.zip (${formatBytes(blob.size)})`)
		} catch (err) {
			console.error(err)
			window.alert('Sorry, saving failed. Try again with "Make the video files smaller" turned off.')
		}
		setSaving(false)
	}

	const goFix = (x) => {
		if (x.movie === null) return setStep(1)
		if (x.question === null) return setStep(1)
		setActive(x.movie)
		setStep(2)
	}

	const canGo = (i) => i < 2 || movies.length > 0

	return (
		<div className="max-w-5xl mx-auto px-4 py-6 text-th-ink">
			<div className="flex flex-wrap items-center gap-3 mb-4">
				<h1 className="text-3xl font-black flex-1">Quiz Maker</h1>
				{draftSavedAt && <span className="text-xs text-white/60">Draft saved ✓</span>}
				<Link href="/" className="px-4 py-2 rounded-lg bg-black/30 hover:bg-white/10 text-sm font-bold">← Home</Link>
			</div>
			<Stepper step={step} setStep={setStep} canGo={canGo} />

			{step === 0 && <StepStart title={title} setTitle={(v) => touch(() => setTitle(v))} theme={theme} setTheme={(id) => touch(() => setTheme(id))} draft={draft} onResume={resume} onOpen={openZip} onNew={() => setStep(1)} busy={opening} />}
			{step === 1 && (
				<StepMovies
					movies={movies}
					issues={issues}
					addFiles={addFiles}
					addBlank={() => touch(() => setMovies((ms) => [...ms, newMovie({ questions: [newQuestion()] })]))}
					patchMovie={patchMovie}
					removeMovie={(i) => touch(() => { setMovies((ms) => ms.filter((_, n) => n !== i)); setActive(0) })}
					moveMovie={(i, d) => touch(() => setMovies((ms) => { const c = [...ms]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c }))}
					preparing={preparing}
				/>
			)}
			{step === 2 && (
				<StepQuestions
					movies={movies}
					active={Math.min(active, movies.length - 1)}
					setActive={setActive}
					issues={issues}
					addQuestion={(i) => touch(() => setMovies((ms) => ms.map((m, n) => (n === i ? { ...m, questions: [...m.questions, newQuestion()] } : m))))}
					patchQuestion={patchQuestion}
					removeQuestion={(i, j) => touch(() => setMovies((ms) => ms.map((m, n) => (n === i ? { ...m, questions: m.questions.filter((_, k) => k !== j) } : m))))}
					duplicateQuestion={(i, j) => touch(() => setMovies((ms) => ms.map((m, n) => (n === i ? { ...m, questions: m.questions.flatMap((q, k) => (k === j ? [q, { ...q, id: newQuestion().id, answers: [...q.answers] }] : [q])) } : m))))}
				/>
			)}
			{step === 3 && <StepSave movies={movies} issues={issues} compress={compress} setCompress={setCompress} onSave={save} saving={saving} progress={progress} savedName={savedName} goFix={goFix} />}

			<div className="flex justify-between mt-8">
				<Btn tone="soft" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</Btn>
				{step < 3 && <Btn tone="primary" disabled={!canGo(step + 1)} onClick={() => setStep(step + 1)}>Next →</Btn>}
			</div>
			<div className="mt-6 text-center">
				<Btn tone="soft" className="text-xs" onClick={() => window.confirm('Clear the automatic draft saved in this browser?') && clearDraft().then(() => setDraft(null))}>Clear saved draft</Btn>
			</div>
		</div>
	)
}
