import { useState, useRef, useEffect, useCallback } from 'react'
import JSZip from 'jszip'

// ---------- CoverShapeEditor ----------
// Lets the author drag/resize a colored rectangle over the question image.
// Positions are stored as percentages so they stay correct at any display size.
function CoverShapeEditor ({ imageFile, coverShape, onChange }) {
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
						background: 'linear-gradient(135deg, #1c233a 0%, #2d3a5e 100%)',
						border: '2px solid #685af5',
						boxShadow: '0 0 12px #685af588'
					}}
					onMouseDown={(e) => onMouseDown(e, 'move')}
				>
					<div className="flex flex-col items-center pointer-events-none select-none gap-0.5">
						<span className="text-purple-300 font-black" style={{ fontSize: 'clamp(10px,4cqw,2rem)' }}>?</span>
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
// ---------- end CoverShapeEditor ----------

// ---------- loadQuizZipForEditing ----------
async function loadQuizZipForEditing (file) {
	const zip = await JSZip.loadAsync(file)
	const jsonFile = zip.file('quiz.json')
	if (!jsonFile) throw new Error('Invalid quiz file: missing quiz.json')
	const quizData = JSON.parse(await jsonFile.async('string'))

	async function extractAsFile (path) {
		if (!path) return null
		let entry = zip.file(path)
		if (!entry) {
			const basename = path.split('/').pop()
			const key = Object.keys(zip.files).find(k => k.endsWith(basename))
			if (!key) return null
			entry = zip.file(key)
		}
		if (!entry) return null
		const blob = await entry.async('blob')
		const filename = path.split('/').pop()
		return new File([blob], filename)
	}

	const movies = []
	for (let i = 0; i < quizData.movies.length; i++) {
		const m = quizData.movies[i]
		const questions = []
		for (let j = 0; j < (m.questions || []).length; j++) {
			const q = m.questions[j]
			questions.push({
				id: q.id || Date.now() + i * 1000 + j,
				question: q.question || '',
				answers: q.answers || ['', '', '', ''],
				correctAnswer: q.correctAnswer || '',
				image: await extractAsFile(q.image),
				coverShape: q.coverShape || null
			})
		}
		movies.push({
			id: m.id || Date.now() + i,
			title: m.title || '',
			poster: await extractAsFile(m.poster),
			video: await extractAsFile(m.video),
			coveredImage: await extractAsFile(m.coveredImage),
			coveredImageBlurred: m.coveredImageBlurred || false,
			questions
		})
	}
	return movies
}
// ---------- end loadQuizZipForEditing ----------

// Validation helper to check for issues in the quiz data
function validateQuizData (movies) {
	const errors = []
	const warnings = []

	if (movies.length === 0) {
		errors.push('⚠️ No movies added. Add at least one movie to create a quiz.')
		return { errors, warnings, isValid: false }
	}

	movies.forEach((movie, mIdx) => {
		const movieLabel = `Movie ${mIdx + 1}${movie.title ? ` (${movie.title})` : ''}`

		// Check movie title
		if (!movie.title || !movie.title.trim()) {
			errors.push(`${movieLabel}: Missing title`)
		} else {
			// Check for unmatched parentheses in title
			const titleParens = (movie.title.match(/\(/g) || []).length
			const titleClosing = (movie.title.match(/\)/g) || []).length
			if (titleParens !== titleClosing) {
				warnings.push(`${movieLabel}: Unmatched parentheses in title (may break furigana rendering)`)
			}
		}

		// Check required files
		if (!movie.poster) {
			errors.push(`${movieLabel}: Missing revealed poster image`)
		}
		if (!movie.video) {
			errors.push(`${movieLabel}: Missing video clip`)
		}
		if (!movie.coveredImageBlurred && !movie.coveredImage) {
			errors.push(`${movieLabel}: Missing covered image (or enable "Use blurred poster instead")`)
		}

		// Check questions
		if (!movie.questions || movie.questions.length === 0) {
			errors.push(`${movieLabel}: No questions added`)
		} else {
			movie.questions.forEach((q, qIdx) => {
				const qLabel = `${movieLabel} → Question ${qIdx + 1}`

				// Check question text
				if (!q.question || !q.question.trim()) {
					errors.push(`${qLabel}: Missing question text`)
				} else {
					// Check for unmatched parentheses in question
					const qParens = (q.question.match(/\(/g) || []).length
					const qClosing = (q.question.match(/\)/g) || []).length
					if (qParens !== qClosing) {
						warnings.push(`${qLabel}: Unmatched parentheses in question (may break furigana rendering)`)
					}
				}

				// Check answers
				const validAnswers = q.answers.filter(a => a && a.trim())
				if (validAnswers.length < 2) {
					errors.push(`${qLabel}: Need at least 2 answer options`)
				}
				if (validAnswers.length < 4) {
					warnings.push(`${qLabel}: Only ${validAnswers.length} answers (typically 4 are used)`)
				}

				// Check for unmatched parentheses in answers
				q.answers.forEach((ans, aIdx) => {
					if (ans && ans.trim()) {
						const ansParens = (ans.match(/\(/g) || []).length
						const ansClosing = (ans.match(/\)/g) || []).length
						if (ansParens !== ansClosing) {
							warnings.push(`${qLabel} → Option ${aIdx + 1}: Unmatched parentheses (may break furigana rendering)`)
						}
					}
				})

				// Check correctAnswer
				if (!q.correctAnswer || !q.correctAnswer.trim()) {
					errors.push(`${qLabel}: No correct answer selected`)
				} else {
					const trimmedCorrect = q.correctAnswer.trim()
					const hasMatch = q.answers.some(a => a && a.trim() === trimmedCorrect)
					if (!hasMatch) {
						errors.push(`${qLabel}: Selected correct answer doesn't match any option`)
					}
				}
			})
		}
	})

	return { errors, warnings, isValid: errors.length === 0 }
}

