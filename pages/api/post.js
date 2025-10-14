`pages/api/post.js` 
`(read-only API to return a stored post for a date)`

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