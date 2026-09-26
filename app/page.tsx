import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginButton from '@/components/LoginButton'
import { ShieldCheck, Trophy, Vote } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email?.toLowerCase().endsWith('@ms.mingdao.edu.tw')) redirect('/vote')

  return (
    <main className="landing">
      <div className="landingGlow landingGlowOne" />
      <div className="landingGlow landingGlowTwo" />
      <section className="heroCard">
        <div className="brandPill"><Trophy size={15} /> MINGDAO INTERCLASS BASKETBALL</div>
        <h1>MINGDAO<br/><span>ALL-STAR</span> VOTE</h1>
        <p className="heroLead">選出你心中的班際籃球明星。男籃、女籃各兩票，四票最後一次確認送出。</p>
        <LoginButton />
        <p className="domainHint"><ShieldCheck size={15}/> 僅限 <strong>@ms.mingdao.edu.tw</strong> 學校帳號</p>
        <div className="heroStats">
          <div><Vote/><strong>2 + 2</strong><span>男、女籃各兩票</span></div>
          <div><ShieldCheck/><strong>1 ACCOUNT</strong><span>每個帳號整場限投一次</span></div>
        </div>
      </section>
    </main>
  )
}
