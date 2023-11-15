import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers';
import { ColorModeScript, theme } from '@chakra-ui/react';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Passkey X zkAccount',
  description: 'Demo of passkey and zkAccount.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        </Providers>
      </body>
    </html>
  )
}