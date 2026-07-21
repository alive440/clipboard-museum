import { getHistory } from './clipboard'

export async function getStats() {
  const history = await getHistory(5000)
  const byType: Record<string, number> = {}
  const byHour = new Array(24).fill(0)
  let totalLen = 0
  const domains: Record<string, number> = {}
  history.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1
    byHour[new Date(e.createdAt).getHours()]++
    totalLen += e.length
    if (e.type === 'link') { try { const d = new URL(e.content).hostname; domains[d] = (domains[d] || 0) + 1 } catch {} }
  })
  return {
    total: history.length, byType, byHour,
    avgLength: history.length > 0 ? Math.round(totalLen / history.length) : 0,
    topDomains: Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([domain, count]) => ({ domain, count })),
  }
}
