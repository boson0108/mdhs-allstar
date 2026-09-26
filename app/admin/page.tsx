import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AdminClient from '@/components/AdminClient'
import type { Candidate, Election, ResultRow, VoterRecord } from '@/lib/types'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !email.endsWith('@ms.mingdao.edu.tw')) redirect('/')

  const { data: admin } = await supabase
    .from('admin_config')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!admin) redirect('/vote')

  const { data: election } = await supabase
    .from('elections')
    .select('id,title,status')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const electionId = election?.id

  const [candidateResponse, resultResponse, voterResponse] = await Promise.all([
    electionId
      ? supabase
          .from('candidates')
          .select('id,election_id,name,class_name,jersey_number,category,photo_url,active')
          .eq('election_id', electionId)
          .order('created_at')
      : Promise.resolve({ data: [] }),
    supabase.rpc('admin_results'),
    supabase.rpc('admin_voter_records'),
  ])

  return (
    <>
      <Header email={email} admin/>
      <AdminClient
        candidates={(candidateResponse.data ?? []) as Candidate[]}
        results={(resultResponse.data ?? []) as ResultRow[]}
        voterRecords={(voterResponse.data ?? []) as VoterRecord[]}
        election={(election as Election | null) ?? null}
      />
    </>
  )
}
