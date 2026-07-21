'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  title: string
  idea: string
  createdAt: string
  documents: Array<{
    id: string
    type: string
  }>
}

export default function HomePage() {
  const [title, setTitle] = useState('')
  const [idea, setIdea] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      setIsLoadingProjects(true)
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Failed to load projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !idea.trim()) {
      setError('Please fill in both title and idea')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, idea }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const data = await res.json()

      // Reset form
      setTitle('')
      setIdea('')

      // Reload projects
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold">Nexus Studio AI</h1>
        <p className="text-muted-foreground mt-2">Personal Prototype - Transform ideas into summaries and plans</p>
      </header>

      {/* Input form */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-2xl font-semibold mb-4">Start with an Idea</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Project Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Mobile Shopping App"
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Describe Your Idea</label>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="Describe what you want to build..."
              rows={5}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Generate Summary & PRD'}
          </button>
        </form>
      </div>

      {/* Projects list */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-2xl font-semibold mb-4">Recent Projects</h2>

        {isLoadingProjects ? (
          <p className="text-muted-foreground">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground">No projects yet. Create one above!</p>
        ) : (
          <div className="space-y-3">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition"
              >
                <h3 className="font-semibold">{project.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{project.idea.substring(0, 100)}...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
