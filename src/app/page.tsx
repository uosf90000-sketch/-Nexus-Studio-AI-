'use client'

// NEXUS-P3-001: Founder View Home Page
// Arabic-first, RTL, mobile-first interface

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

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      setIsLoadingProjects(true)
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('فشل تحميل المشاريع')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('فشل تحميل المشاريع')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !idea.trim()) {
      setError('يرجى ملء اسم المشروع والفكرة')
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
        throw new Error(data.error || 'فشل إنشاء المشروع')
      }

      setTitle('')
      setIdea('')
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="space-y-2 sm:space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-right">ستوديو نيكساس AI</h1>
        <p className="text-sm sm:text-base text-muted-foreground text-right">من فكرتك إلى منتج موثّق مُراجَع وجاهز للتسليم</p>
      </header>

      {/* New Project Form */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-right">ابدأ بفكرتك</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-right">اسم المشروع</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثلاً: تطبيق التسوق الجوال"
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-right"
              disabled={isLoading}
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-right">وصف الفكرة</label>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="وضّح ما تريد بناءه والمشكلة التي تحل..."
              rows={4}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-right resize-none"
              disabled={isLoading}
              dir="rtl"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm text-right">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition text-right"
          >
            {isLoading ? 'جارٍ المعالجة...' : 'ولّد الملخص والـ PRD'}
          </button>
        </form>
      </div>

      {/* Projects List */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-right">مشاريعك</h2>

        {isLoadingProjects ? (
          <p className="text-muted-foreground text-right text-sm">جاري التحميل...</p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground text-right text-sm">لا توجد مشاريع بعد. ابدأ بإنشاء مشروع أعلاه!</p>
        ) : (
          <div className="space-y-3">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition"
              >
                <h3 className="font-semibold text-right">{project.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 text-right line-clamp-2">{project.idea.substring(0, 100)}...</p>
                <p className="text-xs text-muted-foreground mt-2 text-right">
                  {new Date(project.createdAt).toLocaleDateString('ar-SA')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
