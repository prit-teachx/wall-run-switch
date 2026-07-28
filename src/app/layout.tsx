import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wall Run Switch',
  description:
    'Endless neon wall-run ? flip left/right walls, jump barriers, offline no account.',
  applicationName: 'Wall Run Switch',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wall Run Switch',
  },
}

export const viewport: Viewport = {
  themeColor: '#060510',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
