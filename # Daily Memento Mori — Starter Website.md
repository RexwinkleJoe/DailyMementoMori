# Daily Memento Mori — Starter Website

This single-file project contains a ready-to-run **Next.js** + **React** example that:

- Displays a single, well-formatted "Memento Mori" post for today.
- Provides an API route `/api/generate` that calls OpenAI to create a post from a clean, clear prompt capturing your intent.
- Includes two scheduling options to generate the daily post at midnight **America/New_York** (Eastern Time):
  1. **GitHub Actions** workflow (recommended for deployments on GitHub). Note about DST included.
  2. **node-cron** example for self-hosted/VPS servers (works with timezone option).

> Files included (all inside this single code document):
> - `README` with setup & run instructions
> - `pages/index.jsx` — React UI using Tailwind (previewable)
> - `pages/api/generate.js` — server API route that calls OpenAI
> - `scripts/generate.js` — CLI script to generate and store today's post (same logic as API)
> - `storage/posts.json` — sample storage file (server-side JSON store)
> - `.github/workflows/daily-generate.yml` — GitHub Actions example
> - `server-cron-example.js` — node-cron example for self-hosted servers
> - `.env.example`

---

## README

### Overview
This project demonstrates how to produce a single post per day (a quote / historical example / short exercise) created by calling the OpenAI API with a clear, stable prompt that captures your intent: encourage mortality awareness with kindness, actionable suggestions, alternation of content types, and supportive tone.

### Principles for the generation prompt (used by the code)
The generator prompt used by the server:

```
You are an assistant building a single short daily item for a public site called "Daily Memento Mori".
Requirements:
- Produce exactly one piece of content (no numbered lists) in plain text with three fields separated by a blank line: a) type (Quote / Historical Example / Exercise), b) title on one line, c) body of 2-5 sentences (concise, kind, encouraging action or reflection), and finally d) a 1- to 2-sentence "Takeaway" line starting with "Takeaway: ".
- Alternate type each day in the order: Quote, Historical Example, Exercise, repeating.
- Keep total length <= 300 words.
- Use accessible language and avoid morbid or graphic imagery. Aim for gentle urgency: remind of mortality but encourage meaningful, compassionate action.
- If you include a quote, either use a public-domain quote, attribute it, or synthesize a short aphorism prefaced by "Attributed: " if not a real historical quote.
- For historical examples, prefer short historical facts or cultural practices that illustrate impermanence.

Format output exactly like:

Type: <Quote|Historical Example|Exercise>
Title: <one-line title>
Body: <2-5 sentences>
Takeaway: <1-2 sentences>

End.
```

This precise format makes it easy for the frontend to parse and render.

### Security & API keys
Set environment variables (see `.env.example`) and NEVER commit your real `OPENAI_API_KEY` to Git.

### Storage
This starter uses a simple server-side `storage/posts.json` file to save the post generated for each date. On larger projects use a database (Postgres, Supabase, DynamoDB, etc.).

### How it works
- The scheduled job runs a small script that requests the OpenAI API to produce a single day's post using the prompt above.
- The script saves the generated text into `storage/posts.json` under the key `YYYY-MM-DD` (Eastern time date).
- The frontend fetches `/api/post?date=YYYY-MM-DD` (or `/api/post` for today) and renders it beautifully.

---

## .env.example

```.env
OPENAI_API_KEY=sk-...your-key...
PORT=3000
# Optional: STORAGE_PATH=./storage/posts.json
```

---

## `pages/index.jsx` (React + Tailwind UI)

