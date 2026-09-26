'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Lock, ShieldCheck, Trophy, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Candidate, Category, Election } from '@/lib/types'

const labels: Record<Category, string> = { male: '男子組', female: '女子組' }

export default function VoteClient({
  candidates,
  election,
  submitted,
}: {
  candidates: Candidate[]
  election: Election | null
  submitted: boolean
}) {
  const [category, setCategory] = useState<Category>('male')
  const [selected, setSelected] = useState<Record<Category, string[]>>({ male: [], female: [] })
  const [reviewing, setReviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const list = useMemo(() => candidates.filter(c => c.category === category), [candidates, category])
  const ready = selected.male.length === 2 && selected.female.length === 2
  const selectedCandidates = (group: Category) => selected[group]
    .map(id => candidates.find(c => c.id === id))
    .filter(Boolean) as Candidate[]

  function toggle(id: string) {
    if (submitted || election?.status !== 'open') return
    setSelected(prev => {
      const current = prev[category]
      const next = current.includes(id)
        ? current.filter(x => x !== id)
        : current.length < 2
          ? [...current, id]
          : current
      return { ...prev, [category]: next }
    })
    setMessage('')
  }

  async function submitCompleteBallot() {
    if (!ready || sending) return
    setSending(true)
    setMessage('')

    const supabase = createClient()
    const { error } = await supabase.rpc('submit_complete_ballot', {
      p_male_candidate_ids: selected.male,
      p_female_candidate_ids: selected.female,
    })

    if (error) {
      setMessage(error.message)
      setSending(false)
      setReviewing(false)
      return
    }

    setReviewing(false)
    router.refresh()
  }

  if (submitted) {
    return (
      <main className="contentShell completionShell">
        <section className="completionCard">
          <div className="completionIcon"><ShieldCheck size={34}/></div>
          <div className="eyebrow">BALLOT LOCKED</div>
          <h2>你已完成本次投票</h2>
          <p>這個學校帳號的選票已鎖定。重新登入、換裝置或清除 Cookie 都不會重新取得投票資格。</p>
          <button className="primaryButton" onClick={() => router.push('/results')}>
            <Trophy size={19}/> 查看即時票數 <ChevronRight size={19}/>
          </button>
        </section>
      </main>
    )
  }

  if (!election || election.status !== 'open') {
    return (
      <main className="contentShell completionShell">
        <section className="completionCard mutedCard">
          <div className="completionIcon"><Lock size={32}/></div>
          <div className="eyebrow">VOTING CLOSED</div>
          <h2>目前尚未開放投票</h2>
          <p>請等待活動管理員開啟本屆明星賽投票。</p>
        </section>
      </main>
    )
  }

  return (
    <main className="contentShell">
      <section className="voteTop">
        <div>
          <div className="eyebrow">2026 ALL-STAR FAN VOTE</div>
          <h2>選出你的明星球員</h2>
          <p>男子組與女子組各選 <strong>2 位不同球員</strong>，最後四票一次送出。</p>
        </div>
        <div className="progressCard">
          <span>選擇進度</span>
          <strong>{selected.male.length + selected.female.length} / 4 票</strong>
          <div className="progressBar"><i style={{width: `${(selected.male.length + selected.female.length) * 25}%`}}/></div>
        </div>
      </section>

      <div className="tabs">
        {(['male','female'] as Category[]).map(tab => (
          <button key={tab} className={category === tab ? 'active' : ''} onClick={() => setCategory(tab)}>
            {labels[tab]}
            <span className="tabCount">{selected[tab].length}/2</span>
            {selected[tab].length === 2 && <Check size={15}/>} 
          </button>
        ))}
      </div>

      <div className="selectionStatus">
        <span>{labels[category]}已選 <strong>{selected[category].length}</strong> / 2</span>
        <span>{selected[category].length === 2 ? '這組完成，可以切換另一組' : '請選擇兩位球員'}</span>
      </div>

      <section className="candidateGrid">
        {list.map(candidate => {
          const isSelected = selected[category].includes(candidate.id)
          const disabled = !isSelected && selected[category].length >= 2
          return (
            <button
              key={candidate.id}
              className={`candidateCard ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => toggle(candidate.id)}
              disabled={disabled}
            >
              <div className="photoWrap">
                {candidate.photo_url
                  ? <img src={candidate.photo_url} alt={candidate.name}/>
                  : <div className="photoFallback">#{candidate.jersey_number}</div>}
                <span className="jersey">#{candidate.jersey_number}</span>
                {isSelected && <span className="selectedMark"><Check size={18}/></span>}
              </div>
              <div className="candidateInfo"><h3>{candidate.name}</h3><p>{candidate.class_name}</p></div>
            </button>
          )
        })}
      </section>

      {!list.length && <div className="emptyState">目前尚未建立 {labels[category]} 候選人。</div>}
      {message && <div className="errorBox">{message}</div>}

      <div className="privacyNotice">
        <ShieldCheck size={16}/>
        <span>投票需使用學校帳號；選票送出後不可修改。投票紀錄與帳號的對應僅供本活動管理員查閱與管理。</span>
      </div>

      <div className="stickyAction">
        <button className="primaryButton" disabled={!ready} onClick={() => setReviewing(true)}>
          確認四票並送出 <ChevronRight size={19}/>
        </button>
      </div>

      {reviewing && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => !sending && setReviewing(false)}>
          <section className="reviewModal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="modalClose" aria-label="關閉" onClick={() => setReviewing(false)} disabled={sending}><X size={20}/></button>
            <div className="eyebrow">FINAL CONFIRMATION</div>
            <h3>最後確認你的 4 票</h3>
            <p className="modalLead">送出後，同一個明道帳號本屆不能再次投票，也不能修改選擇。</p>

            <div className="reviewGroups">
              {(['male','female'] as Category[]).map(group => (
                <div className="reviewGroup" key={group}>
                  <strong>{labels[group]}</strong>
                  {selectedCandidates(group).map(c => (
                    <div className="reviewPick" key={c.id}>
                      <span>#{c.jersey_number}</span>
                      <div><b>{c.name}</b><small>{c.class_name}</small></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {message && <div className="errorBox">{message}</div>}
            <button className="primaryButton fullButton" onClick={submitCompleteBallot} disabled={sending}>
              {sending ? '正在送出…' : '確認送出並鎖定選票'}
            </button>
          </section>
        </div>
      )}
    </main>
  )
}
