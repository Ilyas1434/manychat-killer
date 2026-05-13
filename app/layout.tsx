import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono  = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Automation OS',
  description: 'Instagram automation dashboard powered by Zernio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-bg font-sans text-ink">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
          {/* Status bar */}
          <div className="flex-shrink-0 h-8 bg-sidebar border-t border-border flex items-center px-5 gap-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-slow" />
              <span className="font-mono text-[11px] text-prose">{process.env.NEXT_PUBLIC_IG_USERNAME ?? '@yourhandle'}</span>
            </div>
            <span className="font-mono text-[11px] text-note">Instagram</span>
            <span className="font-mono text-[11px] text-note">·</span>
            <span className="font-mono text-[11px] text-note">Zernio API</span>
            <div className="ml-auto font-mono text-[11px] text-note">Automation OS v0.1</div>
          </div>
        </div>
      </body>
    </html>
  )
}
