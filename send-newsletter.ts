// Supabase Edge Function — send-newsletter
// Deploy with: supabase functions deploy send-newsletter
//
// Required secrets (set via Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   — from resend.com (free: 3,000 emails/month)
//   FROM_EMAIL       — e.g. blog@tobyk1dd.com  (must be a verified domain in Resend)
//
// Supabase auto-injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL  = Deno.env.get('FROM_EMAIL') ?? 'blog@tobyk1dd.com'
const SB_URL      = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  const { type, email, post_title, post_excerpt, post_url } = await req.json()
  const db = createClient(SB_URL, SB_SERVICE)

  /* ── WELCOME EMAIL ── */
  if (type === 'welcome') {
    const r = await sendEmail(FROM_EMAIL, email, 'Welcome to the TobyK1DD blog ✓', `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#c8d0d3;padding:32px;border-radius:10px">
        <h1 style="color:#f64e4e;font-size:2rem;margin:0 0 8px">TOBYK1DD<span style="color:#000">.</span></h1>
        <p style="font-size:15px;line-height:1.7;color:#222">
          Hey — thanks for subscribing! You'll get an email every time a new post goes live.
          Gaming, coding, streaming, and whatever else is on my mind.
        </p>
        <a href="${post_url ?? 'https://tobyk1dd.com/Blog.html'}"
           style="display:inline-block;margin-top:20px;background:#f64e4e;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700">
          Read the blog →
        </a>
        <p style="margin-top:28px;font-size:11px;color:#777">
          You subscribed at tobyk1dd.com.
          <a href="https://tobyk1dd.com" style="color:#f64e4e">Unsubscribe</a>
        </p>
      </div>`)
    return json({ ok: r.ok, status: r.status })
  }

  /* ── NEW POST NOTIFICATION ── */
  if (type === 'new_post') {
    const { data: subs, error } = await db
      .from('newsletter_subscribers')
      .select('email')

    if (error) return json({ ok: false, error: error.message }, 500)
    if (!subs?.length) return json({ ok: true, sent: 0 })

    // Resend batch endpoint — max 100 per call
    const emails = subs.map(s => ({
      from: FROM_EMAIL,
      to:   s.email,
      subject: `New post: ${post_title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#c8d0d3;padding:32px;border-radius:10px">
          <h1 style="color:#f64e4e;font-size:2rem;margin:0 0 4px">TOBYK1DD<span style="color:#000">.</span></h1>
          <p style="font-size:12px;color:#777;margin:0 0 20px">New post</p>
          <h2 style="font-size:1.4rem;color:#000;margin:0 0 12px">${post_title}</h2>
          <p style="font-size:15px;line-height:1.7;color:#333">${post_excerpt}</p>
          <a href="${post_url}"
             style="display:inline-block;margin-top:20px;background:#f64e4e;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700">
            Read post →
          </a>
          <p style="margin-top:28px;font-size:11px;color:#777">
            You subscribed at tobyk1dd.com.
            <a href="https://tobyk1dd.com" style="color:#f64e4e">Unsubscribe</a>
          </p>
        </div>`
    }))

    // Batch in groups of 100
    let sent = 0
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100)
      const r = await fetch('https://api.resend.com/emails/batch', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(batch),
      })
      if (r.ok) sent += batch.length
    }

    return json({ ok: true, sent })
  }

  return json({ ok: false, error: 'Unknown type' }, 400)
})

async function sendEmail(from: string, to: string, subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, subject, html }),
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
