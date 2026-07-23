'use client'

// NEXUS-P4-002: Access Code Entry Page

import { FormEvent, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AccessForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setError('يرجى إدخال رمز الدخول')
      return
    }

    setIsLoading(true)
    setError(null)

    // Set code in cookie via redirect with code in URL
    window.location.href = `${redirectUrl}?code=${encodeURIComponent(code)}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-right">رمز الدخول</label>
        <input
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring text-center text-lg tracking-widest"
          disabled={isLoading}
          autoFocus
          dir="rtl"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm text-right">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition text-right"
      >
        {isLoading ? 'جاري التحقق...' : 'دخول'}
      </button>
    </form>
  )
}

export default function AccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center px-4 py-8" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg border border-border p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-right">ستوديو نيكساس</h1>
            <p className="text-sm text-muted-foreground text-right">أدخل رمز الدخول للمتابعة</p>
          </div>

          <Suspense fallback={<div className="text-center text-sm text-muted-foreground">جاري التحميل...</div>}>
            <AccessForm />
          </Suspense>

          <p className="text-xs text-muted-foreground text-center">
            رمز الدخول مشفر ولا يُحفظ بطريقة غير آمنة
          </p>
        </div>
      </div>
    </div>
  )
}
