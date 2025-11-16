import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    hasApiKey: !!process.env.OPENAI_API_KEY,
    nodeVersion: process.version,
  })
}

