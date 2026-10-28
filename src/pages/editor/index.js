import Head from 'next/head'
import QuizMaker from '@/components/Editor/SceneIt/QuizMaker'

export default function EditorPage () {
	return (
		<div className="min-h-screen bg-th-surface text-white font-sans">
			<Head>
				<title>Quiz Maker</title>
			</Head>
			<QuizMaker />
		</div>
	)
}
