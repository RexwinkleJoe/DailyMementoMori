`scripts/generate.js`
`CLI script (same logic as API.generate)`

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
  const prompt = 'You are an assistant building a single short daily item for a public site called "Daily Memento Mori".\n... (same strict prompt as used in the API). Force alternate type based on last saved entry.'
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