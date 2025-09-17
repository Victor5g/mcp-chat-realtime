import './globals.css'
import { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-br" data-theme="dark" className="dark">
      <body>{children}</body>
    </html>
  )
}
