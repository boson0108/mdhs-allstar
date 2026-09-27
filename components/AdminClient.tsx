'use client'

import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown,
  Download,
  ImagePlus,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Candidate, Category, Election, ResultRow, VoterRecord } from '@/lib/types'

const labels: Record<Category, string> = { male: '男子組', female: '女子組' }

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function AdminClient({
  candidates,
  results,
  voterRecords,
  election,
}: {
  candidates: Candidate[]
  results: ResultRow[]
  voterRecords: VoterRecord[]
  election: Election | null
}) {
  const [category, setCategory] = useState<Category>('male')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [query, setQuery] = useState('')
  const router = useRouter()

  const list = useMemo(() => candidates.filter(c => c.category === category), [candidates, category])
  const resultMap = useMemo(() => new Map(results.map(r => [r.id, Number(r.votes)])), [results])
  const totalVoters = useMemo(() => new Set(voterRecords.map(r => r.ballot_id)).size, [voterRecords])
  const maleVotes = results.filter(r => r.category === 'male').reduce((s, r) => s + Number(r.votes), 0)
  const femaleVotes = results.filter(r => r.category === 'female').reduce((s, r) => s + Number(r.votes), 0)
  const maleCandidates = candidates.filter(c => c.category === 'male').length
  const femaleCandidates = candidates.filter(c => c.category === 'female').length

  const voterGroups = useMemo(() => {
    const map = new Map<string, VoterRecord[]>()
    for (const row of voterRecords) {
      const rows = map.get(row.email) ?? []
      rows.push(row)
      map.set(row.email, rows)
    }
    return map
  }, [voterRecords])

  const searchedVoters = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return [...voterGroups.entries()]
      .filter(([email]) => email.toLowerCase().includes(normalized))
      .slice(0, 12)
  }, [query, voterGroups])

  async function uploadPhoto(file: File | null) {
    if (!file?.size) return null
    if (file.size > 8 * 1024 * 1024) throw new Error('照片檔案請小於 8 MB')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${election?.id ?? 'unknown'}/${crypto.randomUUID()}.${ext}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('candidate-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) throw error
    return supabase.storage.from('candidate-photos').getPublicUrl(path).data.publicUrl
  }

  async function addCandidate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!election) return

    // Keep a stable reference before the first await. Event currentTarget
    // is not guaranteed to remain available after async work finishes.
    const formElement = e.currentTarget
    const form = new FormData(formElement)

    setSaving(true)
    try {
      const photoUrl = await uploadPhoto(form.get('photo') as File)
      const supabase = createClient()
      const { error } = await supabase.from('candidates').insert({
        election_id: election.id,
        name: String(form.get('name')).trim(),
        class_name: String(form.get('class_name')).trim(),
        jersey_number: Number(form.get('jersey_number')),
        category: String(form.get('category')),
        photo_url: photoUrl,
      })
      if (error) throw error

      formElement.reset()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '建立候選人失敗')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const form = new FormData(e.currentTarget)
      const newPhoto = await uploadPhoto(form.get('photo') as File)
      const supabase = createClient()
      const payload: Record<string, unknown> = {
        name: String(form.get('name')).trim(),
        class_name: String(form.get('class_name')).trim(),
        jersey_number: Number(form.get('jersey_number')),
        category: String(form.get('category')),
      }
      if (newPhoto) payload.photo_url = newPhoto
      const { error } = await supabase.from('candidates').update(payload).eq('id', editing.id)
      if (error) throw error
      setEditing(null)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '更新候選人失敗')
    } finally {
      setSaving(false)
    }
  }

  async function removeCandidate(candidate: Candidate) {
    if (Number(resultMap.get(candidate.id) ?? 0) > 0) {
      alert('這位候選人已經有票，為保留投票紀錄請使用「停用」，不要刪除。')
      return
    }
    if (!confirm(`確定刪除 ${candidate.name}？`)) return
    const { error } = await createClient().from('candidates').delete().eq('id', candidate.id)
    if (error) alert(error.message)
    else router.refresh()
  }

  async function toggleActive(candidate: Candidate) {
    const { error } = await createClient()
      .from('candidates')
      .update({ active: !candidate.active })
      .eq('id', candidate.id)
    if (error) alert(error.message)
    else router.refresh()
  }

  async function toggleElection() {
    if (!election) return
    const next = election.status === 'open' ? 'closed' : 'open'
    const prompt = next === 'open'
      ? '確定開放投票？開放後學生即可送出正式選票。'
      : '確定關閉投票？關閉後不再接受新選票。'
    if (!confirm(prompt)) return
    const { error } = await createClient().from('elections').update({ status: next }).eq('id', election.id)
    if (error) alert(error.message)
    else router.refresh()
  }

  function exportCsv() {
    const header = ['學校帳號', '送出時間', '組別', '候選人', '班級', '背號']
    const rows = voterRecords.map(row => [
      row.email,
      new Date(row.submitted_at).toLocaleString('zh-TW'),
      labels[row.category],
      row.candidate_name,
      row.class_name,
      row.jersey_number,
    ])
    const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mingdao-allstar-votes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function candidateVoters(candidateId: string) {
    return voterRecords.filter(row => row.candidate_id === candidateId)
  }

  return (
    <main className="contentShell adminShell">
      <section className="adminTitle">
        <div>
          <div className="eyebrow">ADMIN CONTROL CENTER</div>
          <h2>明星賽投票後台</h2>
          <p className="adminSubtitle">此頁僅你的 Admin 帳號可存取。</p>
        </div>
        <div className="adminTopActions">
          <button className="secondaryButton" onClick={exportCsv} disabled={!voterRecords.length}><Download size={17}/> 匯出 CSV</button>
          <button className={`statusButton ${election?.status === 'open' ? 'open' : ''}`} onClick={toggleElection} disabled={!election}>
            <Power size={17}/>{election?.status === 'open' ? '投票進行中' : election?.status === 'draft' ? '尚未開放' : '投票已關閉'}
          </button>
        </div>
      </section>

      <section className="metricGrid metricGridFive">
        <div><Users/><span>已投票帳號</span><strong>{totalVoters}</strong></div>
        <div><Users/><span>男子組候選人</span><strong>{maleCandidates}</strong></div>
        <div><Vote/><span>男子組總票數</span><strong>{maleVotes}</strong></div>
        <div><Users/><span>女子組候選人</span><strong>{femaleCandidates}</strong></div>
        <div><Vote/><span>女子組總票數</span><strong>{femaleVotes}</strong></div>
      </section>

      <section className="panel voterSearchPanel">
        <div className="panelHeader voterSearchHeader">
          <div>
            <h3><Search size={18}/> 搜尋投票者</h3>
            <p>輸入學號或完整學校帳號，查看該帳號送出的四票。</p>
          </div>
          <div className="searchBox"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="例如 B15611014"/></div>
        </div>
        {query.trim() && (
          <div className="voterSearchResults">
            {searchedVoters.map(([email, rows]) => (
              <article className="voterCard" key={email}>
                <div className="voterCardHeader"><strong>{email}</strong><span>{new Date(rows[0].submitted_at).toLocaleString('zh-TW')}</span></div>
                <div className="voterPicks">
                  {(['male','female'] as Category[]).map(group => (
                    <div key={group}><b>{labels[group]}</b>{rows.filter(r => r.category === group).map(r => <span key={r.candidate_id}>#{r.jersey_number} {r.candidate_name}</span>)}</div>
                  ))}
                </div>
              </article>
            ))}
            {!searchedVoters.length && <div className="emptyInline">找不到符合的已投票帳號。</div>}
          </div>
        )}
      </section>

      <div className="adminGrid">
        <section className="panel">
          <div className="panelHeader">
            <h3>候選人管理</h3>
            <div className="miniTabs">
              <button className={category === 'male' ? 'active' : ''} onClick={() => setCategory('male')}>男籃</button>
              <button className={category === 'female' ? 'active' : ''} onClick={() => setCategory('female')}>女籃</button>
            </div>
          </div>
          <div className="adminList">
            {list.map(candidate => {
              const votes = Number(resultMap.get(candidate.id) ?? 0)
              const voters = candidateVoters(candidate.id)
              return (
                <article className={`adminCandidateWrap ${!candidate.active ? 'inactive' : ''}`} key={candidate.id}>
                  <div className="adminCandidate">
                    <div className="adminAvatar">{candidate.photo_url ? <img src={candidate.photo_url} alt=""/> : `#${candidate.jersey_number}`}</div>
                    <div className="adminCandidateName"><strong>{candidate.name}</strong><span>{candidate.class_name} · #{candidate.jersey_number} · {votes} 票</span></div>
                    <button className="smallButton" onClick={() => setEditing(candidate)}><Pencil size={13}/> 編輯</button>
                    <button className="smallButton" onClick={() => toggleActive(candidate)}>{candidate.active ? '停用' : '啟用'}</button>
                    <button className="dangerIcon" aria-label="刪除候選人" onClick={() => removeCandidate(candidate)}><Trash2 size={16}/></button>
                  </div>
                  <details className="voterDetails">
                    <summary>查看投票者 <span>{voters.length}</span><ChevronDown size={15}/></summary>
                    <div className="voterDropdown">
                      {voters.length
                        ? voters.map(row => <div key={`${row.ballot_id}-${row.candidate_id}`}><span>{row.email}</span><small>{new Date(row.submitted_at).toLocaleString('zh-TW')}</small></div>)
                        : <p>目前尚無投票者。</p>}
                    </div>
                  </details>
                </article>
              )
            })}
            {!list.length && <div className="emptyInline">尚未建立{labels[category]}候選人。</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader"><h3><Plus size={18}/> 新增候選人</h3></div>
          <form className="candidateForm" onSubmit={addCandidate}>
            <label>姓名<input name="name" placeholder="王小明" maxLength={40} required/></label>
            <label>班級<input name="class_name" placeholder="高三 5 班" maxLength={30} required/></label>
            <label>背號<input type="number" min="0" max="99" name="jersey_number" placeholder="24" required/></label>
            <label>組別<select name="category" defaultValue={category} key={category}><option value="male">男子組</option><option value="female">女子組</option></select></label>
            <label className="fileInput"><ImagePlus size={22}/><span>上傳球員照片</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
            <button className="primaryButton" disabled={saving || !election}>{saving ? '建立中…' : '建立候選人'}</button>
          </form>
        </section>
      </div>

      {editing && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => !saving && setEditing(null)}>
          <section className="reviewModal editModal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="modalClose" aria-label="關閉" onClick={() => setEditing(null)} disabled={saving}><X size={20}/></button>
            <div className="eyebrow">EDIT CANDIDATE</div>
            <h3>編輯候選人</h3>
            <form className="candidateForm" onSubmit={saveEdit}>
              <label>姓名<input name="name" defaultValue={editing.name} maxLength={40} required/></label>
              <label>班級<input name="class_name" defaultValue={editing.class_name} maxLength={30} required/></label>
              <label>背號<input type="number" min="0" max="99" name="jersey_number" defaultValue={editing.jersey_number} required/></label>
              <label>組別<select name="category" defaultValue={editing.category}><option value="male">男子組</option><option value="female">女子組</option></select></label>
              <label className="fileInput"><ImagePlus size={22}/><span>更換照片（可留空）</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
              <button className="primaryButton fullButton" disabled={saving}>{saving ? '儲存中…' : '儲存修改'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
