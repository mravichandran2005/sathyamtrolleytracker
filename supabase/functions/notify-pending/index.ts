// Deploy with: supabase functions deploy notify-pending
// Called from the app right after a dispatch/return is logged. Looks up who
// needs to confirm it, and pushes a notification to their subscribed devices.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { transactionId } = await req.json()
    if (!transactionId) throw new Error('transactionId is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .select('id, direction, company_id, company:companies(name)')
      .eq('id', transactionId)
      .single()
    if (txErr || !tx) throw new Error('Transaction not found')

    // Whoever needs to CONFIRM this is the target audience.
    let targetsQuery = admin.from('profiles').select('id').eq('active', true)
    let title, body
    if (tx.direction === 'outbound') {
      // My Company -> Partner: the partner's own staff must confirm.
      targetsQuery = targetsQuery.eq('role', 'partner').eq('company_id', tx.company_id)
      title = 'Delivery to confirm'
      body = `A new delivery has arrived — please confirm what you received.`
    } else {
      // Partner -> My Company: my_company staff must confirm.
      targetsQuery = targetsQuery.eq('role', 'my_company')
      title = 'Return to confirm'
      body = `${tx.company?.name || 'A partner'} has sent a return — please confirm what arrived.`
    }

    const { data: targets, error: targetsErr } = await targetsQuery
    if (targetsErr) throw targetsErr
    const targetIds = (targets || []).map((t) => t.id)
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'No active users to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const { data: subs, error: subsErr } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', targetIds)
    if (subsErr) throw subsErr

    let sent = 0
    for (const sub of subs || []) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      const payload = JSON.stringify({ title, body, url: '/' })
      try {
        await webpush.sendNotification(pushSubscription, payload)
        sent++
      } catch (err) {
        // Expired/invalid subscription — clean it up so we stop trying it.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    return new Response(JSON.stringify({ sent, targets: targetIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})
