'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Document {
  id: string
  type: string
  content: string
}

interface Project {
  id: string
  title: string
  idea: string
  createdAt: string
  documents: Document[]
}

interface CostEntry {
  id: string
  provider: string
  model: string
  estimatedCost: number
  actualCost: number
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = typeof params.id === 'string' ? params.id : ''
  const [project, setProject] = useState<Project | null>(null)
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return

    async function loadProject() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/projects/${projectId}`)

        if (!res.ok) {
          if (res.status === 404) {
            setError('Project not found')
          } else {
            setError('Failed to load project')
          }
          return
        }

        const data = await res.json()
        setProject(data.project)
        setCosts(data.costs || [])
      } catch (err) {
        setError('Failed to load project')
        console.error('Error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">{error}</div>
        <Link href="/" className="text-primary hover:underline">
          ← Back to Home
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="text-muted-foreground">Project not found</div>
        <Link href="/" className="text-primary hover:underline">
          ← Back to Home
        </Link>
      </div>
    )
  }

  const summaryAndPrd = project.documents.find(d => d.type === 'summary_and_prd')
  let parsed = { summary: '', shortPrd: '' }

  if (summaryAndPrd) {
    try {
      parsed = JSON.parse(summaryAndPrd.content)
    } catch {
      parsed = { summary: summaryAndPrd.content, shortPrd: '' }
    }
  }

  const totalCost = costs.reduce((sum, cost) => sum + (cost.actualCost || cost.estimatedCost), 0)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-primary hover:underline mb-4 inline-block">
          ← Back to Projects
        </Link>

        <div className="bg-card rounded-lg border border-border p-6">
          <h1 className="text-4xl font-bold">{project.title}</h1>

          <div className="mt-4 space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Original Idea:</p>
              <p className="text-foreground">{project.idea}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Created:</p>
              <p className="text-foreground">{new Date(project.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary & PRD */}
      {summaryAndPrd && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-2xl font-semibold mb-4">Summary</h2>
            <p className="text-foreground whitespace-pre-wrap">{parsed.summary}</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-2xl font-semibold mb-4">Short PRD</h2>
            <p className="text-foreground whitespace-pre-wrap text-sm">{parsed.shortPrd}</p>
          </div>
        </div>
      )}

      {/* Costs */}
      {costs.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-2xl font-semibold mb-4">Cost Breakdown</h2>

          <div className="space-y-3">
            {costs.map(cost => (
              <div key={cost.id} className="flex justify-between items-start p-3 bg-muted rounded-md">
                <div>
                  <p className="font-medium">{cost.provider}</p>
                  <p className="text-sm text-muted-foreground">{cost.model}</p>
                </div>
                <p className="font-semibold">${(cost.actualCost || cost.estimatedCost).toFixed(4)}</p>
              </div>
            ))}

            <div className="border-t border-border pt-3 mt-3 flex justify-between items-center font-semibold">
              <p>Total Cost</p>
              <p className="text-lg">${totalCost.toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
