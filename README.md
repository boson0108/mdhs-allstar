# Mingdao All-Star Vote — V1

明道班際籃球明星賽票選網站。這一版已經不是單頁 Preview，而是可以接上 Supabase、Google OAuth 並部署到 Vercel 的完整 Next.js 專案。

## V1 功能

### 學生端
- 使用 Google OAuth 登入。
- 只接受已驗證的 `@ms.mingdao.edu.tw` 帳號。
- 男子組選 2 位、女子組選 2 位。
- 四票在最後確認畫面一次送出。
- 同一學校帳號同一屆只能送出一次完整選票。
- 送出後不能修改；重新登入、換瀏覽器、換裝置都不能重投。
- 完成投票後才能查看即時票數。
- 男子組、女子組結果分開。
- 結果頁每頁 4 位，使用上一頁 / 下一頁。
- 顯示前 20 名；前三名使用金 / 銀 / 銅樣式。
- 結果卡顯示照片、姓名、班級、背號、票數，不使用票數長條圖。

### Admin
- V1 僅支援 **一個 Admin 帳號**。
- 新增、編輯、停用、啟用候選人。
- 上傳 / 更換候選人照片。
- 開啟 / 關閉投票。
- 男、女籃票數分開統計。
- 每位候選人可展開「查看投票者」。
- 可輸入學號 / 學校帳號搜尋該帳號投出的 4 票。
- 可匯出 CSV。
- 一般學生無法透過 RLS 或 RPC 取得「誰投誰」。

## 技術架構

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase PostgreSQL + Row Level Security
- Supabase Storage
- Google OAuth
- Vercel

---

## 1. 建立 Supabase Project

建議 V1 使用一個新的 Supabase Project，避免先前 Preview schema 與正式 V1 schema 混在一起。

在 Supabase SQL Editor 執行：

```text
supabase/schema.sql
```

Schema 會建立：

```text
elections
admin_config
candidates
ballots
votes
candidate-photos storage bucket
```

其中 `ballots` 有：

```sql
unique (election_id, user_id)
```

所以同一個 Supabase / Google 使用者在同一屆只有一張完整選票。

真正送票只能呼叫：

```text
submit_complete_ballot(male[2], female[2])
```

PostgreSQL transaction 會一次驗證並寫入四票；任何一步失敗都不會留下半張選票。

---

## 2. 設定 Google OAuth

Supabase：

```text
Authentication → Providers → Google
```

建立 Google OAuth Client，並把 Supabase 提供的 callback URL 加到 Google Cloud 的 Authorized redirect URIs。

Supabase Auth 的 Redirect URLs 再加入：

```text
http://localhost:3000/auth/callback
https://你的正式網域/auth/callback
```

程式會在登入時使用：

```text
hd=ms.mingdao.edu.tw
```

但 `hd` 只用來提示 Google 帳號選擇；真正授權還會在 callback 及 PostgreSQL 再次檢查使用者確實是已驗證的 `@ms.mingdao.edu.tw` 帳號。

> 如果明道 Google Workspace 禁止未核准的第三方 OAuth App，需要請學校資訊單位核准這個 OAuth Client。

---

## 3. 環境變數

```bash
cp .env.example .env.local
```

填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

---

## 4. 本機啟動

建議 Node.js 20.9+。

```bash
npm install
npm run dev
```

開啟：

```text
http://localhost:3000
```

---

## 5. 設定你為唯一 Admin

先用你自己的明道 Google 帳號登入網站一次，讓帳號進入 `auth.users`。

接著在 Supabase SQL Editor 執行：

```sql
update public.admin_config
set user_id = (
  select id
  from auth.users
  where lower(email) = lower('你的學號@ms.mingdao.edu.tw')
)
where singleton = true;
```

重新整理網站後即可進入：

```text
/admin
```

`admin_config` 是 singleton table，因此 V1 只設定一位 Admin。

---

## 6. 第一次測試建議

1. Admin 建立至少 2 位男子組、2 位女子組候選人。
2. 上傳照片。
3. Admin 按「尚未開放」將投票狀態切成「投票進行中」。
4. 使用另一個明道帳號測試投票。
5. 男籃選 2 人、女籃選 2 人。
6. 最後確認四票並送出。
7. 確認結果頁可查看排行。
8. 登出後重新登入同一帳號，確認無法重投。
9. Admin 到候選人下方展開「查看投票者」。
10. Admin 使用搜尋框查該測試帳號的四票。

正式開票前可以建立一個新的 Supabase Project，或在確認測試資料可安全清除後再正式使用。

---

## 7. 部署到 Vercel

1. 將此專案 push 到 GitHub。
2. Vercel → Add New Project → Import Git Repository。
3. 加入兩個 Supabase 環境變數。
4. Deploy。
5. 取得正式網址後，把正式 callback 補到 Supabase Redirect URLs。
6. 確認 Google OAuth Authorized redirect URI 設定正確。

---

## 投票安全重點

### 一個帳號一次

資料庫本身使用：

```sql
unique (election_id, user_id)
```

不是靠 Cookie 或 localStorage。因此以下行為都不能取得第二張選票：

```text
重新登入
換瀏覽器
無痕模式
清 Cookie
換手機
換電腦
修改前端 JavaScript
自行呼叫 API
```

### 四票一次完成

PostgreSQL RPC 會檢查：

```text
登入帳號是否為已驗證明道帳號
目前是否有 open election
男籃是否剛好 2 位不同候選人
女籃是否剛好 2 位不同候選人
候選人是否屬於正確組別
候選人是否仍為 active
帳號是否已經投過
```

全部通過後才一次建立 ballot + 4 votes。

### 誰投誰

`ballots` 只存 Supabase `user_id`，不額外複製 Email。只有 Admin-only RPC 會在需要時將 `user_id` 與 `auth.users.email` 對應，供後台顯示。

投票頁會明確告知使用者：投票紀錄與帳號的對應僅供活動管理員查閱與管理。

---

## 主要檔案

```text
app/page.tsx                  首頁 / Google 登入
app/vote/page.tsx             投票頁 Server Component
components/VoteClient.tsx     四票選擇與最終確認
app/results/page.tsx          結果頁
components/ResultsBoard.tsx   男女分開、4 人分頁、金銀銅排名
app/admin/page.tsx            Admin 權限檢查與資料取得
components/AdminClient.tsx    候選人 / 照片 / 投票者 / CSV 管理
app/auth/callback/route.ts     Google OAuth callback + 學校網域驗證
supabase/schema.sql           正式資料庫、RLS、RPC、Storage 規則
```

---

## GitHub Repository 注意事項

這個專案可以直接作為 GitHub Repository 根目錄。請參考 `GITHUB_UPLOAD.md`。

**不要 commit `.env.local` 或任何 secret。** 公開前端只需要 Supabase Publishable Key；任何 secret/service-role key 都不應放在瀏覽器端程式或 GitHub。

目前 `package.json` 已固定主要套件版本；第一次在自己的電腦執行 `npm install` 後會自動產生 `package-lock.json`，建議再把該 lock file commit 到 GitHub，之後部署會更容易重現相同依賴版本。
