import { useState, useEffect } from 'react'
import { addClipEntry, type ClipEntry } from '../api/clipboard'

declare global { interface Window { clipboardAPI?: { onText:(cb:(t:string)=>void)=>void; onImage:(cb:(url:string)=>void)=>void; getCurrent:()=>Promise<string> } } }

export function useClipboardWatcher(enabled: boolean, onNewEntry: (entry: ClipEntry) => void) {
  const [watching, setWatching] = useState(false)
  useEffect(() => {
    if (!enabled) { setWatching(false); return }
    setWatching(true)
    if (window.clipboardAPI) {
      window.clipboardAPI.getCurrent().then(async (text) => { if (text) { const e = await addClipEntry(text); if (e) onNewEntry(e) } })
      window.clipboardAPI.onText(async (text) => { const entry = await addClipEntry(text); if (entry) onNewEntry(entry) })
      window.clipboardAPI.onImage(async (dataUrl) => { const entry = await addClipEntry(dataUrl); if (entry) onNewEntry(entry) })
    } else {
      const interval = setInterval(async () => {
        try { const text = await navigator.clipboard.readText(); if (text && text.length < 50000) { const e = await addClipEntry(text); if (e) onNewEntry(e) } } catch {}
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [enabled])
  return { watching }
}
