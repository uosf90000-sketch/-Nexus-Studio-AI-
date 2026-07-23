import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ستوديو نيكساس AI',
  description: 'نموذج شخصي - من الفكرة إلى المنتج',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

          html {
            font-family: 'IBM Plex Sans Arabic', sans-serif;
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
