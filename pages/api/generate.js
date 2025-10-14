`pages/api/generate.js`
`(Next.js API route — generate & store a post for today's date)`
`Notes on 'toLocaleString' technique: we used 'toLocaleString' with the 'timeZone: 'America/New_York' option to compute the Eastern date reliably regardless of server timezone.`

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

    const prompt = 'You are an assistant building a single short daily item for a public site called "Daily Memento Mori".\n\n' +
'Produce output exactly in this format with the rules described: Type: <Quote|Historical Example|Exercise>\nTitle: ...\nBody: ...\nTakeaway: ...\n(Keep total length under 300 words. Alternate types Quote, Historical Example, Exercise in sequence for consecutive dates, starting from the most recent existing saved date if any.)'

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
    const finalPrompt = prompt + '\n\nForce Type: ${nextType}'

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