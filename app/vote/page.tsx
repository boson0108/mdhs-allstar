import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import VoteClient from '@/components/VoteClient'
import type { Candidate, Election } from '@/lib/types'

export default async function VotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !email.endsWith('@ms.mingdao.edu.tw')) redirect('/')

  const { data: election } = await supabase
    .from('elections')
    .select('id,title,status')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: admin } = await supabase
    .from('admin_config')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let candidates: Candidate[] = []
  let submitted = false

  if (election) {
    const [{ data: candidateRows }, { data: ballot }] = await Promise.all([
      supabase
        .from('candidates')
        .select('id,election_id,name,class_name,jersey_number,category,photo_url,active')
        .eq('election_id', election.id)
        .eq('active', true)
        .order('class_name')
        .order('jersey_number'),
      supabase
        .from('ballots')
        .select('id')
        .eq('election_id', election.id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    candidates = (candidateRows ?? []) as Candidate[]
    submitted = !!ballot
  }

  return (
    <>
      <Header email={email} admin={!!admin} />
      <VoteClient
        candidates={candidates}
        election={(election as Election | null) ?? null}
        submitted={submitted}
      />
    </>
  )
}