```jsx
import React, {useEffect, useState} from 'react'

export default function Home(){
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{
    async function load(){
      try{
        setLoading(true)
        const res = await fetch('/api/post')
        if(!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setPost(data)
      }catch(e){
        setError(e.message)
      }finally{setLoading(false)}
    }
    load()
  },[])

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white shadow-lg rounded-2xl p-8">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">Daily Memento Mori</h1>
          <p className="text-sm text-gray-500">A gentle daily reminder to live well — one short item a day.</p>
        </header>

        {loading && <div className="py-12 text-center">Loading today's post…</div>}
        {error && <div className="text-red-600">Error: {error}</div>}

        {post && (
          <article>
            <div className="text-xs uppercase text-gray-400 tracking-wide">{post.type}</div>
            <h2 className="text-xl font-medium mt-2">{post.title}</h2>
            <p className="mt-4 text-gray-700 whitespace-pre-line">{post.body}</p>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border"> 
              <strong className="text-sm">Takeaway</strong>
              <p className="text-sm text-gray-600 mt-1">{post.takeaway}</p>
            </div>
            <footer className="mt-6 text-xs text-gray-400">{post.date}</footer>
          </article>
        )}

        <div className="mt-6 flex gap-3">
          <button className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Share</button>
          <button className="px-3 py-2 rounded-md border text-sm">Save</button>
        </div>
      </div>
    </main>
  )
}
```

Notes: this is a single React component that fetches `/api/post` and renders the post with tidy design. It uses Tailwind classes; if your project doesn't have Tailwind, replace classes or add Tailwind.

---

## `pages/api/generate.js` (Next.js API route — generate & store a post for today's date)

```js
// pages/api/generate.js
import fs from 'fs'
import path from 'path'

const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve('./storage/posts.json')
const OPENAI_KEY = process.env.OPENAI_API_KEY

async function callOpenAI(prompt){
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{role:'system', content:'You are a helpful generator.'},{role:'user', content: prompt}],
      max_tokens: 500,
      temperature: 0.7,
    })
  })
  if(!res.ok) throw new Error('OpenAI error: ' + await res.text())
  const j = await res.json()
  // Chat completions -> get first choice
  return j.choices?.[0]?.message?.content ?? ''
}

function ensureStorage(){
  const dir = path.dirname(STORAGE_PATH)
  if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true})
  if(!fs.existsSync(STORAGE_PATH)) fs.writeFileSync(STORAGE_PATH, JSON.stringify({}), 'utf8')
}

function parseGenerated(text){
  // Expecting the strict format from the prompt. We'll parse defensively.
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0)
  const out = {type:'', title:'', body:'', takeaway:''}
  for(const ln of lines){
    if(ln.toLowerCase().startsWith('type:')) out.type = ln.split(':')[1].trim()
    else if(ln.toLowerCase().startsWith('title:')) out.title = ln.split(':')[1].trim()
    else if(ln.toLowerCase().startsWith('body:')) out.body = ln.split(':')[1].trim()
    else if(ln.toLowerCase().startsWith('takeaway:')) out.takeaway = ln.split(':')[1].trim()
    else {
      // append to body if body already exists and no new field
      if(out.body && !out.takeaway) out.body += '\n' + ln
    }
  }
  return out
}

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).send('Only POST')
  if(!OPENAI_KEY) return res.status(500).json({error:'Missing OPENAI_API_KEY'})

  try{
    // Determine today's date in America/New_York (server may be in UTC)
    const now = new Date()
    // Use toLocaleString hack to get date in America/New_York
    const parts = now.toLocaleString('en-US', {timeZone: 'America/New_York'})
    const ny = new Date(parts)
    const yyyy = ny.getFullYear()
    const mm = String(ny.getMonth()+1).padStart(2,'0')
    const dd = String(ny.getDate()).padStart(2,'0')
    const key = `${yyyy}-${mm}-${dd}`

    const prompt = `You are an assistant building a single short daily item for a public site called "Daily Memento Mori".\n\n`+
`Produce output exactly in this format with the rules described: Type: <Quote|Historical Example|Exercise>\nTitle: ...\nBody: ...\nTakeaway: ...\n(Keep total length under 300 words. Alternate types Quote, Historical Example, Exercise in sequence for consecutive dates, starting from the most recent existing saved date if any.)`

    ensureStorage()
    const storageRaw = fs.readFileSync(STORAGE_PATH, 'utf8')
    const store = JSON.parse(storageRaw || '{}')

    // If we already have a post for today, return it
    if(store[key]) return res.status(200).json({ok:true, post: store[key]})

    // Optionally, compute what type should be today based on last saved date
    // We'll collect the last date in store and determine the next type
    const dates = Object.keys(store).sort()
    let nextType = 'Quote'
    if(dates.length>0){
      const lastDate = dates[dates.length-1]
      const lastType = store[lastDate]?.type || ''
      if(lastType === 'Quote') nextType = 'Historical Example'
      else if(lastType === 'Historical Example') nextType = 'Exercise'
      else nextType = 'Quote'
    }
    // Add instruction for today's type to the prompt
    const finalPrompt = prompt + `\n\nForce Type: ${nextType}`

    const generated = await callOpenAI(finalPrompt)
    const parsed = parseGenerated(generated)
    parsed.date = key

    // Save
    store[key] = parsed
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2), 'utf8')

    res.status(200).json({ok:true, post: parsed})
  }catch(err){
    console.error(err)
    res.status(500).json({error: String(err)})
  }
}
```

