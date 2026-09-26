import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mingdao All-Star Vote',
  description: '明道班際籃球明星賽票選',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
