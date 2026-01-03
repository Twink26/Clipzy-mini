import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY is not set in environment variables',
        hasKey: false,
      }, { status: 500 })
    }
    
    if (!apiKey.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key format. Should start with "sk-"',
        hasKey: true,
        keyPrefix: apiKey.substring(0, 7) + '...',
      }, { status: 500 })
    }
    
    // Try a simple API call to test connectivity
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 10000, // 10 second timeout for test
    })
    
    // Test with a simple models list call
    const models = await openai.models.list()
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to OpenAI API',
      hasKey: true,
      keyPrefix: apiKey.substring(0, 7) + '...',
      modelsCount: models.data.length,
    })
  } catch (error: any) {
    console.error('OpenAI test error:', error)
    
    let errorMessage = error.message || 'Unknown error'
    let errorType = 'unknown'
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorType = 'connection_refused'
      errorMessage = 'Cannot connect to OpenAI servers. Check your internet connection or firewall settings.'
    } else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorType = 'timeout'
      errorMessage = 'Connection to OpenAI timed out. Check your internet connection.'
    } else if (error.status === 401) {
      errorType = 'unauthorized'
      errorMessage = 'Invalid API key. Please check your API key in .env.local'
    } else if (error.status === 429) {
      errorType = 'rate_limit'
      errorMessage = 'Rate limit exceeded. Please try again later.'
    } else if (error.message?.includes('fetch')) {
      errorType = 'network_error'
      errorMessage = 'Network error. Check your internet connection and firewall settings.'
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorType: errorType,
      status: error.status,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    }, { status: 500 })
  }
}