function ValidationModal ({ errors, warnings, onClose, onProceed }) {
	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
			<div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
				<div className="p-6 border-b border-gray-700">
					<h2 className="text-2xl font-bold text-white">
						{errors.length > 0 ? '⚠️ Validation Issues Found' : '✓ Validation Passed'}
					</h2>
				</div>

				<div className="p-6 overflow-y-auto flex-1">
					{errors.length > 0 && (
						<div className="mb-6">
							<h3 className="text-lg font-bold text-red-400 mb-3">
                🚫 Errors ({errors.length}) - Must be fixed:
							</h3>
							<ul className="space-y-2">
								{errors.map((err, idx) => (
									<li key={idx} className="text-sm text-red-200 bg-red-900/30 p-3 rounded border-l-4 border-red-500">
										{err}
									</li>
								))}
							</ul>
						</div>
					)}

					{warnings.length > 0 && (
						<div>
							<h3 className="text-lg font-bold text-yellow-400 mb-3">
                ⚠️ Warnings ({warnings.length}) - Should review:
							</h3>
							<ul className="space-y-2">
								{warnings.map((warn, idx) => (
									<li key={idx} className="text-sm text-yellow-200 bg-yellow-900/30 p-3 rounded border-l-4 border-yellow-500">
										{warn}
									</li>
								))}
							</ul>
						</div>
					)}

					{errors.length === 0 && warnings.length === 0 && (
						<div className="text-center py-8">
							<div className="text-6xl mb-4">✅</div>
							<p className="text-xl text-green-400 font-bold">All checks passed!</p>
							<p className="text-gray-400 mt-2">Your quiz is ready to export.</p>
						</div>
					)}
				</div>

				<div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
					<button
						onClick={onClose}
						className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold transition-colors"
					>
						{errors.length > 0 ? 'Fix Issues' : 'Cancel'}
					</button>
					{errors.length === 0 && onProceed && (
						<button
							onClick={onProceed}
							className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded font-bold transition-colors"
						>
							{warnings.length > 0 ? 'Proceed Anyway' : 'Continue'}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

export default function SceneItEditor () {
	const [movies, setMovies] = useState([])
	const [currentMovieIndex, setCurrentMovieIndex] = useState(null)
	const [isGenerating, setIsGenerating] = useState(false)
	const [isImporting, setIsImporting] = useState(false)
	const [validationModal, setValidationModal] = useState(null)

	const addMovie = () => {
		const newMovie = {
			id: Date.now(),
			title: '',
			poster: null,
			video: null,
			coveredImage: null,
			coveredImageBlurred: false,
			questions: []
		}
		setMovies(prev => [...prev, newMovie])
		setCurrentMovieIndex(movies.length)
	}

	const updateMovie = (index, field, value) => {
		setMovies(prev => {
			const newMovies = [...prev]
			newMovies[index] = { ...newMovies[index], [field]: value }
			return newMovies
		})
	}

	const addQuestion = (movieIndex) => {
		setMovies(prev => {
			const newMovies = [...prev]
			const targetMovie = { ...newMovies[movieIndex] }
			targetMovie.questions = [
				...targetMovie.questions,
				{
					id: Date.now(),
					question: '',
					answers: ['', '', '', ''],
					correctAnswer: '',
					image: null,
					coverShape: null // { x, y, width, height } all as % of image container
				}
			]
			newMovies[movieIndex] = targetMovie
			return newMovies
		})
	}

	const updateQuestion = (movieIndex, questionIndex, field, value) => {
		setMovies(prev => {
			const newMovies = [...prev]
			const targetMovie = { ...newMovies[movieIndex] }
			const targetQuestions = [...targetMovie.questions]
			targetQuestions[questionIndex] = { ...targetQuestions[questionIndex], [field]: value }
			targetMovie.questions = targetQuestions
			newMovies[movieIndex] = targetMovie
			return newMovies
		})
	}

	const deleteQuestion = (movieIndex, questionIndex) => {
		setMovies(prev => {
			const newMovies = [...prev]
			const targetMovie = { ...newMovies[movieIndex] }
			targetMovie.questions = targetMovie.questions.filter((_, i) => i !== questionIndex)
			newMovies[movieIndex] = targetMovie
			return newMovies
		})
	}

	const deleteMovie = (movieIndex) => {
		const newLen = movies.length - 1
		setMovies(prev => prev.filter((_, i) => i !== movieIndex))
		if (currentMovieIndex === movieIndex) {
			setCurrentMovieIndex(newLen === 0 ? null : Math.max(0, movieIndex - 1))
		} else if (currentMovieIndex > movieIndex) {
			setCurrentMovieIndex(currentMovieIndex - 1)
		}
	}

	const updateAnswer = (movieIndex, questionIndex, answerIndex, value) => {
		setMovies(prev => {
			const newMovies = [...prev]
			const targetMovie = { ...newMovies[movieIndex] }
			const targetQuestions = [...targetMovie.questions]
			const targetQuestion = { ...targetQuestions[questionIndex] }
			const newAnswers = [...targetQuestion.answers]
			const oldAnswer = newAnswers[answerIndex]
			newAnswers[answerIndex] = value
			targetQuestion.answers = newAnswers

			// Only reset correctAnswer if the answer that WAS correct is being changed
			// This prevents accidental clearing when editing other answers
			if (targetQuestion.correctAnswer === oldAnswer) {
				targetQuestion.correctAnswer = '' // Clear because the correct answer text changed
			}

			targetQuestions[questionIndex] = targetQuestion
			targetMovie.questions = targetQuestions
			newMovies[movieIndex] = targetMovie
			return newMovies
		})
	}

	const handleFileChange = (e, index, field) => {
		const file = e.target.files[0]
		if (file) {
			updateMovie(index, field, file)
		}
	}

	const handleImportZip = async (e) => {
		const file = e.target.files[0]
		if (!file) return
		setIsImporting(true)
		try {
			const imported = await loadQuizZipForEditing(file)

			// Validate imported data
			const validation = validateQuizData(imported)

			// Always load the data, but show validation results
			setMovies(imported)
			setCurrentMovieIndex(imported.length > 0 ? 0 : null)

			// Show validation modal if there are any issues
			if (!validation.isValid || validation.warnings.length > 0) {
				setValidationModal({
					errors: validation.errors,
					warnings: validation.warnings,
					onProceed: null, // No proceed button, just informational
					onClose: () => setValidationModal(null)
				})
			}
		} catch (err) {
			console.error(err)
			alert('Failed to import quiz: ' + err.message)
		} finally {
			setIsImporting(false)
			e.target.value = ''
		}
	}

	const handleQuestionImageChange = (e, movieIndex, questionIndex) => {
		const file = e.target.files[0]
		if (file) {
			updateQuestion(movieIndex, questionIndex, 'image', file)
		}
	}

	const generateQuizPack = async () => {
		// First validate the data
		const validation = validateQuizData(movies)

		if (!validation.isValid || validation.warnings.length > 0) {
			setValidationModal({
				errors: validation.errors,
				warnings: validation.warnings,
				onProceed: validation.isValid ? doGenerateQuizPack : null,
				onClose: () => setValidationModal(null)
			})
			return
		}

		// If validation passed with no warnings, proceed directly
		await doGenerateQuizPack()
	}

	const doGenerateQuizPack = async () => {
		setValidationModal(null)
		setIsGenerating(true)
		try {
			const zip = new JSZip()
			const assetsFolder = zip.folder('assets')

			// Prepare the JSON structure
			const quizData = {
				type: 'scene-it',
				created: new Date().toISOString(),
				movies: []
			}

			// Process each movie
			for (let i = 0; i < movies.length; i++) {
				const m = movies[i]
				const movieEntry = {
					id: m.id,
					title: m.title,
					questions: []
				}

				// Add files to zip and reference them in JSON
				if (m.poster) {
					const ext = m.poster.name.split('.').pop()
					const filename = `movie_${i}_poster.${ext}`
					assetsFolder.file(filename, m.poster)
					movieEntry.poster = `assets/${filename}`
				}

				if (m.video) {
					const ext = m.video.name.split('.').pop()
					const filename = `movie_${i}_video.${ext}`
					assetsFolder.file(filename, m.video)
					movieEntry.video = `assets/${filename}`
				}

				if (m.coveredImageBlurred) {
					// blurred poster mode — no separate file needed
					movieEntry.coveredImageBlurred = true
				} else if (m.coveredImage) {
					const ext = m.coveredImage.name.split('.').pop()
					const filename = `movie_${i}_covered.${ext}`
					assetsFolder.file(filename, m.coveredImage)
					movieEntry.coveredImage = `assets/${filename}`
				}

				// Process questions
				for (let j = 0; j < m.questions.length; j++) {
					const q = m.questions[j]
					const questionEntry = {
						id: q.id,
						question: q.question,
						answers: q.answers,
						correctAnswer: q.correctAnswer
					}

					if (q.image) {
						const ext = q.image.name.split('.').pop()
						const filename = `movie_${i}_q_${j}.${ext}`
						assetsFolder.file(filename, q.image)
						questionEntry.image = `assets/${filename}`
					}
					if (q.coverShape) {
						questionEntry.coverShape = q.coverShape
					}
					movieEntry.questions.push(questionEntry)
				}

				quizData.movies.push(movieEntry)
			}

			zip.file('quiz.json', JSON.stringify(quizData, null, 2))

			const content = await zip.generateAsync({ type: 'blob' })
			const url = URL.createObjectURL(content)
			const a = document.createElement('a')
			a.href = url
			a.download = 'scene-it-quiz.zip'
			a.click()
		} catch (err) {
			console.error('Failed to zip', err)
			alert('Error creating zip file')
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<div className="text-white min-h-screen bg-gray-900 p-6">
			{validationModal && <ValidationModal {...validationModal} />}

			<div className="max-w-[1800px] mx-auto">
				<div className="mb-6">
					<h1 className="text-4xl font-bold mb-2">Scene It - Quiz Editor</h1>
					<p className="text-gray-400">Create and edit movie quiz packs with questions, images, and video clips</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 h-[calc(100vh-180px)]">
					{/* Movie List Sidebar */}
					<div className="bg-gray-800 rounded-lg shadow-xl flex flex-col overflow-hidden">
						<div className="p-4 border-b border-gray-700 flex-shrink-0">
							<h2 className="text-lg font-bold text-white">Movies ({movies.length}/10)</h2>
							<p className="text-xs text-gray-400 mt-1">Select a movie to edit</p>
						</div>

						<div className="flex-1 overflow-y-auto p-3 space-y-2">
							{movies.map((m, idx) => {
								const hasIssues = !m.title?.trim() || !m.poster || !m.video ||
                                  (!m.coveredImageBlurred && !m.coveredImage) ||
                                  m.questions.length === 0 ||
                                  m.questions.some(q => !q.correctAnswer?.trim() || !q.question?.trim())

								return (
									<div
										key={m.id}
										onClick={() => setCurrentMovieIndex(idx)}
										className={`relative p-3 rounded-lg cursor-pointer group transition-all ${
											currentMovieIndex === idx
												? 'bg-blue-600 shadow-lg ring-2 ring-blue-400'
												: 'bg-gray-750 hover:bg-gray-700'
										}`}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												<div className="font-bold truncate">{m.title || `Untitled Movie ${idx + 1}`}</div>
												<div className="text-xs text-gray-300 mt-1">
													{m.questions.length} question{m.questions.length !== 1 ? 's' : ''}
												</div>
												{hasIssues && (
													<div className="text-xs text-yellow-400 mt-1">⚠️ Has issues</div>
												)}
											</div>
											<button
												onClick={(e) => {
													e.stopPropagation()
													if (window.confirm(`Delete "${m.title || `Movie ${idx + 1}`}"?`)) deleteMovie(idx)
												}}
												className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-200 text-sm px-2 py-1 rounded bg-black/40 hover:bg-red-700/60 transition-all flex-shrink-0"
												title="Delete movie"
											>
                        🗑
											</button>
										</div>
									</div>
								)
							})}

							{movies.length < 10 && (
								<button
									onClick={addMovie}
									className="w-full py-3 border-2 border-dashed border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400 rounded-lg transition-all font-medium"
								>
                  + Add Movie
								</button>
							)}

							{movies.length === 0 && (
								<div className="text-center py-12 text-gray-500">
									<div className="text-4xl mb-3">🎬</div>
									<p className="text-sm">No movies yet</p>
									<p className="text-xs mt-1">Click &quot;Add Movie&quot; to start</p>
								</div>
							)}
						</div>

						<div className="p-4 border-t border-gray-700 space-y-2 flex-shrink-0">
							<label className={`block w-full text-center py-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${
								isImporting
									? 'bg-gray-600 opacity-50 pointer-events-none'
									: 'bg-indigo-600 hover:bg-indigo-500 shadow-lg hover:shadow-indigo-500/50'
							}`}>
								{isImporting ? '⏳ Importing...' : '📂 Open ZIP to Edit'}
								<input type="file" accept=".zip" className="hidden" onChange={handleImportZip} disabled={isImporting} />
							</label>
							<button
								onClick={generateQuizPack}
								disabled={isGenerating || movies.length === 0}
								className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-green-500/50 disabled:shadow-none"
							>
								{isGenerating ? '⏳ Packaging...' : '⬇ Download Quiz Pack'}
							</button>
						</div>
					</div>

					{/* Editor Area */}
					<div className="bg-gray-800 rounded-lg shadow-xl overflow-y-auto">
						{currentMovieIndex !== null && movies[currentMovieIndex]
							? (
							<div className="p-6 space-y-6">
								{/* Movie Title */}
								<div className="bg-gray-750 p-5 rounded-lg">
									<label className="block text-sm font-semibold text-gray-300 mb-2">Movie Title *</label>
									<input
										type="text"
										value={movies[currentMovieIndex].title}
										onChange={(e) => updateMovie(currentMovieIndex, 'title', e.target.value)}
										className={`w-full p-3 bg-gray-700 rounded-lg text-white border-2 transition-colors ${
											!movies[currentMovieIndex].title?.trim() ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
										} focus:outline-none`}
										placeholder="e.g. Jurassic Park"
									/>
									{!movies[currentMovieIndex].title?.trim() && (
										<p className="text-xs text-red-400 mt-1">⚠️ Title is required</p>
									)}
								</div>

								{/* Media Files */}
								<div className="bg-gray-750 p-5 rounded-lg">
									<h3 className="text-lg font-bold mb-4">Media Files</h3>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div className={`bg-gray-700 p-4 rounded-lg border-2 transition-colors ${
											!movies[currentMovieIndex].poster ? 'border-red-500/50' : 'border-gray-600'
										}`}>
											<label className="block text-sm font-semibold text-gray-300 mb-2">
                        Revealed Poster * {!movies[currentMovieIndex].poster && <span className="text-red-400">⚠️</span>}
											</label>
											<input
												type="file"
												accept="image/*"
												onChange={(e) => handleFileChange(e, currentMovieIndex, 'poster')}
												className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
											/>
											{movies[currentMovieIndex].poster && (
												<p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                          ✓ {movies[currentMovieIndex].poster.name}
												</p>
											)}
										</div>

										<div className={`bg-gray-700 p-4 rounded-lg border-2 transition-colors ${
											!movies[currentMovieIndex].coveredImageBlurred && !movies[currentMovieIndex].coveredImage ? 'border-red-500/50' : 'border-gray-600'
										}`}>
											<label className="block text-sm font-semibold text-gray-300 mb-2">
                        Covered Image * {!movies[currentMovieIndex].coveredImageBlurred && !movies[currentMovieIndex].coveredImage && <span className="text-red-400">⚠️</span>}
											</label>
											{movies[currentMovieIndex].coveredImageBlurred
												? (
													<div className="mt-1">
														<p className="text-xs text-blue-400 bg-blue-900/30 p-2 rounded">
                            🎨 Using blurred poster
														</p>
													</div>
												)
												: (
													<>
														<input
															type="file"
															accept="image/*"
															onChange={(e) => handleFileChange(e, currentMovieIndex, 'coveredImage')}
															className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
														/>
														{movies[currentMovieIndex].coveredImage && (
															<p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                              ✓ {movies[currentMovieIndex].coveredImage.name}
															</p>
														)}
													</>
												)}
											<label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
												<input
													type="checkbox"
													checked={!!movies[currentMovieIndex].coveredImageBlurred}
													onChange={(e) => updateMovie(currentMovieIndex, 'coveredImageBlurred', e.target.checked)}
													className="w-4 h-4 accent-blue-500"
												/>
												<span className="text-xs text-gray-300">Use blurred poster</span>
											</label>
										</div>

										<div className={`bg-gray-700 p-4 rounded-lg border-2 transition-colors ${
											!movies[currentMovieIndex].video ? 'border-red-500/50' : 'border-gray-600'
										}`}>
											<label className="block text-sm font-semibold text-gray-300 mb-2">
                        Video Clip * {!movies[currentMovieIndex].video && <span className="text-red-400">⚠️</span>}
											</label>
											<input
												type="file"
												accept="video/*"
												onChange={(e) => handleFileChange(e, currentMovieIndex, 'video')}
												className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
											/>
											{movies[currentMovieIndex].video && (
												<p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                          ✓ {movies[currentMovieIndex].video.name}
												</p>
											)}
										</div>
									</div>
								</div>

								{/* Questions Section */}
								<div className="bg-gray-750 p-5 rounded-lg">
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-lg font-bold">Questions ({movies[currentMovieIndex].questions.length})</h3>
										<button
											onClick={() => addQuestion(currentMovieIndex)}
											className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm transition-all shadow-lg"
										>
                      + Add Question
										</button>
									</div>

									{movies[currentMovieIndex].questions.length === 0
										? (
										<div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-600 rounded-lg">
											<div className="text-4xl mb-2">❓</div>
											<p className="text-sm">No questions yet</p>
											<p className="text-xs mt-1">Click &quot;Add Question&quot; to start</p>
										</div>
										)
										: (
										<div className="space-y-4">
											{movies[currentMovieIndex].questions.map((q, qIdx) => {
												const hasIssues = !q.question?.trim() || !q.correctAnswer?.trim() ||
                                          q.answers.filter(a => a?.trim()).length < 2

												return (
													<div
														key={q.id}
														className={`bg-gray-700 border-2 rounded-lg overflow-hidden transition-all ${
															hasIssues ? 'border-red-500/50' : 'border-gray-600'
														}`}
													>
														<div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
															<div className="flex items-center gap-3">
																<span className="text-sm font-bold text-blue-400">Question {qIdx + 1}</span>
																{hasIssues && <span className="text-xs text-red-400">⚠️ Has issues</span>}
															</div>
															<button
																onClick={() => { if (window.confirm('Delete this question?')) deleteQuestion(currentMovieIndex, qIdx) }}
																className="text-sm text-red-400 hover:text-red-300 hover:bg-red-900/40 px-3 py-1 rounded transition-colors font-medium"
															>
                                🗑 Delete
															</button>
														</div>

														<div className="p-4 space-y-4">
															{/* Question Text */}
															<div>
																<label className="block text-xs font-semibold text-gray-300 mb-2 uppercase">
                                  Question Text *
																</label>
																<input
																	type="text"
																	value={q.question}
																	onChange={(e) => updateQuestion(currentMovieIndex, qIdx, 'question', e.target.value)}
																	className={`w-full p-3 bg-gray-800 rounded-lg border-2 transition-colors ${
																		!q.question?.trim() ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
																	} focus:outline-none`}
																	placeholder="Enter your question here..."
																/>
															</div>

															{/* Context Image */}
															<div>
																<label className="block text-xs font-semibold text-gray-300 mb-2 uppercase">
                                  Context Image (Optional)
																</label>
																<input
																	type="file"
																	accept="image/*"
																	onChange={(e) => handleQuestionImageChange(e, currentMovieIndex, qIdx)}
																	className="text-xs w-full file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500 file:cursor-pointer"
																/>
																{q.image && (
																	<span className="text-xs text-green-500 mt-2 block">✓ {q.image.name}</span>
																)}
															</div>

															{/* Cover Shape Editor */}
															{q.image && (
																<div className="bg-gray-800 p-3 rounded-lg">
																	<div className="flex items-center gap-2 mb-2">
																		<label className="text-xs font-semibold text-gray-300 uppercase">Cover Shape</label>
																		{q.coverShape
																			? (
																				<button
																					type="button"
																					onClick={() => updateQuestion(currentMovieIndex, qIdx, 'coverShape', null)}
																					className="text-xs text-red-400 hover:text-red-300 font-medium"
																				>
                                        Remove
																				</button>
																			)
																			: (
																				<button
																					type="button"
																					onClick={() => updateQuestion(currentMovieIndex, qIdx, 'coverShape', { x: 20, y: 20, width: 40, height: 30 })}
																					className="text-xs text-yellow-400 hover:text-yellow-300 font-medium"
																				>
                                        + Add Cover Shape
																				</button>
																			)}
																	</div>
																	{q.coverShape && (
																		<p className="text-xs text-gray-400 mb-2">Drag to move · drag edge/corner handles to resize</p>
																	)}
																	<CoverShapeEditor
																		imageFile={q.image}
																		coverShape={q.coverShape}
																		onChange={(shape) => updateQuestion(currentMovieIndex, qIdx, 'coverShape', shape)}
																	/>
																</div>
															)}

															{/* Answer Options */}
															<div>
																<label className="block text-xs font-semibold text-gray-300 mb-2 uppercase">
                                  Answer Options *
																</label>
																<div className="grid grid-cols-2 gap-3">
																	{q.answers.map((ans, aIdx) => (
																		<div key={aIdx}>
																			<label className="text-xs text-gray-400 mb-1 block">Option {aIdx + 1}</label>
																			<input
																				placeholder={`Option ${aIdx + 1}`}
																				value={ans}
																				onChange={(e) => updateAnswer(currentMovieIndex, qIdx, aIdx, e.target.value)}
																				className="w-full p-2 bg-gray-800 rounded-lg border-2 border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
																			/>
																		</div>
																	))}
																</div>
															</div>

															{/* Correct Answer Selector */}
															<div>
																<label className="block text-xs font-semibold text-gray-300 mb-2 uppercase">
                                  Correct Answer *
																	{!q.correctAnswer && <span className="ml-2 text-red-500 font-bold">⚠️ NOT SET</span>}
																</label>
																<select
																	value={q.correctAnswer}
																	onChange={(e) => updateQuestion(currentMovieIndex, qIdx, 'correctAnswer', e.target.value)}
																	className={`w-full p-3 bg-gray-800 rounded-lg border-2 transition-colors focus:outline-none ${
																		!q.correctAnswer ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
																	}`}
																>
																	<option value="">Select Correct Answer...</option>
																	{q.answers.map((ans, idx) => (
																		ans && <option key={idx} value={ans}>{ans}</option>
																	))}
																</select>
															</div>
														</div>
													</div>
												)
											})}
										</div>
									)}
								</div>
							</div>
						)
							: (
							<div className="flex items-center justify-center h-full">
								<div className="text-center text-gray-500">
									<div className="text-6xl mb-4">🎬</div>
									<h3 className="text-xl font-bold mb-2">No Movie Selected</h3>
									<p className="text-sm">Select a movie from the sidebar to start editing</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
