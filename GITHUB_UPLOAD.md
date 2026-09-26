# GitHub 上傳指南

這個資料夾就是 GitHub Repository 的根目錄。**請上傳資料夾內的檔案，不要再多包一層資料夾。**

## 方法 A：直接用 GitHub 網頁上傳

1. GitHub 建立一個新的 Repository，例如 `mingdao-allstar`。
2. 建議先選 **Private**；網站部署到 Vercel 後仍然可以公開使用。
3. 建立 Repository 時不要額外勾選 README、.gitignore 或 License，因為本專案已包含需要的檔案。
4. 進 Repository → `Add file` → `Upload files`。
5. 將本資料夾內所有檔案拖進去。
6. 確認 **沒有 `.env.local`、密碼、Google Client Secret、Supabase secret/service-role key**。
7. Commit changes。

## 方法 B：使用 Terminal / Git

```bash
cd mingdao-allstar-github
git init
git add .
git commit -m "Initial Mingdao All-Star V1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mingdao-allstar.git
git push -u origin main
```

## 上傳後確認 Repository 頂層應看到

```text
.github/                （目前不需要，可沒有）
app/
components/
lib/
supabase/
.env.example
.gitignore
.nvmrc
GITHUB_UPLOAD.md
README.md
next-env.d.ts
package.json
proxy.ts
tsconfig.json
```

## 不應出現在 GitHub

```text
.env.local
node_modules/
.next/
.vercel/
任何 Google Client Secret
任何 Supabase secret/service-role key
```

## 下一步

1. 建 Supabase Project。
2. 執行 `supabase/schema.sql`。
3. 複製 `.env.example` 為本機 `.env.local`，填入自己的 Supabase URL / Publishable Key。
4. 設定 Google OAuth。
5. 本機執行 `npm install`、`npm run dev`。
6. GitHub Repository 匯入 Vercel。
7. 在 Vercel 設定同樣的環境變數。
8. 正式網址產生後，把 callback URL 補到 Supabase / Google OAuth 設定。

詳細步驟請看 `README.md`。
