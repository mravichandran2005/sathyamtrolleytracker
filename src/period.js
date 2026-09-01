import { supabase } from './supabaseClient'

export function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}
export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
// Parse a 'YYYY-MM-DD' string as a local date, avoiding UTC shift issues.
export function parsePeriod(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// The month the app is actively tracking. Only moves forward when Master
// closes a month — never automatically from today's calendar date, so being
// late to close never drops anything from view.
export async function fetchCurrentPeriod() {
  const { data } = await supabase.from('app_settings').select('current_period').eq('id', 1).single()
  if (data?.current_period) return parsePeriod(data.current_period)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function advancePeriod(nextPeriodDate) {
  return supabase.from('app_settings').update({
    current_period: toDateStr(nextPeriodDate), updated_at: new Date().toISOString(),
  }).eq('id', 1)
}
