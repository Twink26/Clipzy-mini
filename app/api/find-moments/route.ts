import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { TranscriptionSegment, ViralMoment } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { transcription, segments } = await request.json()

    if (!transcription || !segments) {
      return NextResponse.json(
        { error: 'Transcription and segments are required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Create a prompt for GPT to find viral moments
    const prompt = `Analyze this podcast/video transcription and identify viral-worthy moments. Look for:

1. SPICY moments: Controversial statements, hot takes, debates, confrontations
2. JOKE moments: Funny jokes, witty remarks, humor that would make people laugh
3. EMOTIONAL moments: Powerful emotional statements, vulnerable moments, inspiring quotes
4. VIRAL moments: Anything that's particularly shareable, quotable, or attention-grabbing

For each moment you find, provide:
- The exact timestamp (start and end time in seconds)
- The type (spicy, joke, emotional, or viral)
- A brief description of why it's viral-worthy
- The exact quote from the transcription
- A confidence score (0-1) for how viral-worthy it is

Return ONLY a valid JSON object with this structure:
{
  "moments": [
    {
      "timestamp": 123.5,
      "endTime": 145.2,
      "type": "spicy",
      "description": "Brief description",
      "quote": "Exact quote from transcription",
      "confidence": 0.85
    }
  ]
}

Transcription:
${transcription}

Segments with timestamps:
${JSON.stringify(segments, null, 2)}

Find the top 5-10 most viral-worthy moments. Be selective - only include moments that are truly shareable.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at identifying viral content. You analyze transcriptions and find the most shareable, attention-grabbing moments.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from GPT')
    }

    // Parse the JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (err) {
      // Sometimes GPT returns JSON wrapped in markdown code blocks
      const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseContent.match(/```\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1])
      } else {
        // Try to extract JSON array directly
        const arrayMatch = responseContent.match(/\[[\s\S]*\]/)
        if (arrayMatch) {
          parsedResponse = { moments: JSON.parse(arrayMatch[0]) }
        } else {
          throw new Error('Could not parse GPT response')
        }
      }
    }

    // Extract moments array (handle different response formats)
    let moments: ViralMoment[] = []
    if (Array.isArray(parsedResponse)) {
      moments = parsedResponse
    } else if (parsedResponse.moments && Array.isArray(parsedResponse.moments)) {
      moments = parsedResponse.moments
    } else if (parsedResponse.viralMoments && Array.isArray(parsedResponse.viralMoments)) {
      moments = parsedResponse.viralMoments
    }

    // Validate and clean moments
    moments = moments
      .filter((moment: any) => 
        moment.timestamp !== undefined &&
        moment.type &&
        moment.description &&
        moment.quote
      )
      .map((moment: any) => ({
        timestamp: Number(moment.timestamp),
        endTime: Number(moment.endTime || moment.timestamp + 30),
        type: moment.type.toLowerCase() as ViralMoment['type'],
        description: String(moment.description),
        quote: String(moment.quote),
        confidence: Number(moment.confidence || 0.5),
      }))
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
      .slice(0, 10) // Limit to top 10

    return NextResponse.json({ moments })
  } catch (error: any) {
    console.error('Find moments error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to find viral moments' },
      { status: 500 }
    )
  }
}

