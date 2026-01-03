# How to Fix "Missing bearer authentication" Error

## Step 1: Check if .env.local exists

The file should be at: `C:\Users\Dell\Desktop\Clipzy mini\.env.local`

## Step 2: Create/Edit .env.local

The file should contain EXACTLY this (replace with your actual API key):

```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Important:**
- ✅ No quotes around the key
- ✅ No spaces before or after the `=`
- ✅ Must start with `sk-`
- ✅ No extra text on the line

## Step 3: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. Paste it in `.env.local` after `OPENAI_API_KEY=`

## Step 4: Restart the Server

**IMPORTANT:** After creating/editing `.env.local`, you MUST restart the dev server:

1. Stop the current server (Ctrl+C in the terminal)
2. Run `npm run dev` again
3. The server will now load the new environment variables

## Step 5: Test

1. Go to: http://localhost:3001/api/health
2. You should see: `{"status":"ok","hasApiKey":true,...}`
3. If `hasApiKey` is `false`, the file isn't being read correctly

## Common Issues:

- ❌ File named `.env` instead of `.env.local`
- ❌ File in wrong location (must be in project root)
- ❌ Didn't restart server after creating file
- ❌ API key has quotes: `OPENAI_API_KEY="sk-..."` (remove quotes!)
- ❌ Extra spaces: `OPENAI_API_KEY = sk-...` (remove spaces!)

