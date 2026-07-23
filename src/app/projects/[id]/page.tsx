'use client'

// NEXUS-P3-002: Founder View Project Detail Page
// The main interface showing the complete loop

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

interface Task {
  id: string
  title: string
  description: string
  order: number
  status: string
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = typeof params.id === 'string' ? params.id : ''
  const [project, setProject] = useState<Project | null>(null)
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  useEffect(() => {
    if (!projectId) return

    async function loadProject() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/projects/${projectId}`)

        if (!res.ok) {
          if (res.status === 404) {
            setError('المشروع غير موجود')
          } else {
            setError('فشل تحميل المشروع')
          }
          return
        }

        const data = await res.json()
        setProject(data.project)
        setCosts(data.costs || [])

        const tasksRes = await fetch(`/api/projects/${projectId}/tasks`)
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json()
          setTasks(tasksData.tasks || [])
        }
      } catch (err) {
        setError('فشل تحميل المشروع')
        console.error('Error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  async function handleGenerateTasks() {
    try {
      setIsGeneratingTasks(true)
      setTaskError(null)

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        setTaskError(data.error || 'فشل إنشاء المهام')
        return
      }

      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) {
      setTaskError('فشل إنشاء المهام')
      console.error('Error:', err)
    } finally {
      setIsGeneratingTasks(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-right">{error}</div>
        <Link href="/" className="text-primary hover:underline inline-block text-right">
          ← العودة إلى المشاريع
        </Link>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="text-muted-foreground text-right">المشروع غير موجود</div>
        <Link href="/" className="text-primary hover:underline inline-block text-right">
          ← العودة إلى المشاريع
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <Link href="/" className="text-primary hover:underline mb-4 inline-block text-sm">
          ← العودة إلى المشاريع
        </Link>

        <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
          <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-right">{project.title}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-right">
                {new Date(project.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">التكلفة حتى الآن</p>
              <p className="text-xl font-semibold text-primary">${totalCost.toFixed(3)}</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg text-right">
            <p className="text-sm text-muted-foreground mb-1">الفكرة الأصلية</p>
            <p className="text-foreground text-sm">{project.idea}</p>
          </div>
        </div>
      </div>

      {/* Loop Progress Visualization */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-6 text-right">رحلة مشروعك</h2>

        <div className="space-y-3">
          {/* Step 1: Idea → Summary & PRD */}
          <div className={`p-4 rounded-lg border-2 transition ${summaryAndPrd ? 'border-green-500 bg-green-500/5' : 'border-muted'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${summaryAndPrd ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                ✓
              </div>
              <div className="flex-1 text-right">
                <p className="font-medium">1. الملخص و PRD</p>
                <p className="text-xs text-muted-foreground mt-1">تم تحليل فكرتك وإنشاء وثائق المشروع</p>
              </div>
            </div>
          </div>

          {/* Step 2: Generate Tasks */}
          <div className={`p-4 rounded-lg border-2 transition ${tasks.length > 0 ? 'border-green-500 bg-green-500/5' : 'border-muted'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${tasks.length > 0 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                {tasks.length > 0 ? '✓' : '2'}
              </div>
              <div className="flex-1 text-right">
                <p className="font-medium">2. تقسيم المهام</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasks.length > 0 ? `تم إنشاء ${tasks.length} مهام` : 'لم تُنشأ المهام بعد'}
                </p>
              </div>
            </div>
          </div>

          {/* Step 3-7: Remaining steps */}
          <div className="p-4 rounded-lg border-2 border-muted">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">3-7</div>
              <div className="flex-1 text-right">
                <p className="font-medium">تطوير → مراجعة → نشر</p>
                <p className="text-xs text-muted-foreground mt-1">اختر مهمة لبدء التطوير</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary & PRD */}
      {summaryAndPrd && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-right">الملخص التنفيذي</h2>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap text-right">{parsed.summary}</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-right">المتطلبات الرئيسية</h2>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap text-right">{parsed.shortPrd}</p>
          </div>
        </div>
      )}

      {/* Tasks Section */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-right">المهام</h2>
          <button
            onClick={handleGenerateTasks}
            disabled={isGeneratingTasks || !summaryAndPrd}
            title={!summaryAndPrd ? 'ولّد الملخص و PRD أولاً' : ''}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGeneratingTasks ? 'جاري الإنشاء...' : 'ولّد المهام'}
          </button>
        </div>

        {taskError && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md mb-4 text-right text-sm">
            {taskError}
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-right">
            {summaryAndPrd ? 'انقر على "ولّد المهام" لتقسيم المشروع إلى مهام قابلة للتنفيذ' : 'ولّد الملخص و PRD أولاً'}
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="border border-border rounded-lg p-4 bg-muted/50 hover:bg-muted transition">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {task.order}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    <p className="text-xs mt-2">
                      <span className="inline-block px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                        {task.status === 'PENDING' ? 'قيد الانتظار' : task.status === 'IN_PROGRESS' ? 'قيد التنفيذ' : 'مكتمل'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      {costs.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 text-right">تفصيل التكاليف</h2>

          <div className="space-y-2">
            {costs.map(cost => (
              <div key={cost.id} className="flex justify-between items-center p-3 bg-muted rounded-md text-sm">
                <div className="text-right">
                  <p className="font-medium">{cost.provider}</p>
                  <p className="text-xs text-muted-foreground">{cost.model}</p>
                </div>
                <p className="font-semibold flex-shrink-0">${(cost.actualCost || cost.estimatedCost).toFixed(4)}</p>
              </div>
            ))}

            <div className="border-t border-border pt-3 mt-4 flex justify-between items-center font-semibold">
              <p className="text-right">الإجمالي</p>
              <p className="text-lg text-primary">${totalCost.toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical Details Toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          {showTechnicalDetails ? '← إخفاء' : '→'} تفاصيل تقنية
        </button>

        {showTechnicalDetails && (
          <div className="mt-4 bg-muted/50 rounded-lg p-4 text-right space-y-2 text-xs">
            <p><span className="font-mono text-muted-foreground">Project ID:</span> <span className="font-mono">{project.id}</span></p>
            {summaryAndPrd && <p><span className="font-mono text-muted-foreground">Document ID:</span> <span className="font-mono">{summaryAndPrd.id}</span></p>}
          </div>
        )}
      </div>
    </div>
  )
}
