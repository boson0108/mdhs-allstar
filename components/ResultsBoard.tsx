'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Crown, Trophy } from 'lucide-react'
import type { Category, ResultRow } from '@/lib/types'

const PAGE_SIZE = 4
const MAX_RESULTS = 20
const labels: Record<Category, string> = { male: '男子組', female: '女子組' }

function medalClass(rank: number) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return ''
}

export default function ResultsBoard({ results }: { results: ResultRow[] }) {
  const [category, setCategory] = useState<Category>('male')
  const [pages, setPages] = useState<Record<Category, number>>({ male: 0, female: 0 })

  const allRows = useMemo(() => {
    return results
      .filter(r => r.category === category)
      .sort((a, b) => Number(b.votes) - Number(a.votes) || a.name.localeCompare(b.name, 'zh-Hant'))
  }, [results, category])
  const rows = allRows.slice(0, MAX_RESULTS)
  const totalVotes = allRows.reduce((sum, row) => sum + Number(row.votes), 0)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(pages[category], pageCount - 1)
  const pageRows = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  function changeCategory(next: Category) {
    setCategory(next)
  }

  function move(delta: number) {
    setPages(prev => ({
      ...prev,
      [category]: Math.max(0, Math.min(pageCount - 1, currentPage + delta)),
    }))
  }

  return (
    <main className="contentShell resultsShell">
      <div className="resultsHero">
        <div className="resultIcon"><Trophy/></div>
        <div>
          <div className="eyebrow">LIVE RESULTS</div>
          <h2>明星賽即時票數</h2>
          <p>男子組與女子組分開排行。</p>
        </div>
      </div>

      <div className="resultsToolbar">
        <div className="tabs resultTabs">
          {(['male','female'] as Category[]).map(tab => (
            <button key={tab} className={category === tab ? 'active' : ''} onClick={() => changeCategory(tab)}>
              {labels[tab]}
            </button>
          ))}
        </div>
        <div className="groupVoteTotal">
          <span>{labels[category]}目前總票數</span>
          <strong>{totalVotes}</strong><small>票</small>
        </div>
      </div>

      <section className="resultCardGrid">
        {pageRows.map((row, localIndex) => {
          const rank = currentPage * PAGE_SIZE + localIndex + 1
          const medal = medalClass(rank)
          return (
            <article className={`leaderCard ${medal}`} key={row.id}>
              <div className="leaderPhoto">
                {row.photo_url
                  ? <img src={row.photo_url} alt={row.name}/>
                  : <div className="leaderFallback">#{row.jersey_number}</div>}
                <div className={`rankBadge ${medal}`}>
                  {rank <= 3 && <Crown size={14}/>}<span>{rank}</span>
                </div>
              </div>
              <div className="leaderInfo">
                <div className="leaderIdentity">
                  <span>#{row.jersey_number}</span>
                  <h3>{row.name}</h3>
                  <p>{row.class_name}</p>
                </div>
                <div className="leaderVotes"><strong>{row.votes}</strong><span>票</span></div>
              </div>
            </article>
          )
        })}
      </section>

      {rows.length === 0 && <div className="emptyState">目前尚無候選人。</div>}

      {rows.length > PAGE_SIZE && (
        <div className="pager">
          <button onClick={() => move(-1)} disabled={currentPage === 0}><ChevronLeft size={18}/> 上一頁</button>
          <span>第 {currentPage + 1} / {pageCount} 頁</span>
          <button onClick={() => move(1)} disabled={currentPage >= pageCount - 1}>下一頁 <ChevronRight size={18}/></button>
        </div>
      )}
    </main>
  )
}
