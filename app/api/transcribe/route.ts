import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import ytdl from '@distube/ytdl-core'
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
    let downloadStarted = false
    
    // Try different quality options if the first one fails
    const tryDownload = (options: any, attempt: number = 1) => {
      console.log(`Download attempt ${attempt} for video: ${videoId}`)
      
      try {
        const videoStream = ytdl(videoUrl, {
          ...options,
          quality: options.quality || 'lowestaudio',
          filter: options.filter || 'audioonly',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          },
        })

        const writeStream = createWriteStream(audioPath)
        
        videoStream.on('info', (info) => {
          downloadStarted = true
          console.log('Video info received:', {
            title: info.videoDetails.title,
            length: info.videoDetails.lengthSeconds,
            container: info.container
          })
          detectedFormat = info.container || 'webm'
        })
        
        videoStream.pipe(writeStream)
        
        videoStream.on('error', (err: any) => {
          console.error(`Stream error (attempt ${attempt}):`, err.message)
          console.error('Error details:', {
            code: err.code,
            statusCode: err.statusCode,
            message: err.message
          })
          
          // Clean up failed download
          if (fs.existsSync(audioPath)) {
            try {
              fs.unlinkSync(audioPath)
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          
          // Detect specific error types (but don't assume 403 = age-restricted)
          const errorMsg = err.message?.toLowerCase() || ''
          const isAgeRestricted = errorMsg.includes('age') && errorMsg.includes('restricted')
          const isRegionLocked = errorMsg.includes('region') || errorMsg.includes('country') || errorMsg.includes('not available')
          const isPrivate = errorMsg.includes('private') || errorMsg.includes('unavailable')
          const is403 = err.statusCode === 403
          
          // 403 can mean many things - try different methods before giving up
          // Don't assume it's age-restricted
          if (attempt === 1) {
            console.log('Trying alternative download method (attempt 2)...')
            // Try with different quality
            tryDownload({ quality: 'highestaudio', filter: 'audioonly' }, 2)
          } else if (attempt === 2) {
            console.log('Trying alternative download method (attempt 3)...')
            // Try without audio filter - get video and extract audio
            tryDownload({ quality: 'lowest', filter: 'audioandvideo' }, 3)
          } else if (attempt === 3 && is403) {
            console.log('Trying alternative download method (attempt 4) - using getInfo...')
            // Last resort: try using getInfo first, then download
            ytdl.getInfo(videoId).then((info) => {
              const format = info.formats.find((f: any) => f.hasAudio && !f.hasVideo && f.audioBitrate)
              if (format) {
                const audioStream = ytdl.downloadFromInfo(info, { format: format })
                const writeStream = createWriteStream(audioPath)
                audioStream.pipe(writeStream)
                
                audioStream.on('error', (streamErr: any) => {
                  reject(new Error(`Failed to download: ${streamErr.message}. YouTube may be blocking automated downloads. Try a different video or check if the video is accessible in your browser.`))
                })
                
                writeStream.on('finish', () => {
                  if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
                    resolve({ path: audioPath, format: format.container || 'webm' })
                  } else {
                    reject(new Error('Download failed. YouTube may be blocking automated downloads.'))
                  }
                })
              } else {
                reject(new Error('No suitable audio format found. YouTube may be blocking automated downloads.'))
              }
            }).catch((infoErr: any) => {
              reject(new Error(`Failed to download: ${err.message}. YouTube may be blocking automated downloads (403 error). This is not necessarily an age-restriction issue - YouTube sometimes blocks automated access.`))
            })
          } else {
            // Provide specific error message
            let specificError = 'YouTube may be blocking automated downloads or the video has restrictions.'
            if (isAgeRestricted) {
              specificError = 'This video is age-restricted and cannot be downloaded.'
            } else if (isRegionLocked) {
              specificError = 'This video is not available in your region.'
            } else if (isPrivate) {
              specificError = 'This video is private or unavailable.'
            } else if (is403) {
              specificError = 'YouTube returned a 403 error. This often means YouTube is blocking automated downloads, not necessarily that the video is age-restricted. Try a different video or check if you can access it in your browser.'
            }
            reject(new Error(`Failed to download audio: ${err.message}. ${specificError}`))
          }
        })
        
        writeStream.on('error', (err) => {
          console.error('Write stream error:', err.message)
          reject(new Error(`Failed to save audio: ${err.message}`))
        })
        
        writeStream.on('finish', () => {
          if (!fs.existsSync(audioPath)) {
            reject(new Error('Audio file was not created'))
          } else {
            const stats = fs.statSync(audioPath)
            if (stats.size === 0) {
              reject(new Error('Downloaded file is empty'))
            } else {
              console.log('Download successful:', { size: stats.size, format: detectedFormat })
              resolve({ path: audioPath, format: detectedFormat })
            }
          }
        })
      } catch (err: any) {
        console.error('Download setup error:', err.message)
        reject(new Error(`Failed to setup download: ${err.message}`))
      }
    }
    
    // Start with default options
    tryDownload({ quality: 'lowestaudio', filter: 'audioonly' })
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

    // Check if API key exists
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured. Please check your .env.local file.' },
        { status: 500 }
      )
    }
    
    // Verify API key format (should start with sk-)
    if (!apiKey.startsWith('sk-')) {
      console.error('Invalid API key format:', apiKey.substring(0, 10) + '...')
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. API keys should start with "sk-"' },
        { status: 500 }
      )
    }
    
    // Re-initialize OpenAI client with the API key to ensure it's set
    const openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: 300000,
      maxRetries: 2,
    })

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    // First, try to get video info to check if it's accessible
    // But don't block if it fails - sometimes info fails but download works
    try {
      const videoInfo = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
      })
      console.log('Video info retrieved:', {
        title: videoInfo.videoDetails.title,
        length: videoInfo.videoDetails.lengthSeconds,
        isLiveContent: videoInfo.videoDetails.isLiveContent,
        isPrivate: videoInfo.videoDetails.isPrivate,
      })
      
      // Check for restrictions
      if (videoInfo.videoDetails.isPrivate) {
        return NextResponse.json(
          { error: 'This video is private and cannot be accessed.' },
          { status: 400 }
        )
      }
      
      if (videoInfo.videoDetails.isLiveContent) {
        return NextResponse.json(
          { error: 'Live streams are not supported. Please use a regular video.' },
          { status: 400 }
        )
      }
    } catch (infoError: any) {
      console.error('Failed to get video info:', infoError.message)
      // Continue anyway - sometimes info fails but download works
      // Don't block the download attempt
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
      console.log('Attempting transcription with API key:', apiKey.substring(0, 7) + '...')
      transcription = await openaiClient.audio.transcriptions.create({
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
      transcription = await openaiClient.audio.transcriptions.create({
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
    
    if (error.message?.includes('Connection error') || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Cannot connect to OpenAI API. Please check your internet connection and API key. Visit /api/test-openai to diagnose the issue.'
    } else if (error.status === 401) {
      errorMessage = 'Invalid OpenAI API key. Please check your API key in .env.local'
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
    } else if (error.status === 413 || error.message?.includes('too large')) {
      errorMessage = 'Audio file is too large. Please try a shorter video.'
    } else if (error.message?.includes('extract') || error.message?.includes('download audio')) {
      errorMessage = 'Failed to download video audio. The video may be age-restricted, region-locked, private, or unavailable. Please try a different video.'
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

