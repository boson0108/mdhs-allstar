'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginButton() {
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: 'ms.mingdao.edu.tw',
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      alert(error.message)
      setLoading(false)
    }
  }

  return (
    <button className="googleButton" onClick={login} disabled={loading}>
      <span className="googleMark">G</span>
      {loading ? '前往登入…' : '使用明道 Google 帳號登入'}
    </button>
  )
}
