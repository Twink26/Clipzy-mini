export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  duration: number
}

export interface ViralMoment {
  timestamp: number
  endTime: number
  type: 'spicy' | 'joke' | 'emotional' | 'viral'
  description: string
  quote: string
  confidence: number
}

