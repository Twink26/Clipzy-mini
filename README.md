# Clipzy Mini - AI Podcast Summarizer & Viral Clip Finder

A simple web app that automatically transcribes YouTube videos and finds viral-worthy moments using AI.

## Features

- 🎥 Paste a YouTube link
- 🎤 Auto-transcribe audio using OpenAI Whisper
- 🔥 Find spicy moments, jokes, and emotional peaks
- ⏱️ Get timestamps perfect for reel material

## Tech Stack

- Next.js 14
- OpenAI Whisper API (transcription)
- OpenAI GPT (viral moment detection)
- TypeScript
- Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. User pastes a YouTube URL
2. System extracts audio from the video
3. Audio is transcribed using OpenAI Whisper
4. GPT analyzes the transcription to find:
   - Spicy/controversial moments
   - Jokes and humor
   - Emotional peaks
   - Viral-worthy clips
5. Returns timestamps and descriptions for each moment

## Note

You'll need FFmpeg installed on your system for audio extraction. Download from [ffmpeg.org](https://ffmpeg.org/download.html)

