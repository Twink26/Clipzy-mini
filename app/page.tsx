'use client'

import { useState } from 'react'
import YouTubeInput from '@/components/YouTubeInput'
import ResultsDisplay from '@/components/ResultsDisplay'
import type { ViralMoment, TranscriptionResult } from '@/types'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null)
  const [viralMoments, setViralMoments] = useState<ViralMoment[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async (youtubeUrl: string) => {
    setLoading(true)
    setError(null)
    setTranscription(null)
    setViralMoments([])

    try {
      // Step 1: Extract and transcribe
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      }).catch((fetchError) => {
        throw new Error(`Network error: ${fetchError.message}. Make sure the server is running and accessible.`)
      })

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json()
        throw new Error(errorData.error || 'Failed to transcribe video')
      }

      const transcribeData: TranscriptionResult = await transcribeResponse.json()
      setTranscription(transcribeData)

      // Step 2: Find viral moments
      const momentsResponse = await fetch('/api/find-moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcription: transcribeData.text,
          segments: transcribeData.segments 
        }),
      })

      if (!momentsResponse.ok) {
        const errorData = await momentsResponse.json()
        throw new Error(errorData.error || 'Failed to find viral moments')
      }

      const momentsData: { moments: ViralMoment[] } = await momentsResponse.json()
      setViralMoments(momentsData.moments)
    } catch (err) {
      console.error('Error:', err)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Connection error: Could not reach the server. Make sure the development server is running.')
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Clipzy Mini
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            AI Podcast Summarizer & Viral Clip Finder
          </p>
          <p className="text-gray-400">
            Paste a YouTube link → Auto-transcribe → Find viral moments
          </p>
        </div>

        <YouTubeInput onAnalyze={handleAnalyze} loading={loading} />

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <ResultsDisplay 
          transcription={transcription}
          viralMoments={viralMoments}
          loading={loading}
        />
      </div>
    </main>
  )
}

