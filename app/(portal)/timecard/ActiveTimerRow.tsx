'use client'

import { useState, useEffect } from 'react'

const ActiveTimerRow = () => {
	const [isRunning, setIsRunning] = useState(false)
	const [elapsedTime, setElapsedTime] = useState(0)

	useEffect(() => {
		let intervalId: NodeJS.Timeout | null = null

		if (isRunning) {
			intervalId = setInterval(() => {
				setElapsedTime((prevTime) => prevTime + 1)
			}, 1000)
		} else {
			if (intervalId) {
				clearInterval(intervalId)
			}
		}

		return () => {
			if (intervalId) {
				clearInterval(intervalId)
			}
		}
	}, [isRunning])

	const toggleTimer = () => {
		setIsRunning(!isRunning)
	}

	const formatTime = (timeInSeconds: number): string => {
		const hours = Math.floor(timeInSeconds / 3600)
		const minutes = Math.floor((timeInSeconds % 3600) / 60)
		const seconds = timeInSeconds % 60

		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
			2,
			'0'
		)}:${String(seconds).padStart(2, '0')}`
	}

	return (
		<div className="flex items-center space-x-4">
			<select className="border rounded px-2 py-1">
				<option>Client</option>
				{/* Fetch clients from Supabase here */}
			</select>

			<select className="border rounded px-2 py-1">
				<option>Work Type Level 1</option>
				{/* Fetch work types from Supabase here */}
			</select>

			<select className="border rounded px-2 py-1">
				<option>Work Type Level 2</option>
				{/* Fetch work types from Supabase here */}
			</select>

			<input
				type="text"
				placeholder="Description"
				className="border rounded px-2 py-1 w-1/3"
			/>

			<label className="flex items-center space-x-2">
				<input type="checkbox" className="border rounded" />
				<span>Billable</span>
			</label>

			<button
				className={`px-4 py-2 rounded ${
					isRunning ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
				}`}
				onClick={toggleTimer}
				disabled={false}
			>
				{isRunning ? (
					<>
						<span>■</span> Stop {formatTime(elapsedTime)}
					</>
				) : (
					<>
						<span>▶</span> Start
					</>
				)}
			</button>

			<div>
				{isRunning && (
					<span className="text-3xl font-bold">
						{formatTime(elapsedTime)}
					</span>
				)}
			</div>
		</div>
	)
}

export default ActiveTimerRow

// TODO: Fetch active time entry from Supabase and load initial state
// TODO: Handle start/stop actions by inserting/updating time entries in Supabase