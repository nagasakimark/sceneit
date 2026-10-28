import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import SceneItEditor from '@/components/Editor/SceneIt/SceneItEditor'

export default function EditorPage () {
	const [selectedType, setSelectedType] = useState(null)

	return (
		<div className="min-h-screen bg-[#1c233a]  text-white font-sans">
			<Head>
				<title>Quizi Editor</title>
			</Head>

			{!selectedType && (
				<div className="container mx-auto px-4 py-10">
					<div className="flex justify-between items-center mb-10">
						<h1 className="text-4xl font-bold">Quiz Creator</h1>
						<Link href="/" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded">
              Back to Home
						</Link>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div
							onClick={() => setSelectedType('scene-it')}
							className="bg-gray-800 p-6 rounded-xl hover:bg-gray-700 cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all"
						>
							<h2 className="text-2xl font-bold mb-2">Scene It</h2>
							<p className="text-gray-400">
                Identify movies from clips, answer questions, and reveal posters. Perfect for movie buffs.
							</p>
						</div>
						{/* Future types here */}
					</div>
				</div>
			)}

			{selectedType && (
				<div>
					<div className="bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
						<h2 className="text-xl font-bold text-gray-400">Editor: {selectedType === 'scene-it' && 'Scene It'}</h2>
						<button
							onClick={() => setSelectedType(null)}
							className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
						>
              Close Editor
						</button>
					</div>
					{selectedType === 'scene-it' && <SceneItEditor />}
				</div>
			)}
		</div>
	)
}
