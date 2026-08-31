"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"
import { analytics } from "."

/**
 * Fires one `screen_view` per App Router navigation.
 *
 * Done manually rather than through the SDK's `trackScreenViews`, which patches
 * `history.pushState` and double-fires under the App Router. A ref guards
 * against React re-running the effect for the same path.
 */
function ScreenViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const query = searchParams.toString()
    const path = query ? `${pathname}?${query}` : pathname
    if (lastPath.current === path) return
    lastPath.current = path
    analytics.screenView(path)
  }, [pathname, searchParams])

  return null
}

/**
 * Mounted once in the root layout. `useSearchParams` opts its subtree into
 * client-side rendering, so it is wrapped in Suspense to keep the rest of the
 * page statically rendered.
 */
export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <ScreenViewTracker />
    </Suspense>
  )
}
