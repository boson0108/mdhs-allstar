import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const origin = url.origin

  if (!code) return NextResponse.redirect(`${origin}/?error=missing_code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/?error=oauth`)

  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''

  if (!email.endsWith('@ms.mingdao.edu.tw')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/?error=school_account_only`)
  }

  return NextResponse.redirect(`${origin}/vote`)
}
