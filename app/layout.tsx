import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clipzy Mini - AI Podcast Summarizer & Viral Clip Finder',
  description: 'Automatically transcribe YouTube videos and find viral-worthy moments using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

