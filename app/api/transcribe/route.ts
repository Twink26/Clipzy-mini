import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import ytdl from 'ytdl-core'
import fs from 'fs'
import path from 'path'
import { createWriteStream } from 'fs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Add timeout and retry configuration
  timeout: 300000, // 5 minutes for long videos
  maxRetries: 2,
})

// Helper to extract YouTube video ID
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Helper to download and convert audio
async function downloadAudio(videoId: string): Promise<{ path: string; format: string }> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const tempDir = path.join(process.cwd(), 'temp')
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  // ytdl-core downloads in webm or m4a format for audio-only
  // We'll use .webm as default, but Whisper supports multiple formats
  const audioPath = path.join(tempDir, `${videoId}.webm`)
  
  // Check if audio already exists
  if (fs.existsSync(audioPath)) {
    return { path: audioPath, format: 'webm' }
  }

  return new Promise((resolve, reject) => {
    let detectedFormat = 'webm'
    
    const videoStream = ytdl(videoUrl, {
      quality: 'lowestaudio',
      filter: 'audioonly',
    })

    const writeStream = createWriteStream(audioPath)
    
    videoStream.on('info', (info) => {
      // Determine format from the stream
      detectedFormat = info.container || 'webm'
    })
    
    videoStream.pipe(writeStream)
    
    videoStream.on('error', (err) => {
      reject(new Error(`Failed to download audio: ${err.message}`))
    })
    
    writeStream.on('error', (err) => {
      reject(new Error(`Failed to save audio: ${err.message}`))
    })
    
    writeStream.on('finish', () => {
      if (!fs.existsSync(audioPath)) {
        reject(new Error('Audio file was not created'))
      } else {
        resolve({ path: audioPath, format: detectedFormat })
      }
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }
    
    // Verify API key format (should start with sk-)
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. API keys should start with "sk-"' },
        { status: 500 }
      )
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    // Download audio
    const { path: audioPath, format } = await downloadAudio(videoId)

    // Determine MIME type based on format
    const mimeTypes: Record<string, string> = {
      webm: 'audio/webm',
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      mp4: 'audio/mp4',
    }
    const mimeType = mimeTypes[format] || 'audio/webm'

    // Read file as Buffer and create File object
    // The OpenAI SDK works best with File objects in Node.js 18+
    const audioBuffer = fs.readFileSync(audioPath)
    const fileStats = fs.statSync(audioPath)
    
    console.log('Starting transcription for video:', videoId)
    console.log('Audio file path:', audioPath)
    console.log('File size:', fileStats.size, 'bytes')
    console.log('File format:', format)
    
    // Create File object - Node.js 18+ has File API
    const audioFile = new File([audioBuffer], `${videoId}.${format}`, {
      type: mimeType,
    })

    // Transcribe using Whisper
    // Try File object first (Node.js 18+)
    let transcription
    try {
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      })
      console.log('Transcription successful')
    } catch (fileError: any) {
      console.error('File approach failed, trying ReadStream:', fileError.message)
      // Fallback to ReadStream
      const audioStream = fs.createReadStream(audioPath)
      transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      })
      console.log('ReadStream approach successful')
    }

    // Clean up audio file
    try {
      fs.unlinkSync(audioPath)
    } catch (err) {
      console.error('Failed to delete temp audio file:', err)
    }

    // Format response
    const segments = (transcription as any).segments?.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })) || []

    return NextResponse.json({
      text: transcription.text,
      segments,
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    })
  } catch (error: any) {
    console.error('Transcription error:', error)
    console.error('Error stack:', error.stack)
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Failed to transcribe video'
    
    if (error.message?.includes('Connection error') || error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to OpenAI API. Please check your internet connection and API key.'
    } else if (error.status === 401) {
      errorMessage = 'Invalid OpenAI API key. Please check your API key in .env.local'
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
    } else if (error.status === 413 || error.message?.includes('too large')) {
      errorMessage = 'Audio file is too large. Please try a shorter video.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          originalError: error.message,
          status: error.status,
          code: error.code,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    )
  }
}

