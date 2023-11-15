// app/providers.tsx
'use client'

import { CacheProvider } from '@chakra-ui/next-js'
import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme'
import { SessionProvider } from '@/hooks/useSession'

export function Providers({ 
    children 
  }: { 
  children: React.ReactNode 
  }) {
  return (
    <CacheProvider>
      <ChakraProvider>
        <SessionProvider>
          {children}
        </SessionProvider>
      </ChakraProvider>
    </CacheProvider>
  )
}