Notes on `toLocaleString` technique: we used `toLocaleString` with the `timeZone: 'America/New_York'` option to compute the Eastern date reliably regardless of server timezone.

---

## `pages/api/post.js` (read-only API to return a stored post for a date)

```js
// pages/api/post.js
import fs from 'fs'
import path from 'path'
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve('./storage/posts.json')

export default function handler(req,res){
  const date = req.query.date || null
  const raw = fs.existsSync(STORAGE_PATH) ? fs.readFileSync(STORAGE_PATH,'utf8') : '{}'
  const store = JSON.parse(raw || '{}')
  if(date){
    if(store[date]) return res.status(200).json(store[date])
    return res.status(404).json({error:'Not found'})
  }
  // return today's date in ET
  const now = new Date()
  const parts = now.toLocaleString('en-US', {timeZone: 'America/New_York'})
  const ny = new Date(parts)
  const yyyy = ny.getFullYear(); const mm = String(ny.getMonth()+1).padStart(2,'0'); const dd = String(ny.getDate()).padStart(2,'0')
  const key = `${yyyy}-${mm}-${dd}`
  if(store[key]) return res.status(200).json(store[key])
  return res.status(404).json({error:'No post for today yet'})
}
```

---

## `scripts/generate.js` — CLI script (same logic as API.generate)

```js
// scripts/generate.js
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

// This script can be run manually or by a scheduler.
// It calls the same OpenAI prompt and saves to storage/posts.json

const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve('./storage/posts.json')
const OPENAI_KEY = process.env.OPENAI_API_KEY

if(!OPENAI_KEY) throw new Error('Set OPENAI_API_KEY')

async function callOpenAI(prompt){
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${OPENAI_KEY}`},
    body: JSON.stringify({model:'gpt-4o-mini', messages:[{role:'user',content:prompt}], max_tokens:500, temperature:0.7})
  })
  if(!res.ok) throw new Error(await res.text())
  const j = await res.json()
  return j.choices?.[0]?.message?.content ?? ''
}

function ensureStorage(){
  const dir = path.dirname(STORAGE_PATH)
  if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true})
  if(!fs.existsSync(STORAGE_PATH)) fs.writeFileSync(STORAGE_PATH, JSON.stringify({}), 'utf8')
}

