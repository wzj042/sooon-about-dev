import type { PropsWithChildren, ReactNode } from 'react'

interface AppLayoutProps {
  footer: ReactNode
}

export function AppLayout({ children, footer }: PropsWithChildren<AppLayoutProps>) {
  return (
    <main className="game-page-shell">
      <div className="game-page-content">{children}</div>
      {footer}
    </main>
  )
}
