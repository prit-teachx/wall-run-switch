import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Link Twin',
  description:
    'Dual tethered neon runners ? floor and ceiling linked. Offline, no account.',
  applicationName: 'Link Twin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Link Twin',
  },
}

export const viewport: Viewport = {
  themeColor: '#050512',
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
