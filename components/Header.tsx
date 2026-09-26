'use client'

import Link from 'next/link'
import { LogOut, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header({ email, admin = false }: { email: string, admin?: boolean }) {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }
  return (
    <header className="siteHeader">
      <Link href="/vote" className="wordmark">MD <span>ALL-STAR</span></Link>
      <div className="headerRight">
        {admin && <Link className="adminLink" href="/admin"><Shield size={15}/> 後台</Link>}
        <span className="emailBadge">{email}</span>
        <button className="iconButton" onClick={logout} aria-label="登出"><LogOut size={18}/></button>
      </div>
    </header>
  )
}
