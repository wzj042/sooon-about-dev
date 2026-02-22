import { useEffect, type PropsWithChildren, type ReactNode } from 'react'

interface AppLayoutProps {
  footer: ReactNode
}

const BASE_WIDTH = 420
const BASE_HEIGHT = 800
const MIN_SCALE = 0.62
const MAX_SCALE = 1
const DESKTOP_PADDING_X = 40
const MOBILE_PADDING_X = 24
const SAFE_PADDING_Y = 24

export function AppLayout({ children, footer }: PropsWithChildren<AppLayoutProps>) {
  useEffect(() => {
    const applyScaleFactor = () => {
      const viewport = window.visualViewport
      const layoutWidth = document.documentElement.clientWidth || window.innerWidth
      const layoutHeight = document.documentElement.clientHeight || window.innerHeight
      const viewportWidthRaw = viewport?.width ?? window.innerWidth
      const viewportHeightRaw = viewport?.height ?? window.innerHeight
      const viewportWidth = Math.min(viewportWidthRaw, layoutWidth)
      const viewportHeight = Math.min(viewportHeightRaw, layoutHeight)

      const horizontalPadding = viewportWidth <= 640 ? MOBILE_PADDING_X : DESKTOP_PADDING_X
      const widthScale = (viewportWidth - horizontalPadding) / BASE_WIDTH
      const heightScale = (viewportHeight - SAFE_PADDING_Y) / BASE_HEIGHT
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(widthScale, heightScale)))

      document.documentElement.style.setProperty('--scale-factor', `${nextScale.toFixed(4)}`)
    }

    const scheduleApply = () => {
      window.requestAnimationFrame(applyScaleFactor)
    }

    scheduleApply()
    window.addEventListener('resize', applyScaleFactor)
    window.addEventListener('orientationchange', applyScaleFactor)
    window.visualViewport?.addEventListener('resize', applyScaleFactor)
    window.visualViewport?.addEventListener('scroll', applyScaleFactor)
    window.setTimeout(scheduleApply, 0)

    return () => {
      window.removeEventListener('resize', applyScaleFactor)
      window.removeEventListener('orientationchange', applyScaleFactor)
      window.visualViewport?.removeEventListener('resize', applyScaleFactor)
      window.visualViewport?.removeEventListener('scroll', applyScaleFactor)
      document.documentElement.style.removeProperty('--scale-factor')
    }
  }, [])

  return (
    <main className="game-page-shell">
      <div className="game-page-content">{children}</div>
      {footer}
    </main>
  )
}
