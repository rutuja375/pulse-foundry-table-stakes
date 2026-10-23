'use client'

/**
 * Stale-build guard.
 *
 * When the app is rebuilt while a tab is open, that tab still holds HTML pointing
 * at chunk hashes that no longer exist, and every navigation fails with
 * ChunkLoadError. It is not a bug in the app — it is a bug in how it is being
 * run — but a judge should never see a stack trace because someone deployed
 * between two clicks.
 *
 * So: catch the failure once, reload the tab (which fetches HTML for the current
 * build), and remember that we already tried so a genuinely broken build cannot
 * loop forever.
 */

import { useEffect } from 'react'

const FLAG = 'pf.chunk-reloaded'

function isChunkError(value: unknown): boolean {
  const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? '')
  return /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk .* failed/i.test(text)
}

export function StaleBuildGuard() {
  useEffect(() => {
    function reloadOnce(): void {
      try {
        if (sessionStorage.getItem(FLAG) === '1') return
        sessionStorage.setItem(FLAG, '1')
      } catch {
        // Storage unavailable: still reload, it is the only recovery.
      }
      window.location.reload()
    }

    function onError(event: ErrorEvent) {
      if (isChunkError(event.error) || isChunkError(event.message)) reloadOnce()
      // A failed <script>/<link> surfaces as an element-level error with no message.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) reloadOnce()
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isChunkError(event.reason)) reloadOnce()
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
