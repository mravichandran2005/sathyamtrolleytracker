// Deploy with: supabase functions deploy reset-password
// This runs on Supabase's servers, never in the browser — it's the only
// place the service-role (admin) key is used, and it's never sent to the app.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateTempPassword() {
  const num = Math.floor(10000 + Math.random() * 90000)
  return `Trolley@${num}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId } = await req.json()
    if (!userId) throw new Error('userId is required')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    // Confirm the caller is a logged-in user, using their own token.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) throw new Error('Not authenticated')

    // From here on, use the admin client (service role) — but only after
    // confirming the caller is Master.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profErr } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single()
    if (profErr || callerProfile?.role !== 'master') {
      throw new Error('Only the Master can reset passwords')
    }

    const tempPassword = generateTempPassword()

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })
    if (updateErr) throw updateErr

    const { error: profileUpdateErr } = await adminClient
      .from('profiles')
      .update({ must_change_password: true, reset_requested: false, reset_requested_at: null })
      .eq('id', userId)
    if (profileUpdateErr) throw profileUpdateErr

    return new Response(JSON.stringify({ tempPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
