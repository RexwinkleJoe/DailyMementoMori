`pages/index.jsx`
`(React + Tailwind UI)`
`Notes: This is a single React component that fetches '/api/post' and renders the post with tidy design. It uses Tailwind classes; if your project doesn't have Tailwind, replace classes or add Tailwind.`

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