import { supabase } from './supabaseClient'

// Given transactions with created_by / acknowledged_by uuid columns, fetch
// a { [id]: full_name } map for all of them in one query.
export async function fetchNamesForTxs(txs) {
  const ids = [...new Set(txs.flatMap((t) => [t.created_by, t.acknowledged_by]).filter(Boolean))]
  if (ids.length === 0) return {}
  const { data } = await supabase.from('profile_names').select('id, full_name').in('id', ids)
  const map = {}
  ;(data || []).forEach((p) => { map[p.id] = p.full_name })
  return map
}
