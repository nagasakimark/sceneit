import JSZip from 'jszip'

function guessMimeType (path) {
	const ext = (path.split('.').pop() || '').toLowerCase()

	// Video
	if (ext === 'mp4' || ext === 'm4v') return 'video/mp4'
	if (ext === 'webm') return 'video/webm'
	if (ext === 'ogv' || ext === 'ogg') return 'video/ogg'
	if (ext === 'mov') return 'video/quicktime'

	// Images
	if (ext === 'png') return 'image/png'
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
	if (ext === 'gif') return 'image/gif'
	if (ext === 'webp') return 'image/webp'
	if (ext === 'svg') return 'image/svg+xml'

	// Audio
	if (ext === 'mp3') return 'audio/mpeg'
	if (ext === 'wav') return 'audio/wav'
	if (ext === 'oga') return 'audio/ogg'

	return ''
}

export async function loadQuizZip (file) {
	const zip = await JSZip.loadAsync(file)

	// Read quiz.json
	const jsonFile = zip.file('quiz.json')
	if (!jsonFile) throw new Error('Invalid quiz file: missing quiz.json')

	const quizData = JSON.parse(await jsonFile.async('string'))

	// Process assets
	const assets = {}
	const assetFolder = zip.folder('assets')

	if (assetFolder) {
		const files = []
		assetFolder.forEach((relativePath, file) => {
			files.push({ path: relativePath, file })
		})

		await Promise.all(files.map(async ({ path, file }) => {
			// JSZip's `blob` loses the original MIME type, which can break
			// blob-url playback for <video>. Re-create a typed Blob.
			const data = await file.async('uint8array')
			const mimeType = guessMimeType(path)
			const blob = new Blob([data], mimeType ? { type: mimeType } : undefined)
			const url = URL.createObjectURL(blob)
			assets[`assets/${path}`] = url
		}))
	}

	return { quizData, assets }
}