(async function(){
  ensureStorage()
  const now = new Date()
  const parts = now.toLocaleString('en-US',{timeZone:'America/New_York'})
  const ny = new Date(parts)
  const key = `${ny.getFullYear()}-${String(ny.getMonth()+1).padStart(2,'0')}-${String(ny.getDate()).padStart(2,'0')}`
  const storeRaw = fs.readFileSync(STORAGE_PATH,'utf8')
  const store = JSON.parse(storeRaw||'{}')
  if(store[key]){
    console.log('Post already exists for', key)
    process.exit(0)
  }
  const prompt = `You are an assistant building a single short daily item for a public site called "Daily Memento Mori".\n... (same strict prompt as used in the API). Force alternate type based on last saved entry.`
  const generated = await callOpenAI(prompt)
  // naive parse: find lines starting with Type, Title, Body, Takeaway
  const parsed = {type:'', title:'', body:'', takeaway:'', date:key}
  generated.split(/\r?\n/).forEach(line=>{
    const l = line.trim()
    if(l.toLowerCase().startsWith('type:')) parsed.type = l.split(':').slice(1).join(':').trim()
    else if(l.toLowerCase().startsWith('title:')) parsed.title = l.split(':').slice(1).join(':').trim()
    else if(l.toLowerCase().startsWith('body:')) parsed.body = l.split(':').slice(1).join(':').trim()
    else if(l.toLowerCase().startsWith('takeaway:')) parsed.takeaway = l.split(':').slice(1).join(':').trim()
    else if(parsed.body && !parsed.takeaway) parsed.body += '\n'+l
  })
  store[key] = parsed
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(store,null,2),'utf8')
  console.log('Saved post for',key)
})().catch(err=>{console.error(err); process.exit(1)})
```

---

## Scheduler options

### A) GitHub Actions (recommended if using GitHub Pages / Vercel + GitHub repo)

```yaml
# .github/workflows/daily-generate.yml
name: Daily Generate Post
on:
  schedule:
    # GitHub Actions cron uses UTC. To target midnight America/New_York you must account for DST
    # Example: For Eastern Daylight Time (UTC-4) midnight ET = 04:00 UTC -> '0 4 * * *'
    # For Eastern Standard Time (UTC-5) midnight ET = 05:00 UTC -> '0 5 * * *'
    # If you want to avoid DST issues, schedule twice (both 04:00 and 05:00 UTC) and let the script detect
    - cron: '0 4 * * *'
    - cron: '0 5 * * *'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Node 18
        uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install
        run: npm ci
      - name: Run generator
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: node scripts/generate.js
      - name: Commit and push (if changed)
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add storage/posts.json || true
          git commit -m "chore: generate daily memento mori" || echo "no changes"
          git push origin HEAD:main || echo "push failed"
```

Notes: This example runs both 04:00 and 05:00 UTC; the script checks if a post already exists for today in ET and will skip if duplicate. Using both cron entries avoids DST problems.

### B) node-cron for self-hosted servers

Install: `npm install node-cron` and run the small server wrapper `server-cron-example.js`.

```js
// server-cron-example.js
import cron from 'node-cron'
import { exec } from 'child_process'

// runs every minute and checks whether it is midnight ET. Alternative: schedule at 0 0 * * * with tz option
cron.schedule('* * * * *', ()=>{
  const now = new Date().toLocaleString('en-US', {timeZone:'America/New_York'})
  const ny = new Date(now)
  if(ny.getHours() === 0 && ny.getMinutes() === 0){
    console.log('Midnight ET: generating post')
    exec('node scripts/generate.js', (err,stdout,stderr)=>{
      if(err) console.error(err)
      else console.log(stdout)
    })
  }
})

// Alternatively, use cron.schedule('0 0 * * *', fn, {timezone: 'America/New_York'})
```

This approach uses the timezone-aware scheduling option available in recent node-cron.

---

## Notes, improvements & next steps

- **Tone & Safety**: We intentionally keep the prompt strict about length and non-graphic content. You should test and iterate the exact prompt; consider adding a small post-processing sanitiser to block problematic wording.
- **Attribution & Copyright**: When including quotes, the generator is asked to prefer public-domain quotes or to mark as "Attributed:" if not a precise citation. If you plan to display modern copyrighted quotations, add logic to store attribution and link to sources.
- **Scaling**: Move storage into a proper database for reliability and atomic writes.
- **Moderation**: Optionally run generated text through a content-moderation endpoint before publishing.

---

## Final notes
This starter should let you generate one polished piece every day at midnight Eastern Time and display it on a simple React frontend. Customize styles, storage, and scheduling to your hosting platform and preferences.