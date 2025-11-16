'use client'

import type { TranscriptionResult, ViralMoment } from '@/types'

interface ResultsDisplayProps {
  transcription: TranscriptionResult | null
  viralMoments: ViralMoment[]
  loading: boolean
}

export default function ResultsDisplay({ transcription, viralMoments, loading }: ResultsDisplayProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTypeColor = (type: ViralMoment['type']) => {
    switch (type) {
      case 'spicy':
        return 'bg-red-900/50 text-red-300 border-red-700'
      case 'joke':
        return 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
      case 'emotional':
        return 'bg-purple-900/50 text-purple-300 border-purple-700'
      case 'viral':
        return 'bg-green-900/50 text-green-300 border-green-700'
      default:
        return 'bg-gray-700 text-gray-300 border-gray-600'
    }
  }

  const getTypeIcon = (type: ViralMoment['type']) => {
    switch (type) {
      case 'spicy':
        return '🔥'
      case 'joke':
        return '😂'
      case 'emotional':
        return '💜'
      case 'viral':
        return '📈'
      default:
        return '⭐'
    }
  }

  if (loading && !transcription) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        <p className="mt-4 text-gray-300">Processing video...</p>
      </div>
    )
  }

  if (!transcription && !viralMoments.length) {
    return null
  }

  return (
    <div className="space-y-8">
      {transcription && (
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4">Transcription</h2>
          <div className="bg-gray-900 rounded-lg p-6 max-h-96 overflow-y-auto border border-gray-700">
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              {transcription.text}
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Duration: {formatTime(transcription.duration)}
          </p>
        </div>
      )}

      {viralMoments.length > 0 && (
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">
            Viral Moments Found
            <span className="ml-3 text-lg font-normal text-gray-400">
              ({viralMoments.length})
            </span>
          </h2>
          <div className="grid gap-6">
            {viralMoments.map((moment, index) => (
              <div
                key={index}
                className="border-2 border-gray-700 rounded-xl p-6 hover:border-gray-600 hover:shadow-lg transition-all bg-gray-900/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTypeIcon(moment.type)}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getTypeColor(moment.type)}`}>
                      {moment.type.toUpperCase()}
                    </span>
                    <span className="text-lg font-mono font-semibold text-primary-400">
                      {formatTime(moment.timestamp)} - {formatTime(moment.endTime)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {Math.round(moment.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-gray-200 font-medium mb-2">{moment.description}</p>
                <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-300">
                  "{moment.quote}"
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && transcription && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-gray-300">Finding viral moments...</p>
        </div>
      )}
    </div>
  )
}

