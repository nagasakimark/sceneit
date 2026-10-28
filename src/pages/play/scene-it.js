import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { loadQuizZip } from '@/helpers/loadQuizZip'
import playSound from '@/helpers/playSound'
import { ensureRacePackCached } from '@/helpers/racePack'
import { withBasePath } from '@/helpers/basePath'

// Race definitions (thumbnails served from /race/{dir}/thumbnail.webp)
const RACES = [
	{ name: 'Beyblade Race', dir: 'beyblade', emoji: '⚔️' },
	{ name: 'Block Race', dir: 'block-race-1000', emoji: '🧱' },
	{ name: 'Car Race', dir: 'car-race-1000', emoji: '🏎️' },
	{ name: 'Downhill Ski Race', dir: 'downhill-ski-race-1000', emoji: '⛷️' },
	{ name: 'Farm Race', dir: 'farm-race-1000', emoji: '🐮' },
	{ name: 'Food Race', dir: 'food-race-1000', emoji: '🍕' },
	{ name: 'Go Cart Race', dir: 'go-cart-race-1000', emoji: '🏁' },
	{ name: 'Halloween Race', dir: 'halloween-race-1000', emoji: '🎃' },
	{ name: 'Italian Brainrot', dir: 'italian-brainrot-race', emoji: '🤌' },
	{ name: 'Monsters Race', dir: 'monsters-race-1000', emoji: '👾' },
	{ name: 'Pirate Race', dir: 'pirate-race-1000', emoji: '🏴‍☠️' },
	{ name: 'Santa Race', dir: 'santa-race-1000', emoji: '🎅' },
	{ name: 'Speed Boat Race', dir: 'speed-boat-race-1000', emoji: '⛵' },
	{ name: 'Toy Race', dir: 'toy-race-1000', emoji: '🪀' }
]

// Colors from categories.json to cycle through
const BG_COLORS = [
	'#e6c642', // History (Yellow)
	'#f94e4e', // Entertainment (Red)
	'#685af5', // Technology (Purple)
	'#3ce956', // Geography (Green)
	'#307de7', // Art (Blue)
	'#a656fd' // Space (Violet)
]

