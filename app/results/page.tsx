import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import ResultsBoard from '@/components/ResultsBoard'
import type { ResultRow } from '@/lib/types'

export default async function ResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !email.endsWith('@ms.mingdao.edu.tw')) redirect('/')

  const { data, error } = await supabase.rpc('get_results')
  if (error) redirect('/vote')

  const { data: admin } = await supabase
    .from('admin_config')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <>
      <Header email={email} admin={!!admin}/>
      <ResultsBoard results={(data ?? []) as ResultRow[]}/>
    </>
  )
}