// Team colors for non-Splatoon mode - matches Splatoon team order exactly
const TEAM_COLORS = ['#ff1744', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#ffeb3b', '#fb00ff', '#02e1ff', '#795548', '#607d8b']
const TEAM_COLOR_NAMES = ['Red', 'Blue', 'Green', 'Orange', 'Purple', 'Yellow', 'Pink', 'Light Blue', 'Brown', 'Gray']
const TEAM_COLOR_ICONS = ['red', 'blue', 'green', 'orange', 'purple', 'yellow', 'pink', 'lightblue', 'brown', 'gray']

// Splatoon team definitions — mirrors the teams array in the Splatoon app
const SPLATOON_TEAMS = [
	{ id: 1, name: 'Red', color: '#ff1744' },
	{ id: 2, name: 'Blue', color: '#2196f3' },
	{ id: 3, name: 'Green', color: '#4caf50' },
	{ id: 4, name: 'Orange', color: '#ff9800' },
	{ id: 5, name: 'Purple', color: '#9c27b0' },
	{ id: 6, name: 'Yellow', color: '#ffeb3b' },
	{ id: 7, name: 'Pink', color: '#fb00ff' },
	{ id: 8, name: 'Light Blue', color: '#02e1ff' },
	{ id: 9, name: 'Brown', color: '#795548' },
	{ id: 10, name: 'Gray', color: '#607d8b' }
]

// Renders text that may contain bracketed annotations, e.g. "Titanic (タイタニック)".
// The bracketed part is shown small and centred above the main text (like furigana).
function FuriganaText ({ text, gap = '1.5em', fontSize = '0.38em' }) {
	if (!text) return <>{text}</>
	// Split on any "word(annotation)" pattern occurring anywhere in the string
	const parts = []
	const re = /([^\s(]+)\s*\(([^)]+)\)/g
	let last = 0; let m
	while ((m = re.exec(text)) !== null) {
		if (m.index > last) {
			parts.push(<span key={`text-${last}`} style={{ whiteSpace: 'pre-wrap' }}>{text.slice(last, m.index)}</span>)
		}
		parts.push(
			<span
				key={`ruby-${m.index}`}
				style={{
					position: 'relative',
					display: 'inline-block',
					verticalAlign: 'baseline',
					whiteSpace: 'pre-wrap'
				}}
			>
				<span style={{
					position: 'absolute',
					bottom: '100%',
					left: '50%',
					transform: `translate(-50%, ${gap})`,
					fontSize,
					fontWeight: 300,
					letterSpacing: '0.04em',
					whiteSpace: 'nowrap',
					pointerEvents: 'none',
					userSelect: 'none'
				}}>
					{m[2]}
				</span>
				{m[1]}
			</span>
		)
		last = m.index + m[0].length
	}
	if (last < text.length) {
		parts.push(<span key={`text-${last}`} style={{ whiteSpace: 'pre-wrap' }}>{text.slice(last)}</span>)
	}
	if (parts.length === 0) return <>{text}</>
	return <>{parts}</>
}

export default function SceneItGame () {
	const [gameState, setGameState] = useState('upload') // upload, teams, grid, movie, questions
	const [quizData, setQuizData] = useState(null)
	const [assets, setAssets] = useState({})
	const [teams, setTeams] = useState([
		{ name: 'Team Red', score: 0, color: TEAM_COLORS[0] },
		{ name: 'Team Blue', score: 0, color: TEAM_COLORS[1] }
	])
	const [currentMovieIndex, setCurrentMovieIndex] = useState(null)
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [revealedMovies, setRevealedMovies] = useState({}) // { [index]: true }
	const [showAnswer, setShowAnswer] = useState(false)

	// Blur-reveal overlay state (for blurred poster cards)
	const [blurRevealIndex, setBlurRevealIndex] = useState(null)
	const [blurUnblurred, setBlurUnblurred] = useState(false)

	// Track which teams got the CURRENT question correct
	const [currentQuestionMarks, setCurrentQuestionMarks] = useState({}) // { [teamIndex]: boolean }

	// Race state
	const [selectedRace, setSelectedRace] = useState(null) // { name, dir, emoji }
	const [raceFinishOrder, setRaceFinishOrder] = useState([]) // team names in finishing order
	const [raceCountdown, setRaceCountdown] = useState(null) // null | 3 | 2 | 1 | 0
	const [racingTeamNames, setRacingTeamNames] = useState([]) // names of teams who are racing (correct teams only)
	const [isSoloWinner, setIsSoloWinner] = useState(false) // true when single team gets question correct in non-Splatoon mode
	const [racePackReady, setRacePackReady] = useState(false)
	// Full-pack preload progress (for "all races ready" UX)
	const [racePreload, setRacePreload] = useState({ active: false, phase: null, cached: 0, total: 0, error: null })
	// Separate thumbnail preloading from "start a race" loading so the picker stays clickable.
	const [raceThumbsLoading, setRaceThumbsLoading] = useState(false)
	const [raceThumbsError, setRaceThumbsError] = useState(null)
	const [racePackLoading, setRacePackLoading] = useState(false) // blocking only when starting a race
	const [racePackError, setRacePackError] = useState(null)
	const iframeRef = useRef(null)
	// Set to true before restoring a session to prevent the Splatoon reset effect
	// from wiping restored scores when usingSplatoon/splatoonTeamCount are set.
	const skipSplatoonResetRef = useRef(false)

	// Splatoon integration state
	const [usingSplatoon, setUsingSplatoon] = useState(false)
	const [splatoonTeamCount, setSplatoonTeamCount] = useState(4)
	const [currentSplatoonActiveIds, setCurrentSplatoonActiveIds] = useState([])
	const [pendingSplatoonScores, setPendingSplatoonScores] = useState(null)
	const [splatoonRoundDone, setSplatoonRoundDone] = useState(false)
	const [showRulesModal, setShowRulesModal] = useState(false)

	// Non-Splatoon team count
	const [teamCount, setTeamCount] = useState(2)

	// Scratch / student picker state
	const [studentCount, setStudentCount] = useState('')
	const [scratchRemaining, setScratchRemaining] = useState(() => {
		try {
			const saved = localStorage.getItem('sceneItScratch')
			if (saved) return JSON.parse(saved)
		} catch (e) {}
		return []
	})
	const [showScratchModal, setShowScratchModal] = useState(false)

	// Persist scratch remaining list to localStorage whenever it changes
	useEffect(() => {
		try { localStorage.setItem('sceneItScratch', JSON.stringify(scratchRemaining)) } catch (e) {}
	}, [scratchRemaining])

	const [hasWindow, setHasWindow] = useState(false)

	useEffect(() => {
		if (typeof window !== 'undefined') {
			setHasWindow(true)
		}
	}, [])

	// Preload the FULL race pack as soon as the main game page is opened.
	// This makes races instantly ready later and gives a visible progress bar.
	useEffect(() => {
		let cancelled = false
    ;(async () => {
			// Avoid spamming if a preload is already active/finished for this session.
			if (racePreload.active || racePackReady) return
			setRacePreload({ active: true, phase: 'init', cached: 0, total: 0, error: null })
			try {
				const res = await ensureRacePackCached({
					mode: 'full',
					onProgress: (p) => {
						if (cancelled) return
						setRacePreload(prev => ({
							...prev,
							active: p.phase !== 'done',
							phase: p.phase,
							cached: p.cached ?? prev.cached,
							total: p.total ?? prev.total,
							error: null
						}))
					}
				})
				if (!cancelled) {
					setRacePackReady(!!res?.ok)
					if (!res?.ok) {
						setRacePreload(prev => ({ ...prev, active: false, phase: 'error', error: res?.reason || 'preload-failed' }))
					} else {
						setRacePreload(prev => ({ ...prev, active: false, phase: 'done', cached: prev.total || prev.cached, error: null }))
					}
				}
			} catch (e) {
				if (!cancelled) setRacePreload(prev => ({ ...prev, active: false, phase: 'error', error: 'preload-exception' }))
			}
		})()
		return () => { cancelled = true }
	}, [racePreload.active, racePackReady])

	// Global button-click pop sound — skips during race/splatoon which have their own audio
	useEffect(() => {
		const handleClick = (e) => {
			if (gameState === 'racing' || gameState === 'splatoon') return
			if (e.target.closest('button')) {
				playSound('pop', 0.3)
			}
		}
		document.addEventListener('click', handleClick, true)
		return () => document.removeEventListener('click', handleClick, true)
	}, [gameState])

	// Start unblur animation shortly after a blurred card is selected
	useEffect(() => {
		if (blurRevealIndex === null) { setBlurUnblurred(false); return }
		const t = setTimeout(() => setBlurUnblurred(true), 350)
		return () => clearTimeout(t)
	}, [blurRevealIndex])

	// Sync quiz teams with Splatoon ink-color names whenever Splatoon mode or team count changes.
	// Guarded to gameState === 'teams' so this CANNOT fire mid-game and accidentally wipe scores.
	// Also skipped when a session restore is in progress (skipSplatoonResetRef).
	useEffect(() => {
		if (!usingSplatoon || gameState !== 'teams') return
		if (skipSplatoonResetRef.current) { skipSplatoonResetRef.current = false; return }
		setTeams(SPLATOON_TEAMS.slice(0, splatoonTeamCount).map(t => ({
			name: t.name, score: 0, color: t.color, splatoonId: t.id
		})))
	}, [usingSplatoon, splatoonTeamCount, gameState])

	// Persist teams + revealedMovies to localStorage during active gameplay so scores can be
	// recovered after an accidental page reload (user re-uploads ZIP, then clicks Restore).
	useEffect(() => {
		if (gameState === 'upload' || gameState === 'teams') return
		try {
			const splatMapColors = localStorage.getItem('splatMapColors') || null
			localStorage.setItem('sceneItSession', JSON.stringify({ teams, revealedMovies, usingSplatoon, splatoonTeamCount, splatMapColors }))
		} catch (e) {}
	}, [teams, revealedMovies, gameState])

	// Race countdown: tick down each second, then switch to results
	useEffect(() => {
		if (raceCountdown === null) return
		if (raceCountdown === 0) {
			setRaceCountdown(null)
			setGameState('raceResults')
			return
		}
		const t = setTimeout(() => setRaceCountdown(c => c - 1), 1000)
		return () => clearTimeout(t)
	}, [raceCountdown])

	// Set up race callback while on racing screen — in parent scope so iframe never remounts
	useEffect(() => {
		if (gameState !== 'racing') return
		window.raceFinished = (order) => handleRaceFinished(order)
		window.winShow = () => {}
		return () => {
			delete window.raceFinished
			delete window.winShow
		}
	}, [gameState])

	// Preload race pack (only when user reaches race UI).
	// In "obscured builds" /public/race won't exist, so thumbnails/pages rely on this cache.
	useEffect(() => {
		if (gameState !== 'racePicker' && gameState !== 'racing') return
		let cancelled = false
    ;(async () => {
			if (racePackReady || raceThumbsLoading || racePackLoading) return
			setRaceThumbsLoading(true)
			setRaceThumbsError(null)
			try {
				const res = await ensureRacePackCached({ mode: 'thumbnails' })
				if (!cancelled) {
					setRacePackReady(!!res?.ok)
					if (!res?.ok) setRaceThumbsError(res?.reason || 'thumbs-load-failed')
				}
			} catch (e) {
				if (!cancelled) {
					setRacePackReady(false)
					setRaceThumbsError('thumbs-load-exception')
				}
			} finally {
				if (!cancelled) setRaceThumbsLoading(false)
			}
		})()
		return () => { cancelled = true }
	}, [gameState, racePackReady, raceThumbsLoading, racePackLoading])

	// Global keyboard hotkeys
	useEffect(() => {
		const handler = (e) => {
			// Ignore if focus is on an input/textarea
			if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

			// Space → primary continue/reveal action for the current screen
			if (e.code === 'Space') {
				e.preventDefault()
				if (gameState === 'questions') {
					if (!showAnswer) handleReveal()
					else handleContinueToScoring()
				} else if (gameState === 'scoring') {
					handleContinueFromScoring()
				} else if (gameState === 'raceResults') {
					handleApplyRacePoints()
				}
				return
			}

			// Digit keys 1-9, 0 → toggle that team in scoring screen
			// Backtick ` → toggle all teams
			if (gameState === 'scoring') {
				let teamIndex = null
				if (e.key >= '1' && e.key <= '9') teamIndex = parseInt(e.key) - 1
				else if (e.key === '0') teamIndex = 9
				if (teamIndex !== null && teamIndex < teams.length) {
					toggleTeamMark(teamIndex)
					return
				}
				if (e.key === '`') {
					// Toggle all: if every team is already marked, unmark all; else mark all
					const allMarked = teams.every((_, i) => currentQuestionMarks[i])
					if (allMarked) {
						setCurrentQuestionMarks({})
					} else {
						const all = {}
						teams.forEach((_, i) => { all[i] = true })
						setCurrentQuestionMarks(all)
					}
				}
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [gameState, showAnswer, teams, currentQuestionMarks])

	// Set up splatoon round complete callback while on splatoon screen
	useEffect(() => {
		if (gameState !== 'splatoon') return
		window.splatoonRoundComplete = (scores) => {
			setPendingSplatoonScores(scores)
			setSplatoonRoundDone(true) // Reveal the manual Continue button in the top bar
		}
		return () => { delete window.splatoonRoundComplete }
	}, [gameState])

	// Loading Logic
	const handleFileUpload = async (e) => {
		const file = e.target.files[0]
		if (!file) return

		try {
			console.log('Starting file upload:', file.name)
			const { quizData, assets } = await loadQuizZip(file)
			console.log('Quiz Data Loaded:', quizData)
			console.log('Assets Keys:', Object.keys(assets))
			// Clear any saved Splatoon map state so each new quiz starts fresh
			try { localStorage.removeItem('splatMapColors') } catch (e) {}
			setQuizData(quizData)
			setAssets(assets)
			setGameState('teams')
		} catch (err) {
			console.error(err)
			alert('Failed to load quiz file')
		}
	}

	// Team Setup
	const updateTeamName = (index, name) => {
		setTeams(prev => prev.map((t, i) => i === index ? { ...t, name } : t))
	}

	const addTeam = () => {
		const newTeamIndex = teams.length
		const colorName = TEAM_COLOR_NAMES[newTeamIndex % TEAM_COLOR_NAMES.length]
		setTeams([...teams, {
			name: `Team ${colorName}`,
			score: 0,
			color: TEAM_COLORS[newTeamIndex % TEAM_COLORS.length]
		}])
	}

	const startGame = () => {
		// Shuffle movies so each class gets a different order
		const shuffled = [...quizData.movies]
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
		}
		setQuizData(prev => ({ ...prev, movies: shuffled }))

		const n = parseInt(studentCount)
		if (n > 0) {
			const nums = Array.from({ length: n }, (_, i) => i + 1)
			setScratchRemaining(nums)
			try { localStorage.setItem('sceneItScratch', JSON.stringify(nums)) } catch (e) {}
		} else {
			// No student count entered — clear any leftover scratch pool from a previous game
			setScratchRemaining([])
			try { localStorage.removeItem('sceneItScratch') } catch (e) {}
		}
		setGameState('grid')
	}

	// Game Logic
	const handleMovieSelect = (index) => {
		if (revealedMovies[index]) return // Already played
		setCurrentMovieIndex(index)
		setRevealedMovies(prev => ({ ...prev, [index]: true })) // Mark revealed immediately
		setGameState('movie')
	}

	const handleMovieFinished = () => {
		setGameState('questions')
		setCurrentQuestionIndex(0)
		setShowAnswer(false)
		setCurrentQuestionMarks({})
	}

	const darken = (hex) => {
		if (!hex || hex[0] !== '#' || hex.length < 7) return '#000'
		const r = Math.floor(parseInt(hex.slice(1, 3), 16) * 0.6)
		const g = Math.floor(parseInt(hex.slice(3, 5), 16) * 0.6)
		const b = Math.floor(parseInt(hex.slice(5, 7), 16) * 0.6)
		return `rgb(${r},${g},${b})`
	}

	const toggleTeamMark = (teamIndex) => {
		setCurrentQuestionMarks(prev => {
			const newState = { ...prev }
			if (newState[teamIndex]) {
				delete newState[teamIndex]
			} else {
				newState[teamIndex] = true
			}
			return newState
		})
	}

	const handleReveal = () => {
		setShowAnswer(true)
		playSound('correct_answer', 0.4)
	}

	const handleContinueToScoring = () => {
		setGameState('scoring')
	}

	// Shared helper: advance to next question or back to grid
	const advanceAfterScoring = () => {
		setShowAnswer(false)
		setCurrentQuestionMarks({})
		const currentMovie = quizData.movies[currentMovieIndex]
		if (currentQuestionIndex < currentMovie.questions.length - 1) {
			setCurrentQuestionIndex(prev => prev + 1)
			setGameState('questions')
		} else {
			setGameState('grid')
			setCurrentMovieIndex(null)
		}
	}

	// Race Handlers
	// Called from ScoringScreen's single Continue button
	const handleContinueFromScoring = () => {
		const correctIdxs = Object.keys(currentQuestionMarks).map(Number)
		const count = correctIdxs.length

		if (count >= 2) {
			// 2+ correct: race to determine order; in Splatoon mode race results → map
			// Send numbers 1-9, 0 for team 10 (keeps box sizes consistent)
			const correctNames = correctIdxs.map(i => {
				const teamNumber = (i % 10) + 1 // 1-10
				return teamNumber === 10 ? '0' : String(teamNumber)
			})
			setRacingTeamNames(correctNames)
			try { localStorage.setItem('sceneItTeamNames', JSON.stringify(correctNames)) } catch (e) {}
			setGameState('racePicker')
			return
		}

		if (count === 1 && usingSplatoon) {
			// 1 correct in Splatoon mode: skip race, go straight to the map — only that team plays
			const soloId = teams[correctIdxs[0]].splatoonId
			setCurrentSplatoonActiveIds([soloId])
			setSplatoonRoundDone(false)
			setGameState('splatoon')
			return
		}

		// 0 correct: just advance
		// 1 correct in non-Splatoon mode: give 3 points and show leaderboard
		if (count === 1) {
			const winnerIdx = correctIdxs[0]
			const teamNumber = (winnerIdx % 10) + 1
			const numStr = teamNumber === 10 ? '0' : String(teamNumber)

			// Set up a "race" with just one participant to show leaderboard
			setRaceFinishOrder([numStr])
			setIsSoloWinner(true)

			// Show the race results screen to display the leaderboard with +3 points
			// (points will be applied when user clicks Continue in handleApplyRacePoints)
			setRaceCountdown(null)
			setGameState('raceResults')
			return
		}
		// 0 correct: just advance
		advanceAfterScoring()
	}

	const handleRaceSelect = (race) => {
		(async () => {
			// Ensure pack is cached before the iframe loads (prevents 404 in obscured builds).
			// Ensure the selected race is cached even if thumbnails already are.
			if (!racePackLoading) {
				setRacePackLoading(true)
				setRacePackError(null)
				try {
					const res = await ensureRacePackCached({ mode: 'race', raceDir: race?.dir })
					setRacePackReady(!!res?.ok)
					if (!res?.ok) setRacePackError(res?.reason || 'pack-load-failed')
				} catch (e) {
					setRacePackReady(false)
					setRacePackError('pack-load-exception')
				} finally {
					setRacePackLoading(false)
				}
			}
			setSelectedRace(race)
			setRaceFinishOrder([])
			setRaceCountdown(null)
			setGameState('racing')
		})()
	}

	const handleRaceFinished = (order) => {
		setRaceFinishOrder(order || [])
		setTimeout(() => setRaceCountdown(3), 2000) // 2-second pause before countdown appears
	}

	const handleApplyRacePoints = () => {
		// Helper to map team number back to team (race returns "1", "2", ... "9", "0")
		const findTeamByNumber = (numStr) => {
			// Convert "0" to 10, otherwise parse as-is
			const teamNumber = numStr === '0' ? 10 : parseInt(numStr, 10)
			if (isNaN(teamNumber)) return null
			// Team number 1-10 maps to index 0-9
			const teamIndex = teamNumber - 1
			return teams[teamIndex] || null
		}

		if (usingSplatoon) {
			// Race determined turn ORDER for the Splatoon map — go there now, no points applied
			const orderedIds = raceFinishOrder
				.map(numStr => findTeamByNumber(numStr)?.splatoonId)
				.filter(Boolean)
			setCurrentSplatoonActiveIds(orderedIds)
			setSplatoonRoundDone(false)
			setGameState('splatoon')
			return
		}
		// Normal race mode: dynamic point distribution based on number of racing teams
		// If N teams race: 1st gets N points, 2nd gets N-1, ..., last gets 1 point
		// Special case: if solo winner (only 1 team), give 3 points
		const numRacingTeams = raceFinishOrder.length
		setTeams(prev => {
			const pointsMap = {}
			raceFinishOrder.forEach((numStr, pos) => {
				const team = findTeamByNumber(numStr)
				if (team) {
					// If solo winner, award 3 points instead of 1
					pointsMap[team.name] = isSoloWinner ? 3 : (numRacingTeams - pos)
				}
			})
			return prev.map(t => pointsMap[t.name] !== undefined ? { ...t, score: t.score + pointsMap[t.name] } : t)
		})
		// Reset solo winner flag
		setIsSoloWinner(false)
		advanceAfterScoring()
	}

	const handleSplatoonContinue = () => {
		// Manually called after user clicks Continue in the Splatoon top bar
		if (pendingSplatoonScores) {
			setTeams(prev => prev.map(t => ({
				...t,
				score: pendingSplatoonScores[t.splatoonId] ?? t.score
			})))
		}
		setSplatoonRoundDone(false)
		setPendingSplatoonScores(null)
		advanceAfterScoring()
	}

	// Helper to safely get asset URL even if path differs (e.g. video.mp4 vs assets/video.mp4)
	const getAssetUrl = (path) => {
		if (!path) return null
		console.log('Attempting to find asset:', path)
		if (assets[path]) {
			console.log('Found exact match:', path)
			return assets[path]
		}
		if (assets[`assets/${path}`]) {
			console.log('Found with prefix assets/:', `assets/${path}`)
			return assets[`assets/${path}`]
		}
		// Try finding by filename only if exact match fails
		const filename = path.split('/').pop()
		const foundKey = Object.keys(assets).find(k => k.endsWith(filename))
		if (foundKey) {
			console.log('Found by partial filename match:', foundKey)
			return assets[foundKey]
		}
		console.warn('Asset not found:', path, 'Available assets:', Object.keys(assets))
		return null
	}

	// Wrapper: Handles background changes dynamically
	const GameWrapper = ({ children, className = '', style = {} }) => (
		<div className={`min-h-screen text-white font-sans overflow-hidden bg-cover bg-center transition-all duration-500 ${className}`}
			style={style}>
			{children}
		</div>
	)

	// Components
	const UploadScreen = () => (
		<GameWrapper className="flex items-center justify-center" style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#307de7', backgroundBlendMode: 'multiply' }}>
			<div className="flex flex-col items-center justify-center min-h-screen w-full px-4">
				{/* Race pack preload progress bar */}
				{(racePreload.total > 0 || racePreload.error) && (
					<div className="w-full max-w-xl mb-6 bg-black/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
						<div className="flex items-center justify-between gap-3 mb-2">
							<span className="text-white font-black text-sm uppercase tracking-wide">Preparing races</span>
							<span className="text-white/80 text-xs font-bold tabular-nums">
								{racePreload.error
									? `Error (${racePreload.error})`
									: racePreload.total > 0
										? `${racePreload.cached}/${racePreload.total}`
										: 'Starting…'}
							</span>
						</div>
						<div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
							<div
								className="h-full bg-[#22c55e]"
								style={{
									width: racePreload.total > 0 ? `${Math.max(2, Math.floor((racePreload.cached / racePreload.total) * 100))}%` : '2%',
									transition: 'width 0.15s linear'
								}}
							/>
						</div>
						<p className="mt-2 text-xs text-white/70 font-bold">
							{racePreload.error
								? 'Races may 404 until the pack finishes caching. Refresh and try again.'
								: racePreload.active
									? 'Unpacking and caching races for this session…'
									: 'Races are ready.'}
						</p>
					</div>
				)}
				<h1 className="text-7xl md:text-8xl font-bold mb-2 text-white uppercase tracking-tight" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>Scene It</h1>
				<p className="text-2xl text-blue-200 mb-10 font-bold">🎬 Game Host</p>
				<div className="bg-[#1a1f38] p-10 rounded-2xl text-center border-4 border-dashed border-[#3b82f6] hover:border-[#e6c642] transition-colors shadow-2xl max-w-xl w-full">
					<div className="mb-6">
						<span className="text-7xl">📁</span>
					</div>
					<p className="text-2xl mb-6 font-bold text-white" style={{ fontFamily: 'PrintClearly, sans-serif' }}>Load your quiz pack</p>
					<p className="text-sm text-blue-300 mb-6">Upload a .zip file to start hosting</p>
					<label className="btn-primary inline-block text-xl px-10 py-4 cursor-pointer uppercase tracking-wide">
                Choose File
						<input type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
					</label>
				</div>
				<Link href="/" className="mt-10 btn-primary bg-[#685af5] hover:bg-[#7b6ff7] text-white px-8 py-3 text-lg uppercase tracking-wide">
            ← Back to Home
				</Link>
			</div>
		</GameWrapper>
	)

	const TeamsScreen = () => {
		return (
		<GameWrapper className="flex items-center justify-center" style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#685af5', backgroundBlendMode: 'multiply' }}>
				<div className="flex flex-col items-center justify-center min-h-screen p-4 w-full max-w-3xl">
					<h1 className="text-6xl md:text-7xl font-bold mb-2 text-white uppercase" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>Team Setup</h1>
					<p className="text-xl text-blue-200 mb-8 font-bold">Add your teams below</p>

					{/* Session restore — shown if a previous game's scores were saved to localStorage */}
					{(() => {
						try {
							const saved = localStorage.getItem('sceneItSession')
							if (!saved) return null
							const session = JSON.parse(saved)
							if (!session?.teams?.length) return null
							return (
								<div className="w-full mb-4 rounded-xl bg-[#e6c642]/20 border-2 border-[#e6c642] px-5 py-4 flex items-center gap-4">
									<span className="text-2xl">⚠️</span>
									<div className="flex-1 min-w-0">
										<p className="text-[#e6c642] font-black uppercase text-sm tracking-wide">Previous session found</p>
										<p className="text-white/80 text-xs mt-0.5 truncate">{session.teams.map(t => `${t.name} (${t.score}pts)`).join(' · ')}</p>
									</div>
									<button
										onClick={() => {
											if (session.usingSplatoon) {
												// Suppress the Splatoon reset effect so restored scores aren't wiped
												skipSplatoonResetRef.current = true
												setUsingSplatoon(true)
												if (session.splatoonTeamCount) setSplatoonTeamCount(session.splatoonTeamCount)
											}
											// Restore Splatoon map territory if it was saved
											if (session.splatMapColors) {
												try { localStorage.setItem('splatMapColors', session.splatMapColors) } catch (e) {}
											} else {
												try { localStorage.removeItem('splatMapColors') } catch (e) {}
											}
											setTeams(session.teams)
											setRevealedMovies(session.revealedMovies || {})
										}}
										className="btn-primary bg-[#e6c642] before:bg-[#b89a1a] text-black font-black uppercase text-sm px-4 py-2 shrink-0"
									>
										<span style={{ position: 'relative', zIndex: 1 }}>↩ Restore</span>
									</button>
								</div>
							)
						} catch (e) { return null }
					})()}

					{/* Splatoon Mode Toggle */}
					<div className="w-full mb-6 rounded-2xl overflow-hidden" style={{ background: '#1a1f38', border: `3px solid ${usingSplatoon ? '#685af5' : '#3b82f6'}` }}>
						<button
							onClick={() => setUsingSplatoon(v => !v)}
							className={`w-full py-4 px-6 flex items-center justify-between font-black text-xl uppercase transition-all ${usingSplatoon ? 'bg-[#685af5]' : 'bg-transparent'}`}
							style={{ fontFamily: 'PrintClearly, sans-serif' }}
						>
							<span>🦑 Splatoon Scoring</span>
							<span className={`px-4 py-1 rounded-lg text-sm ${usingSplatoon ? 'bg-white text-[#685af5]' : 'bg-[#685af5] text-white'}`}>
								{usingSplatoon ? 'ON' : 'OFF'}
							</span>
						</button>
						{usingSplatoon && (
							<div className="p-4 border-t border-[#685af5]/40">
								<p className="text-purple-300 text-sm font-bold mb-3 uppercase tracking-wide">Number of Teams (Splatoon ink colors)</p>
								<div className="flex gap-2 flex-wrap mb-3">
									{[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
										<button
											key={n}
											onClick={() => setSplatoonTeamCount(n)}
											className={`btn-primary px-4 py-2 text-lg font-black ${splatoonTeamCount === n ? 'bg-[#685af5] before:bg-[#4e3cc2]' : 'bg-[#2a3155] before:bg-[#1a2040]'}`}
										>{n}</button>
									))}
								</div>
								<div className="flex flex-wrap gap-2">
									{SPLATOON_TEAMS.slice(0, splatoonTeamCount).map(t => (
										<span key={t.id} className="px-3 py-1 rounded-lg text-sm font-bold text-white" style={{ background: t.color }}>{t.name}</span>
									))}
								</div>
							</div>
						)}
					</div>

					<div className="w-full space-y-4">
						{!usingSplatoon && (
							<>
								<div className="bg-[#1a1f38] rounded-2xl p-4" style={{ border: '3px solid #3b82f6' }}>
									<p className="text-blue-300 text-sm font-bold mb-3 uppercase tracking-wide">Number of Teams</p>
									<div className="flex gap-2 flex-wrap mb-3">
										{[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
											<button
												key={n}
												onClick={() => {
													setTeamCount(n)
													// Automatically create/update teams with color names
													const newTeams = Array.from({ length: n }, (_, i) => ({
														name: `Team ${TEAM_COLOR_NAMES[i % TEAM_COLOR_NAMES.length]}`,
														score: teams[i]?.score || 0,
														color: TEAM_COLORS[i % TEAM_COLORS.length]
													}))
													setTeams(newTeams)
												}}
												className={`btn-primary px-4 py-2 text-lg font-black ${teamCount === n ? 'bg-[#3b82f6] before:bg-[#2563eb]' : 'bg-[#2a3155] before:bg-[#1a2040]'}`}
											>{n}</button>
										))}
									</div>
									<div className="flex flex-wrap gap-2">
										{teams.map((t, idx) => (
											<div key={idx} className="flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold text-white" style={{ background: t.color }}>
												<div className="w-4 h-4 rounded-full border-2 border-white" style={{ background: t.color }} />
												{t.name}
											</div>
										))}
									</div>
								</div>
							</>
						)}
						<button onClick={startGame} className="btn-primary w-full py-5 text-2xl uppercase tracking-wide bg-[#22c55e] before:bg-[#16a34a] hover:bg-[#2dd44d]" style={{ fontFamily: 'PrintClearly, sans-serif' }}>▶ Start Game</button>
					</div>

					{/* Student count for scratch picker */}
					<div className="w-full mt-4 bg-[#1a1f38] rounded-2xl px-6 py-4" style={{ border: '3px solid #e6c642' }}>
						<p className="text-[#e6c642] font-black uppercase text-sm tracking-wide mb-3">🎟 Student Picker (optional)</p>
						<div className="flex items-center gap-3 flex-wrap">
							<span className="text-white font-bold">Number of students:</span>
							<input
								type="number"
								min="1"
								max="999"
								value={studentCount}
								onChange={e => setStudentCount(e.target.value)}
								placeholder="e.g. 30"
								className="w-28 rounded-lg px-3 py-2 text-white text-xl font-black bg-[#2a3155] border-2 border-[#e6c642] focus:outline-none text-center"
							/>
							<span className="text-white/50 text-sm">Leave blank to skip</span>
						</div>
					</div>
				</div>
			</GameWrapper>
		)
	}

	// Inline scratch modal — rendered inside GridScreen
	const ScratchModal = () => {
		// Before rendering, write current scratchRemaining into studentPickerSettingsV1
		// so the iframe scratch tool picks from the correct pool.
		useEffect(() => {
			try {
				const pool = scratchRemaining.map(String)
				const names = scratchRemaining.join('\n')
				const existing = JSON.parse(localStorage.getItem('studentPickerSettingsV1') || '{}')
				localStorage.setItem('studentPickerSettingsV1', JSON.stringify({
					...existing,
					mode: 'list',
					names,
					removeFromPool: true,
					pool
				}))
			} catch (e) {}
		}, [])

		// Sync scratchRemaining from localStorage when modal closes
		const handleClose = () => {
			try {
				const raw = localStorage.getItem('studentPickerSettingsV1')
				if (raw) {
					const s = JSON.parse(raw)
					if (Array.isArray(s.pool)) {
						setScratchRemaining(s.pool.map(Number).filter(n => !isNaN(n)))
					}
				}
			} catch (e) {}
			setShowScratchModal(false)
		}

		return (
			<div
				className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
				style={{ background: 'rgba(10,14,30,0.92)' }}
			>
				{/* Close bar */}
				<div className="w-full max-w-4xl flex items-center justify-between px-4 py-2 mb-2">
					<span className="text-white font-black text-lg uppercase" style={{ fontFamily: 'PrintClearly, sans-serif' }}>
            🎟 Student Picker — {scratchRemaining.length} remaining
					</span>
					<button
						onClick={handleClose}
						className="btn-primary bg-[#f94e4e] before:bg-[#b02020] px-6 py-2 font-black uppercase"
					>
						<span style={{ position: 'relative', zIndex: 1 }}>✕ Close</span>
					</button>
				</div>
				{/* Scratch iframe */}
				<iframe
          src={withBasePath('/scratch/scratch.html')}
					className="rounded-2xl"
					style={{ width: '100%', maxWidth: '900px', height: '70vh', border: '3px solid #e6c642' }}
					title="Student Scratch Picker"
				/>
			</div>
		)
	}

	const GridScreen = () => {
		const n = quizData.movies.length
		// 1 row for 1-5 movies, 2 rows for 6-10
		const numCols = n <= 5 ? n : Math.ceil(n / 2)
		const numRows = Math.ceil(n / numCols)

		// Hidden shortcut: press R to reveal all movies
		useEffect(() => {
			const handler = (e) => {
				if (e.key === 'r' || e.key === 'R') {
					const all = {}
					quizData.movies.forEach((_, i) => { all[i] = true })
					setRevealedMovies(all)
				}
			}
			window.addEventListener('keydown', handler)
			return () => window.removeEventListener('keydown', handler)
		}, [])

		return (
		<GameWrapper className="h-screen overflow-hidden flex flex-col" style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#307de7', backgroundBlendMode: 'multiply' }}>
				<div className="h-full flex flex-col p-4 md:p-5 w-full">
					{/* Scoreboard Header */}
					<div className="shrink-0 w-full flex flex-wrap justify-center items-center gap-2 mb-4 bg-[#1a1f38] px-4 py-3 rounded-2xl border-2 border-[#3b82f6] shadow-xl z-10">
						<h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mr-2" style={{ fontFamily: 'PrintClearly, sans-serif' }}>Scoreboard</h1>
						<div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
							{teams.map((t, idx) => {
								const color = t.color || TEAM_COLORS[idx % TEAM_COLORS.length]
								// For non-splatoon mode with many teams, show just color name to save space
								const displayName = usingSplatoon ? t.name : (t.name.replace('Team ', '') || t.name)
								return (
									<div key={idx} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: color, minWidth: usingSplatoon ? '84px' : '60px' }}>
										{/* Color circle indicator - only show in Splatoon mode */}
										{usingSplatoon && <div className="w-6 h-6 rounded-full border-2 border-white shrink-0" style={{ background: color }} />}
										<span className="text-white font-bold text-sm truncate max-w-[64px]">{displayName}</span>
										<span className="ml-auto font-black text-2xl text-white rounded-lg px-2 py-0.5" style={{ fontFamily: 'PrintClearly, sans-serif', background: '#1a1f38', fontVariantNumeric: 'tabular-nums', minWidth: '2ch', textAlign: 'center' }}>{t.score}</span>
									</div>
								)
							})}
						</div>
						<button
							onClick={() => { if (window.confirm('End the game and show final scores?')) setGameState('gameOver') }}
							className="btn-primary bg-[#f94e4e] before:bg-[#b02020] hover:bg-[#ff6060] px-5 py-2 text-sm font-black uppercase ml-2"
							style={{ fontFamily: 'PrintClearly, sans-serif' }}
						>
							<span style={{ position: 'relative', zIndex: 1 }}>🏁 End Game</span>
						</button>
						{scratchRemaining.length > 0 && (
							<button
								onClick={() => setShowScratchModal(true)}
								className="btn-primary bg-[#e6c642] before:bg-[#b89a1a] px-4 py-2 text-sm font-black uppercase"
								style={{ fontFamily: 'PrintClearly, sans-serif', color: '#1a1f38', minWidth: '9rem', fontVariantNumeric: 'tabular-nums' }}
							>
								<span style={{ position: 'relative', zIndex: 1 }}>🎟 Students ({scratchRemaining.length})</span>
							</button>
						)}
					</div>
					{showScratchModal && <ScratchModal />}

					{/* Movie Grid — fills remaining space, cards shrink to fit */}
					<div
						className="flex-1 min-h-0 grid gap-3 w-full"
						style={{
							gridTemplateColumns: `repeat(${numCols}, 1fr)`,
							gridTemplateRows: `repeat(${numRows}, 1fr)`
						}}
					>
						{quizData.movies.map((m, idx) => {
							const isRevealed = revealedMovies[idx]
							const useBlurredPoster = !isRevealed && m.coveredImageBlurred && m.poster
							const rawUrl = isRevealed && m.poster
								? getAssetUrl(m.poster)
								: useBlurredPoster
									? getAssetUrl(m.poster)
									: (m.coveredImage ? getAssetUrl(m.coveredImage) : null)
							const imageUrl = rawUrl
							const cardColor = BG_COLORS[idx % BG_COLORS.length]

							return (
								<div
									key={idx}
									onClick={() => {
										if (isRevealed) return
										if (useBlurredPoster) {
											// First click → show blur reveal overlay; second click → go to movie
											if (blurRevealIndex === idx) {
												setBlurRevealIndex(null)
												handleMovieSelect(idx)
											} else {
												setBlurRevealIndex(idx)
											}
										} else {
											handleMovieSelect(idx)
										}
									}}
									className={`relative rounded-2xl overflow-hidden transition-all duration-200 transform group shadow-lg
                        ${isRevealed
									? 'cursor-not-allowed'
									: 'cursor-pointer hover:scale-[1.04] hover:z-10'}
                    `}
									style={{ border: isRevealed ? '4px solid #22c55e' : `4px solid ${cardColor}`, background: '#1a1f38' }}
								>
									{imageUrl
										? (
											<img src={imageUrl} alt={m.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
												style={useBlurredPoster ? { filter: 'blur(20px)', transform: 'scale(1.15)' } : {}}
											/>
										)
										: (
											<div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: `${cardColor}22` }}>
												<span className="text-8xl font-black" style={{ color: cardColor, opacity: 0.15 }}>{idx + 1}</span>
												<span className="absolute text-5xl font-black text-white drop-shadow-lg" style={{ fontFamily: 'PrintClearly, sans-serif' }}>#{idx + 1}</span>
											</div>
										)}

									{!isRevealed && (
										<div className="absolute top-2 left-2 z-10 flex items-center justify-center rounded-full font-black text-white shadow-lg"
											style={{
												background: cardColor,
												border: '3px solid white',
												width: '3.5rem',
												height: '3.5rem',
												fontFamily: 'PrintClearly, sans-serif',
												fontSize: '1.5rem',
												lineHeight: 1,
												boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
												textShadow: '0 1px 3px rgba(0,0,0,0.4)'
											}}
										>
											{idx + 1}
										</div>
									)}

									{isRevealed && (
										<div className="absolute inset-0 flex items-center justify-center bg-black/50">
											<div className="transform -rotate-12 px-6 py-2 font-black text-2xl uppercase tracking-widest" style={{ background: '#22c55e', color: 'white' }}>
                                ✓ Done
											</div>
										</div>
									)}
								</div>
							)
						})}
					</div>
				</div>
			</GameWrapper>
		)
	}

	// MovieScreen is inlined in the return (not a sub-component) so the <video> element
	// is never unmounted/remounted mid-playback when parent state changes.

	const QuestionScreen = () => {
		const movie = quizData.movies[currentMovieIndex]
		const question = movie.questions[currentQuestionIndex]
		const imageUrl = question.image ? getAssetUrl(question.image) : null

		// Defensive check and console logging for debugging
		if (!question.answers || question.answers.length === 0) {
			console.error('Question has no answers:', question)
		}
		if (!question.correctAnswer) {
			console.error('Question has no correctAnswer:', question)
		}
		if (question.answers && question.correctAnswer) {
			// Check if correctAnswer matches any answer (case-sensitive and trimmed)
			const trimmedCorrect = (question.correctAnswer || '').trim()
			const trimmedAnswers = question.answers.map(a => (a || '').trim())
			const hasMatch = trimmedAnswers.some(a => a === trimmedCorrect)
			if (!hasMatch) {
				console.error('correctAnswer does not match any answer:', {
					correctAnswer: question.correctAnswer,
					answers: question.answers,
					trimmedCorrect,
					trimmedAnswers
				})
			}
		}

		const bgColor = BG_COLORS[currentQuestionIndex % BG_COLORS.length]
		const containerStyle = {
        backgroundImage: `url('${withBasePath('/play_bg.webp')}')`,
			backgroundColor: bgColor,
			backgroundBlendMode: 'multiply'
		}

		// Staggered entrance delays for answers
		const answerDelays = ['0.35s', '0.45s', '0.55s', '0.65s']

		return (
		// key forces a full remount (and re-animation) on every new question
			<GameWrapper
				key={`q-${currentQuestionIndex}`}
				className="fixed inset-0 h-screen w-screen overflow-hidden"
				style={containerStyle}
			>
				{/* Top bar: Q counter + back-to-menu */}
				<div className="absolute top-3 left-3 z-50 flex items-center gap-2 anim-fade-up" style={{ animationDelay: '0.05s' }}>
					<button
						onClick={() => { if (window.confirm('Go back to the movie menu? Current question progress will be lost.')) setGameState('grid') }}
						className="bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md border border-white/20 transition-colors"
					>
                ← Menu
					</button>
					<div className="bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                Q {currentQuestionIndex + 1} / {movie.questions.length}
					</div>
				</div>

				<div className="flex h-screen w-full">

					{/* LEFT: Image */}
					{imageUrl && (
						<div className="flex-1 flex items-center justify-center p-4 min-w-0 overflow-hidden anim-slide-left">
							{/* Self-sizing wrapper: auto-shrinks to exactly the rendered image size.
                        This ensures cover box % positions always match what was set in the editor,
                        regardless of image aspect ratio or screen dimensions.
                        Previously used inline-block h-full which could make the container taller/wider
                        than the actual image, causing vertical misalignment on the cover box. */}
							<div
								className="relative rounded-xl shadow-2xl overflow-hidden bg-black/30"
								style={{ border: '2px solid rgba(255,255,255,0.2)', maxWidth: '100%', maxHeight: 'calc(100vh - 4rem)' }}
							>
								<img
									src={imageUrl}
									alt="Question visuals"
									className="block"
									style={{ maxHeight: 'calc(100vh - 4rem)', maxWidth: '100%', height: 'auto', width: 'auto' }}
								/>
								{question.coverShape && (
									<div
										className="absolute flex items-center justify-center transition-opacity duration-700"
										style={{
											left: `${question.coverShape.x}%`,
											top: `${question.coverShape.y}%`,
											width: `${question.coverShape.width}%`,
											height: `${question.coverShape.height}%`,
											background: 'linear-gradient(135deg, #1c233a 0%, #2d3a5e 100%)',
											border: '2px solid #685af5',
											boxShadow: '0 0 16px #685af588',
											opacity: showAnswer ? 0 : 1,
											pointerEvents: 'none'
										}}
									>
										<span className="font-black text-purple-300 drop-shadow-lg select-none" style={{ fontSize: 'clamp(1rem, 6cqw, 4rem)' }}>?</span>
									</div>
								)}
							</div>
						</div>
					)}

					{/* RIGHT: Question + answers + action button */}
					<div className={`flex flex-col justify-center p-6 gap-4 ${imageUrl ? 'w-[45%] shrink-0' : 'flex-1 max-w-2xl mx-auto'}`}>

						{/* Question text drops in */}
						<p className="anim-drop-bounce rounded-xl flex justify-center items-center bg-blue-500 px-5 py-4 text-white text-5xl font-semibold shadow-lg text-center" style={{ animationDelay: '0.1s', fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '0.5px white', lineHeight: 1.2, paddingTop: '1.5rem' }}>
							<FuriganaText text={question.question} gap="1em" />
						</p>

						{/* Answers pop in staggered — stacked vertically for better visibility */}
						<ul className="flex flex-col gap-8">
							{question.answers && question.answers.length > 0
								? question.answers.map((answer, j) => {
								// Trim whitespace for comparison to handle data inconsistencies
								const trimmedAnswer = (answer || '').trim()
								const trimmedCorrect = (question.correctAnswer || '').trim()
								const isCorrect = trimmedAnswer === trimmedCorrect
								let btnClasses = `peer btn-primary w-full shadow-sm pl-20 py-3 px-6 rounded text-left flex items-center min-h-[5rem] text-6xl ${answer && answer.length > 30 ? 'text-5xl' : ''}`
								let liClasses = 'relative anim-pop-in mb-4'
								if (showAnswer) {
									if (isCorrect) { btnClasses += ' correctAnswer'; liClasses += ' shake-left-right' } else { btnClasses += ' disabled opacity-60' }
								}
								return (
									<li key={j} className={liClasses} style={{ animationDelay: answerDelays[j] }}>
										<button className={btnClasses} style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '0.4px white', paddingTop: '1rem' }} disabled={showAnswer}><FuriganaText text={answer || '---'} gap="0.4em" fontSize="0.25em" /></button>
										<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 transition-transform peer-disabled:translate-y-[-50%] peer-hover:translate-y-[calc(-50%+0.25em)] peer-active:translate-y-[calc(-50%+0.75em)]">
											<Image className='invert' src={withBasePath(`/letters/letter-${['a', 'b', 'c', 'd'][j]}.svg`)} width={52} height={52} alt={`Option ${j + 1}`} />
										</div>
									</li>
								)
							})
								: (
								<li className="text-center">
									<p className="text-white text-xl font-bold bg-red-600 py-4 px-6 rounded-xl">
                                ⚠️ No answers available for this question. Please check the quiz data.
									</p>
								</li>
								)}
						</ul>

						{/* Reveal / Continue button bounces in */}
						<div className="mt-2 anim-bounce-in" style={{ animationDelay: '0.75s' }}>
							{!showAnswer
								? (
									<button
										onClick={handleReveal}
										className="btn-primary w-full bg-[#e6c642] before:bg-[#b89a1a] hover:bg-[#f0d45a] text-black py-4 text-xl font-black uppercase tracking-wide"
										style={{ fontFamily: 'PrintClearly, sans-serif' }}
									>
                            Reveal Answer
									</button>
								)
								: (
									<button
										onClick={handleContinueToScoring}
										className="btn-primary w-full bg-[#22c55e] before:bg-[#16a34a] hover:bg-[#2dd44d] py-4 text-xl font-black uppercase tracking-wide"
										style={{ fontFamily: 'PrintClearly, sans-serif' }}
									>
                            Continue →
									</button>
								)}
						</div>
					</div>
				</div>
			</GameWrapper>
		)
	}

	const ScoringScreen = () => {
		const movie = quizData.movies[currentMovieIndex]
		const question = movie.questions[currentQuestionIndex]
		const isLastQuestion = currentQuestionIndex >= movie.questions.length - 1
		const bgColor = BG_COLORS[currentQuestionIndex % BG_COLORS.length]

		return (
			<GameWrapper
				className="fixed inset-0 h-screen w-screen overflow-hidden flex items-center justify-center"
        style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: bgColor, backgroundBlendMode: 'multiply' }}
			>
				<div className="relative z-10 w-full max-w-3xl mx-auto px-4">
					<div className="bg-[#1a1f38] rounded-2xl p-8 flex flex-col gap-6" style={{ border: '3px solid #3b82f6' }}>
						{/* Correct answer */}
						<div className="text-center">
							<p className="text-lg uppercase tracking-widest text-blue-300 mb-3 font-black">Correct Answer</p>
							<div className="btn-primary inline-block bg-[#22c55e] before:bg-[#16a34a] text-white text-4xl font-black px-12 py-5 cursor-default" style={{ fontFamily: 'PrintClearly, sans-serif' }}>
								<FuriganaText text={question.correctAnswer || '(No answer set)'} gap="1.5em" />
							</div>
						</div>

						{/* Divider */}
						<div className="border-t-2 border-[#3b82f6]" />

						{/* Team marking */}
						<div>
							<p className="text-center text-white text-xl font-black mb-4 uppercase tracking-wide" style={{ fontFamily: 'PrintClearly, sans-serif' }}>Who got it right?</p>
							<div className="grid grid-cols-2 gap-3">
								{teams.map((t, idx) => {
									const color = t.color || TEAM_COLORS[idx % TEAM_COLORS.length]
									const marked = !!currentQuestionMarks[idx]
									return (
										<button
											key={idx}
											onClick={() => toggleTeamMark(idx)}
											className="team-btn py-5 px-6 text-xl uppercase tracking-wide flex items-center justify-center gap-3"
											style={marked
												? {
													'--team-color': '#22c55e',
													'--team-dark-color': '#16a34a'
												}
												: {
													'--team-color': color,
													'--team-dark-color': darken(color)
												}}
										>
											{/* Color circle indicator */}
											<div className="w-6 h-6 rounded-full border-2 border-white shrink-0" style={{ background: marked ? '#22c55e' : color }} />
											<span className="flex-1">{marked ? '✓ ' : ''}{t.name}</span>
										</button>
									)
								})}
							</div>
						</div>

						{/* Continue button */}
						{(() => {
							const count = Object.keys(currentQuestionMarks).length
							const goesToSplatoon = usingSplatoon && count >= 1
							const goesToRace = !usingSplatoon && count >= 2
							const label = goesToSplatoon
								? (count >= 2 ? 'Race → Splatoon!' : 'Splatoon!')
								: goesToRace
									? 'Race!'
									: isLastQuestion ? 'Finish Movie' : 'Continue'
							const btnColor = goesToSplatoon
								? 'bg-[#685af5] before:bg-[#4e3cc2] hover:bg-[#7b6ff7]'
								: goesToRace
									? 'bg-[#f94e4e] before:bg-[#c02020] hover:bg-[#ff6060]'
									: 'bg-[#3b82f6] before:bg-[#2563eb] hover:bg-[#5490f1]'
							const icon = goesToSplatoon ? '🦑 ' : goesToRace ? '🏎️ ' : ''
							return (
								<button
									onClick={handleContinueFromScoring}
									className={`btn-primary w-full py-5 text-2xl font-black text-white uppercase tracking-wide ${btnColor}`}
									style={{ fontFamily: 'PrintClearly, sans-serif' }}
								>
									<span className="relative" style={{ zIndex: 1 }}>
										{icon}{label}
									</span>
								</button>
							)
						})()}
					</div>
				</div>
			</GameWrapper>
		)
	}

	const GameOverScreen = () => {
		const TEAM_COLORS_GO = ['#3b82f6', '#f94e4e', '#685af5', '#3ce956', '#e6c642', '#a656fd', '#ff8c00', '#00c9c9']
		const sorted = [...teams].map((t, i) => ({ ...t, originalIdx: i })).sort((a, b) => b.score - a.score)
		const medals = ['🥇', '🥈', '🥉']
		const n = sorted.length
		// Each rank gets a flex-grow weight using sqrt so top ranks get noticeably more space
		const weight = (rank) => Math.sqrt(Math.max(1, n - rank))
		const totalDelay = n * 0.18 // used to delay the back button until all rows have appeared
		return (
		<GameWrapper className="fixed inset-0 h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#e6c642', backgroundBlendMode: 'multiply' }}>
				{/* Header */}
				<div className="shrink-0 flex items-center justify-center gap-4 py-4 px-6 bg-[#1a1f38] anim-drop-bounce" style={{ borderBottom: '3px solid #e6c642', animationDelay: '0s' }}>
					<span className="text-4xl">🏆</span>
					<h1 className="text-4xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '0.5px #e6c642' }}>Final Scores</h1>
				</div>

				{/* Team rows — centred column, proportional height, slide in left staggered */}
				<div className="flex-1 min-h-0 flex flex-col p-3 gap-2 max-w-3xl w-full mx-auto">
					{sorted.map((t, rank) => {
						const color = t.color || TEAM_COLORS_GO[t.originalIdx % TEAM_COLORS_GO.length]
						const w = weight(rank)
						// t_ = 1 at rank 0 (largest), 0 at last rank (smallest)
						const t_ = n > 1 ? 1 - rank / (n - 1) : 1
						const medalSize = (1.6 + t_ * 0.8).toFixed(2) + 'rem' // 1.6–2.4rem
						const nameSize = (0.85 + t_ * 0.75).toFixed(2) + 'rem' // 0.85–1.6rem
						const scoreSize = (1.1 + t_ * 1.1).toFixed(2) + 'rem' // 1.1–2.2rem
						const py = (4 + t_ * 10).toFixed(0) + 'px' // 4–14px
						const px = (10 + t_ * 14).toFixed(0) + 'px' // 10–24px
						const delay = `${(rank * 0.18).toFixed(2)}s`
						return (
							<div
								key={t.originalIdx}
								className="anim-slide-left flex items-center rounded-xl overflow-hidden"
								style={{
									flexGrow: w,
									flexBasis: 0,
									background: color,
									border: rank === 0 ? '3px solid #e6c642' : '2px solid transparent',
									boxShadow: rank === 0 ? '0 0 24px #e6c64244' : 'none',
									paddingTop: py,
									paddingBottom: py,
									paddingLeft: px,
									paddingRight: px,
									gap: '12px',
									animationDelay: delay
								}}
							>
								<span style={{ fontSize: medalSize, lineHeight: 1, minWidth: '2em', textAlign: 'center' }}>
									{medals[rank] || `${rank + 1}.`}
								</span>
								<span className="flex-1 font-black text-white uppercase tracking-wide truncate" style={{ fontFamily: 'PrintClearly, sans-serif', fontSize: nameSize }}>
									{t.name}
								</span>
								<span className="font-black text-white rounded-lg px-2 py-0.5" style={{ fontFamily: 'PrintClearly, sans-serif', fontSize: scoreSize, background: '#1a1f38' }}>
									{t.score}
								</span>
								<span className="text-white/70 font-bold" style={{ fontSize: `calc(${scoreSize} * 0.65)` }}>pts</span>
							</div>
						)
					})}
				</div>

				{/* Back button — appears after all teams have slid in */}
				<div className="shrink-0 p-3 pt-0 max-w-3xl w-full mx-auto anim-fade-up" style={{ animationDelay: `${totalDelay.toFixed(2)}s` }}>
					<button
						onClick={() => setGameState('grid')}
						className="btn-primary w-full py-3 text-lg font-black uppercase tracking-wide bg-[#3b82f6] before:bg-[#2563eb] hover:bg-[#5490f1]"
						style={{ fontFamily: 'PrintClearly, sans-serif' }}
					>
						<span style={{ position: 'relative', zIndex: 1 }}>← Back to Movie Menu</span>
					</button>
				</div>
			</GameWrapper>
		)
	}

	const RacePickerScreen = () => (
		<GameWrapper className="fixed inset-0 h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#f94e4e', backgroundBlendMode: 'multiply' }}>
			<div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
				{/* Header */}
				<div className="w-full">
					<div className="bg-[#1a1f38] rounded-2xl px-8 py-4 flex items-center justify-between" style={{ border: '3px solid #f94e4e' }}>
						<button onClick={() => setGameState('scoring')} className="btn-primary bg-[#685af5] before:bg-[#4e3cc2] px-5 py-2 text-sm font-bold uppercase">← Back</button>
						<div className="text-center">
							<h1 className="text-4xl md:text-5xl font-black text-white uppercase" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '0.5px white' }}>🏎️ Pick a Race!</h1>
						</div>
						<div className="w-20" />
					</div>
				</div>

				{/* Race grid — 7 cols × 2 rows fills the remaining screen */}
				<div className="flex-1 grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}>
					{RACES.map((race, rIdx) => {
						const borderColor = BG_COLORS[rIdx % BG_COLORS.length]
						return (
							<button
								key={race.dir}
								onClick={() => handleRaceSelect(race)}
								className="group relative rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.04] active:scale-95"
								style={{ border: `3px solid ${borderColor}`, background: '#1a1f38' }}
							>
								{/* Thumbnails load from /race/... which is served via SW cache in obscured builds.
                    If the pack hasn't loaded yet, this will just show the gradient overlay. */}
								<img
                  src={withBasePath(`/race/${race.dir}/thumbnail.webp`)}
									alt={race.name}
									className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
									onError={(e) => { e.target.style.display = 'none' }}
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
								<div className="absolute inset-x-0 bottom-0 p-2 text-center">
									<span className="text-white text-xs font-black leading-tight drop-shadow-lg uppercase">{race.name}</span>
								</div>
							</button>
						)
					})}
				</div>
			</div>

			{/* Non-blocking thumbnail preload indicator */}
			{raceThumbsLoading && (
				<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20 pointer-events-none">
					Loading race thumbnails…
				</div>
			)}
			{!raceThumbsLoading && raceThumbsError && (
				<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20 pointer-events-none">
					Race thumbnails not cached ({raceThumbsError}). Races may load slower.
				</div>
			)}
		</GameWrapper>
	)

	// RacingScreen is inlined directly in the return below (not a component)
	// so React never unmounts/remounts it during raceCountdown state changes,
	// which would otherwise reload the iframe on every countdown tick.

	const RaceResultsScreen = () => {
		// Dynamic point distribution: if N teams race, 1st gets N points, 2nd gets N-1, etc.
		// Special case: solo winner gets 3 points
		const numRacingTeams = raceFinishOrder.length
		const pointsTable = isSoloWinner
			? [3] // Solo winner gets 3 points
			: Array.from({ length: numRacingTeams }, (_, i) => numRacingTeams - i)
		const medals = ['🥇', '🥈', '🥉']

		// Dynamic row height based on position (higher position = smaller)
		const getRowHeight = (position) => {
			const baseHeight = 80
			const minHeight = 50
			const shrinkRate = 3 // pixels per position
			return Math.max(minHeight, baseHeight - position * shrinkRate)
		}

		// Helper to map team number back to team index
		const findTeamIndexByNumber = (numStr) => {
			const teamNumber = numStr === '0' ? 10 : parseInt(numStr, 10)
			if (isNaN(teamNumber)) return -1
			// Team number 1-10 maps to index 0-9
			return teamNumber - 1
		}

		// Compute race bonus per team index
		const raceBonus = {}
		raceFinishOrder.forEach((numStr, pos) => {
			const idx = findTeamIndexByNumber(numStr)
			if (idx !== -1) raceBonus[idx] = pointsTable[pos] ?? 0
		})

		// Sort by race finish position (1st, 2nd, 3rd…). Teams not in the finish list go last.
		const racePos = (t) => {
			const teamNumber = (t.idx % 10) + 1
			const numStr = teamNumber === 10 ? '0' : String(teamNumber)
			const p = raceFinishOrder.indexOf(numStr)
			return p === -1 ? 999 : p
		}

		// Leaderboard in race finish order (for initial appearance)
		const initialOrder = teams.map((t, idx) => ({
			...t, idx, bonus: raceBonus[idx] ?? 0, newScore: t.score + (raceBonus[idx] ?? 0)
		})).sort((a, b) => racePos(a) - racePos(b) || a.idx - b.idx)

		// Final order sorted by TOTAL SCORE (after adding race points)
		const finalOrder = [...initialOrder].sort((a, b) => {
			if (b.newScore !== a.newScore) return b.newScore - a.newScore // Higher score first
			return a.idx - b.idx // Tie-breaker: original team order
		})

		// Calculate Y offset AND height change for each team to move from initial to final position
		const getOffset = (teamIdx) => {
			const fromPos = initialOrder.findIndex(t => t.idx === teamIdx)
			const toPos = finalOrder.findIndex(t => t.idx === teamIdx)

			// Calculate cumulative height from top
			let fromY = 0
			for (let i = 0; i < fromPos; i++) {
				fromY += getRowHeight(i)
			}

			let toY = 0
			for (let i = 0; i < toPos; i++) {
				toY += getRowHeight(i)
			}

			return toY - fromY
		}

		// Phases:
		// 0 = rows fade in with current scores
		// 1 = show +points badges
		// 2 = count up scores to new values
		// 3 = shuffle rows to new order, show continue
		const [phase, setPhase] = useState(0)
		const [displayScores, setDisplayScores] = useState(() => {
			const s = {}; teams.forEach((t, i) => { s[i] = t.score }); return s
		})

		useEffect(() => {
			if (usingSplatoon) return // Splatoon mode uses a simple static view, no animation phases
			const timers = []
			// Phase 1: show +points
			timers.push(setTimeout(() => setPhase(1), 800 + initialOrder.length * 150))
			// Phase 2: count up scores
			timers.push(setTimeout(() => {
				setPhase(2)
				setDisplayScores(() => {
					const s = {}; teams.forEach((t, i) => { s[i] = t.score + (raceBonus[i] ?? 0) }); return s
				})
			}, 2000 + initialOrder.length * 150))
			// Phase 3: shuffle
			timers.push(setTimeout(() => setPhase(3), 3200 + initialOrder.length * 150))
			return () => timers.forEach(clearTimeout)
		}, [])

		// Splatoon mode: show a simple turn-order screen instead of the animated leaderboard
		if (usingSplatoon) {
			// Helper to map team number back to team
			const findTeamByNumber = (numStr) => {
				const teamNumber = numStr === '0' ? 10 : parseInt(numStr, 10)
				if (isNaN(teamNumber)) return null
				const teamIndex = teamNumber - 1
				return teams[teamIndex] || null
			}

			const turnColors = raceFinishOrder
				.map(numStr => findTeamByNumber(numStr))
				.filter(Boolean)
			const turnMedals = ['🥇', '🥈', '🥉']
			const n = turnColors.length

			// Scale font/padding down as team count grows
			const nameFontSize = Math.max(0.9, 2.2 - (n - 4) * 0.14) // rem
			const medalFontSize = Math.max(1.2, 2.2 - (n - 4) * 0.14) // rem
			const badgeFontSize = Math.max(0.6, 0.85 - (n - 4) * 0.025) // rem
			const rowPadX = Math.max(8, 20 - (n - 4) * 1.5) // px
			const rowPadY = Math.max(2, 12 - (n - 4) * 1.2) // px

			return (
				<GameWrapper
					className="fixed inset-0 h-screen w-screen overflow-hidden flex flex-col items-center"
          style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#685af5', backgroundBlendMode: 'multiply' }}
				>
					{/* Header */}
					<div className="shrink-0 text-center anim-drop-bounce pt-6 pb-2">
						<h2 className="text-5xl md:text-6xl font-black text-white uppercase" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>🏁 Race Done!</h2>
						<p className="text-purple-300 text-lg font-black uppercase mt-1">Turn order set for the Splatoon map</p>
					</div>

					{/* Turn order list — fills remaining height */}
					<div className="flex-1 min-h-0 w-full max-w-lg flex flex-col px-4 py-2" style={{ gap: '6px' }}>
						<p className="shrink-0 text-white font-black uppercase tracking-wide text-center text-lg mb-1" style={{ fontFamily: 'PrintClearly, sans-serif' }}>Map Turn Order</p>
						<div className="flex-1 min-h-0 flex flex-col" style={{ gap: '6px' }}>
							{turnColors.map((t, pos) => (
								<div
									key={t.splatoonId}
									className="flex-1 min-h-0 flex items-center rounded-xl anim-fade-up"
									style={{
										background: t.color,
										border: '3px solid rgba(255,255,255,0.2)',
										animationDelay: `${pos * 0.08}s`,
										paddingLeft: rowPadX,
										paddingRight: rowPadX,
										paddingTop: rowPadY,
										paddingBottom: rowPadY,
										gap: '12px'
									}}
								>
									<span style={{ fontSize: medalFontSize + 'rem', width: '2rem', textAlign: 'center', lineHeight: 1 }}>
										{pos < 3 ? turnMedals[pos] : `${pos + 1}.`}
									</span>
									{/* Color circle indicator */}
									<div className="w-8 h-8 rounded-full border-2 border-white shrink-0" style={{ background: t.color }} />
									<span className="font-black text-white flex-1 truncate" style={{ fontFamily: 'PrintClearly, sans-serif', fontSize: nameFontSize + 'rem', lineHeight: 1.1 }}>{t.name}</span>
									<span className="text-white/80 font-bold uppercase shrink-0" style={{ fontSize: badgeFontSize + 'rem' }}>
                    Goes {pos === 0 ? '1st' : pos === 1 ? '2nd' : pos === 2 ? '3rd' : `${pos + 1}th`}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* Button */}
					<div className="shrink-0 pb-6 anim-bounce-in" style={{ animationDelay: `${turnColors.length * 0.08 + 0.3}s` }}>
						<button
							onClick={handleApplyRacePoints}
							className="btn-primary bg-[#22c55e] before:bg-[#16a34a] hover:bg-[#2dd44d] px-16 py-5 text-2xl font-black text-white uppercase tracking-wide"
							style={{ fontFamily: 'PrintClearly, sans-serif' }}
						>
							<span style={{ position: 'relative', zIndex: 1 }}>🦑 Go to Map</span>
						</button>
					</div>
				</GameWrapper>
			)
		}

		// Calculate container height - adjust based on phase
		const containerHeight = phase >= 3
			? finalOrder.reduce((sum, _, i) => sum + getRowHeight(i), 0)
			: initialOrder.reduce((sum, _, i) => sum + getRowHeight(i), 0)

		return (
			<GameWrapper
				className="fixed inset-0 h-screen w-screen overflow-hidden"
        style={{ backgroundImage: `url('${withBasePath('/play_bg.webp')}')`, backgroundColor: '#f94e4e', backgroundBlendMode: 'multiply' }}
			>
				<div className="min-h-screen flex flex-col items-center justify-center p-6">

					{/* Single animated leaderboard with title integrated */}
					<div className="w-full max-w-lg bg-[#1a1f38] rounded-2xl p-5" style={{ border: '3px solid #3b82f6' }}>
						<h2 className="text-4xl font-black text-white uppercase text-center mb-4 anim-drop-bounce" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>🏁 Race Results</h2>
						<div className="relative" style={{ height: `${containerHeight}px`, transition: phase >= 3 ? 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none' }}>
							{initialOrder.map((t, initialPos) => {
								const color = t.color || TEAM_COLORS[t.idx % TEAM_COLORS.length]
								const offset = phase >= 3 ? getOffset(t.idx) : 0
								const pts = t.bonus

								// Get final position for this team (for medal and height after shuffle)
								const finalPos = finalOrder.findIndex(team => team.idx === t.idx)
								const medal = phase >= 3 && finalPos >= 0 && finalPos < 3 ? medals[finalPos] : null

								// Height during animation
								const currentHeight = phase >= 3 ? getRowHeight(finalPos) : getRowHeight(initialPos)

								// Calculate initial Y position (cumulative height before this position)
								let initialY = 0
								for (let i = 0; i < initialPos; i++) {
									initialY += getRowHeight(i)
								}

								return (
								// Outer div: handles absolute position + shuffle translateY + height change
									<div
										key={t.idx}
										className="absolute left-0 right-0"
										style={{
											height: `${currentHeight - 8}px`,
											top: `${initialY}px`,
											transform: phase >= 3 ? `translateY(${offset}px)` : 'translateY(0)',
											transition: phase >= 3 ? 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
										}}
									>
										<div
											className="w-full h-full flex items-center gap-3 rounded-xl px-4 overflow-hidden"
											style={{
												background: color,
												border: '3px solid rgba(255,255,255,0.2)',
												animation: 'fadeSlideUp 0.35s ease both',
												animationDelay: `${initialPos * 0.12}s`
											}}
										>
											{/* Medal or rank */}
											<span className="text-2xl w-8 text-center font-black text-white">
												{medal || `${(phase >= 3 ? finalPos : initialPos) + 1}.`}
											</span>

											{/* Color circle indicator */}
											<div className="w-6 h-6 rounded-full border-2 border-white shrink-0" style={{ background: color }} />

											{/* Team name */}
											<span className="font-black text-white flex-1 truncate" style={{ fontFamily: 'PrintClearly, sans-serif', fontSize: phase >= 3 ? `${Math.max(1, 1.25 - finalPos * 0.05)}rem` : '1.25rem' }}>{t.name}</span>

											{/* +points badge */}
											{phase >= 1 && pts > 0 && (
												<span
													className="font-black px-2 py-0.5 rounded-lg anim-pop-in"
													style={{ background: '#22c55e', color: 'white', fontSize: phase >= 3 ? `${Math.max(0.875, 1 - finalPos * 0.04)}rem` : '1rem' }}
												>
                          +{pts}
												</span>
											)}

											{/* Score */}
											<span
												className="font-black text-white rounded-lg px-2 py-0.5 min-w-[50px] text-center"
												style={{
													fontFamily: 'PrintClearly, sans-serif',
													fontSize: phase >= 3 ? `${Math.max(1.5, 1.875 - finalPos * 0.08)}rem` : '1.875rem',
													transition: 'color 0.4s ease, font-size 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
													color: phase >= 2 && pts > 0 ? '#86efac' : 'white',
													background: '#1a1f38'
												}}
											>
												{displayScores[t.idx] ?? t.score}
											</span>
										</div>
									</div>
								)
							})}
						</div>
					</div>

				</div>

				{/* Continue button — fixed to bottom-right corner, appears after shuffle */}
				{phase >= 3 && (
					<button
						onClick={handleApplyRacePoints}
						className="fixed bottom-6 right-6 btn-primary bg-[#22c55e] before:bg-[#16a34a] hover:bg-[#2dd44d] px-8 py-4 text-xl font-black text-white uppercase tracking-wide anim-bounce-in shadow-2xl"
						style={{ fontFamily: 'PrintClearly, sans-serif', zIndex: 50 }}
					>
						<span style={{ position: 'relative', zIndex: 1 }}>▶ Continue</span>
					</button>
				)}
			</GameWrapper>
		)
	}

	return (
		<>
			<Head>
				<title>Scene It - Game</title>
				<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
			</Head>
			{gameState === 'upload' && <UploadScreen />}
			{gameState === 'teams' && <TeamsScreen />}
			{gameState === 'grid' && <GridScreen />}

			{/* Blur-reveal overlay — shown on top of grid when a blurred-poster card is clicked */}
			{gameState === 'grid' && blurRevealIndex !== null && (() => {
				const bm = quizData.movies[blurRevealIndex]
				const posterUrl = getAssetUrl(bm.poster)
				return (
					<div
						className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
						style={{ background: 'rgba(10,14,30,0.95)' }}
						onClick={() => { setBlurRevealIndex(null); handleMovieSelect(blurRevealIndex) }}
					>
						<img
							src={posterUrl}
							alt={bm.title}
							className="rounded-2xl shadow-2xl"
							style={{
								maxHeight: '78vh',
								maxWidth: '90vw',
								objectFit: 'contain',
								border: '4px solid #3b82f6',
								filter: blurUnblurred ? 'blur(0px)' : 'blur(48px)',
								transform: blurUnblurred ? 'scale(1)' : 'scale(1.08)',
								transition: 'filter 2s cubic-bezier(0.4,0,0.2,1), transform 2s cubic-bezier(0.4,0,0.2,1)'
							}}
						/>
						<p
							className="text-white text-2xl font-black uppercase mt-6"
							style={{
								fontFamily: 'PrintClearly, sans-serif',
								opacity: blurUnblurred ? 1 : 0,
								transition: 'opacity 0.6s ease 1.6s'
							}}
						>
              🎬 Click anywhere to watch
						</p>
					</div>
				)
			})()}

			{/* MovieScreen inlined — stable <div> keeps <video> alive across state changes */}
			{gameState === 'movie' && currentMovieIndex !== null && (() => {
				const movie = quizData.movies[currentMovieIndex]
				const videoUrl = getAssetUrl(movie.video)
				return (
					<div className="fixed inset-0 bg-black z-50 flex flex-col h-screen w-screen overflow-hidden">
						<div className="flex-grow w-full h-full relative bg-black flex items-center justify-center">
							{videoUrl && hasWindow
								? (
									<div className="w-full h-full absolute inset-0">
										<video
											src={videoUrl}
											controls
											autoPlay
											playsInline
											preload="auto"
											controlsList="nodownload"
											className="w-full h-full"
											style={{ objectFit: 'contain', backgroundColor: 'black' }}
										/>
									</div>
								)
								: (
									<div className="flex flex-col items-center justify-center h-full text-white">
										<div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4" />
										<p className="text-xl">Loading Media...</p>
										<p className="text-sm text-gray-500 mt-2">{movie.video ? 'Preparing video...' : 'No video file specified'}</p>
									</div>
								)}
						</div>
						<div className="h-20 bg-[#1a1f38] flex items-center justify-between px-8 shrink-0 z-50" style={{ borderTop: '3px solid #3b82f6' }}>
							<div className="text-white font-black text-lg uppercase" style={{ fontFamily: 'PrintClearly, sans-serif' }}>
								{movie.questions.length} Question{movie.questions.length !== 1 ? 's' : ''} to follow
							</div>
							<button
								onClick={handleMovieFinished}
								className="btn-primary text-xl px-8 py-3 font-black uppercase tracking-wide"
								style={{ fontFamily: 'PrintClearly, sans-serif' }}
							>
                Go to Questions →
							</button>
						</div>
					</div>
				)
			})()}
			{gameState === 'questions' && <QuestionScreen />}
			{gameState === 'scoring' && <ScoringScreen />}
			{gameState === 'gameOver' && <GameOverScreen />}
			{gameState === 'racePicker' && <RacePickerScreen />}
			{/* RacingScreen is inlined (not a sub-component) to keep the iframe stable during raceCountdown re-renders */}
			{gameState === 'racing' && (() => {
        const raceUrl = withBasePath(`/race/${selectedRace?.dir}/index.html?countdown=00:00:10&characters=${racingTeamNames.length || teams.length}&volume=20`)
				return (
					<div className="fixed inset-0 z-50 bg-black flex flex-col">
						<div className="h-12 bg-[#1a1f38] flex items-center px-4 gap-4 shrink-0 z-50" style={{ borderBottom: '3px solid #f94e4e' }}>
							<button onClick={() => setGameState('racePicker')} className="btn-primary bg-[#685af5] before:bg-[#4e3cc2] px-4 py-1 text-sm font-bold uppercase">Back</button>
							<span className="text-white font-black text-lg uppercase" style={{ fontFamily: 'PrintClearly, sans-serif' }}>{selectedRace?.emoji} {selectedRace?.name}</span>
						</div>
						<div className="flex-1 relative">
							<iframe ref={iframeRef} src={raceUrl} className="w-full h-full border-none" title={`Race: ${selectedRace?.name}`} allow="autoplay" />
							{raceCountdown !== null && (
								<div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(28,35,58,0.9)' }}>
									<div className="text-center">
										<div className="text-[12rem] font-black text-white leading-none" style={{ fontFamily: 'PrintClearly, sans-serif', WebkitTextStroke: '3px #f94e4e', textShadow: '0 0 60px #f94e4e' }}>{raceCountdown}</div>
										<p className="text-white text-3xl font-black uppercase mt-4" style={{ fontFamily: 'PrintClearly, sans-serif' }}>Race Over!</p>
									</div>
								</div>
							)}
						</div>
					</div>
				)
			})()}
			{gameState === 'raceResults' && <RaceResultsScreen />}

			{/* Splatoon iframe — race-ordered teams take turns on the map; map state persists via localStorage */}
			{gameState === 'splatoon' && (() => {
        const splatUrl = withBasePath(`/splatoon/index.html?quizMode=1&numTeams=${teams.length}&activeTeams=${currentSplatoonActiveIds.join(',')}`)
				return (
					<div className="fixed inset-0 z-50 bg-black flex flex-col">
						<div className="h-12 bg-[#1a1f38] flex items-center px-4 gap-4 shrink-0" style={{ borderBottom: '3px solid #685af5' }}>
							<button onClick={() => setGameState('raceResults')} className="btn-primary bg-[#685af5] before:bg-[#4e3cc2] px-4 py-1 text-sm font-bold uppercase">← Back</button>
							<span className="text-white font-black text-lg uppercase" style={{ fontFamily: 'PrintClearly, sans-serif' }}>🦑 Splatoon Round</span>
							{/* Turn order hint */}
							<span className="text-purple-300 text-sm font-bold hidden md:block">
                Turn order: {currentSplatoonActiveIds.map(id => teams.find(t => t.splatoonId === id)?.name).filter(Boolean).join(' → ')}
							</span>
							{/* Rules button — always visible */}
							<button
								onClick={() => setShowRulesModal(true)}
								className="btn-primary bg-[#e6c642] before:bg-[#b89a1a] px-4 py-1 text-sm font-black uppercase"
								style={{ marginLeft: 'auto' }}
							>📖 ルール</button>
							{/* Manual Continue — only shown after round ends */}
							{splatoonRoundDone && (
								<button
									onClick={handleSplatoonContinue}
									className="btn-primary bg-[#22c55e] before:bg-[#16a34a] hover:bg-[#2dd44d] px-6 py-1 text-sm font-black uppercase animate-pulse"
									style={{ fontFamily: 'PrintClearly, sans-serif' }}
								>
                  ▶ Continue
								</button>
							)}
							{!splatoonRoundDone && (
								<span className="text-purple-300 text-sm font-bold">
									{currentSplatoonActiveIds.length} team{currentSplatoonActiveIds.length !== 1 ? 's' : ''} playing
								</span>
							)}
						</div>
						<div className="flex-1 relative">
							<iframe
								src={splatUrl}
								className="w-full h-full border-none"
								title="Splatoon Map Round"
								allow="autoplay"
							/>
						</div>
						{/* Rules modal */}
						{showRulesModal && (
							<div
								className="absolute inset-0 z-50 flex items-center justify-center"
								style={{ background: 'rgba(10,14,30,0.85)' }}
								onClick={() => setShowRulesModal(false)}
							>
								<div
									className="bg-[#1a1f38] rounded-2xl p-8 max-w-lg w-full mx-4 flex flex-col gap-5"
									style={{ border: '3px solid #685af5' }}
									onClick={e => e.stopPropagation()}
								>
									<h2 className="text-3xl font-black text-white uppercase text-center" style={{ fontFamily: 'PrintClearly, sans-serif' }}>📖 ルール</h2>
									<ul className="flex flex-col gap-4">
										{[
											'都道府県を１つ選んで支配できます。',
											'すでに都道府県を持っている場合は、隣接する都道府県かフェリー路線でつながっている都道府県を選ばなければなりません。',
											'自分の都道府県に隣接する相手チームの都道府県を奪取しようとすることができます。奪取するにはじゃんけんに勝つ必要があります。',
											'チームのスコアは、日本のどれだけを支配しているかの合計です。'
										].map((rule, i) => (
											<li key={i} className="flex items-start gap-3">
												<span className="text-2xl mt-0.5">{['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]}</span>
												<span className="text-white text-lg leading-snug" style={{ fontFamily: 'sans-serif' }}>{rule}</span>
											</li>
										))}
									</ul>
									<button
										onClick={() => setShowRulesModal(false)}
										className="btn-primary bg-[#685af5] before:bg-[#4e3cc2] px-8 py-3 font-black uppercase text-white self-center"
									>
										<span style={{ position: 'relative', zIndex: 1 }}>閉じる</span>
									</button>
								</div>
							</div>
						)}
					</div>
				)
			})()}
		</>
	)
}
