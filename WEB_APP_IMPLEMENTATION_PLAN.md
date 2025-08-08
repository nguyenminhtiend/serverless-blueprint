# Web App Implementation Plan - AWS Amplify Hosting Only
## Serverless Microservices Integration - 2025 Industry Standards

### Executive Summary

This document outlines a comprehensive implementation plan for a modern web application using **AWS Amplify Hosting ONLY**, integrated with the existing serverless microservices architecture. Amplify is used solely for static site hosting and CI/CD deployment - no other Amplify services are utilized. The plan follows 2025 industry best practices including security-first design, observability, performance optimization, and sustainable development practices.

---

## 1. Architecture Overview

### 1.1 High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Next.js App   │────│  AWS Amplify     │────│  CloudFront CDN     │
│   (Frontend)     │    │  Hosting ONLY    │    │  (Global Edge)      │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         │                        
         │  Direct API calls                    
         ▼                        
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   API Gateway   │────│  Lambda Functions │────│  DynamoDB/Cognito   │
│   (Backend API)  │    │  (Microservices)  │    │  (Data & Auth)      │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

**Key Architecture Points:**
- **Amplify Hosting Only**: Used solely for static site deployment and CI/CD
- **Direct Integration**: Frontend communicates directly with existing API Gateway
- **No Amplify SDK**: No aws-amplify dependency for backend services
- **Existing Auth**: Uses existing Cognito setup via direct API calls

### 1.2 Technology Stack Rationale

**Frontend Framework: Next.js 15 with App Router**
- Server-side rendering for optimal SEO and Core Web Vitals
- React Server Components for reduced bundle size
- Built-in performance optimizations (Image, Font, Script components)
- Native TypeScript support aligning with existing codebase

**State Management: Modern React Patterns**
- React 19 features (use, useActionState, useFormStatus)
- TanStack Query v5 for server state management
- Zustand v5 for client state (when needed)
- Jotai for atomic state management (complex UIs)

**UI Framework: Design System Approach**
- Tailwind CSS v4 with CSS-in-JS compilation
- Radix UI primitives for accessibility compliance
- Shadcn/ui components for rapid development
- Custom design tokens following WCAG 2.2 AA standards

---

## 2. Implementation Phases

### Phase 1: Foundation Setup (Week 1-2)

#### 2.1 Project Initialization
```bash
# Project structure
web-app/
├── .amplify/                    # Amplify configuration
├── .next/                       # Next.js build output
├── src/
│   ├── app/                     # App Router (Next.js 15)
│   │   ├── (auth)/             # Route groups
│   │   ├── (dashboard)/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── forms/              # React Hook Form components
│   │   ├── providers/          # Context providers
│   │   └── layouts/            # Layout components
│   ├── lib/
│   │   ├── auth/               # Authentication utilities
│   │   ├── api/                # API client configuration
│   │   ├── utils.ts            # Utility functions
│   │   ├── validations/        # Zod schemas
│   │   └── constants.ts
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
├── amplify/                    # Amplify backend configuration
├── tests/
│   ├── __mocks__/
│   ├── e2e/                    # Playwright tests
│   ├── integration/            # Testing Library integration tests
│   └── unit/                   # Unit tests
├── docs/                       # Documentation
├── .env.example
├── .env.local
├── amplify.yml                 # Amplify build configuration
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

#### 2.2 Dependencies Installation
```json
{
  "dependencies": {
    "next": "^15.4.6",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "aws-sdk": "^2.1.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.863.0",
    "@tanstack/react-query": "^5.84.1",
    "@hookform/resolvers": "^5.2.1",
    "react-hook-form": "^7.62.0",
    "zod": "^4.0.15",
    "zustand": "^5.0.7",
    "jotai": "^2.13.0",
    "tailwindcss": "^4.1.11",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.7.0",
    "lucide-react": "^0.537.0",
    "@t3-oss/env-nextjs": "^0.11.1"
  },
  "devDependencies": {
    "@types/node": "^22.14.4",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.3",
    "typescript": "^5.9.2",
    "eslint": "^9.19.0",
    "eslint-config-next": "^15.4.6",
    "@typescript-eslint/eslint-plugin": "^8.24.0",
    "@typescript-eslint/parser": "^8.24.0",
    "prettier": "^3.4.3",
    "prettier-plugin-tailwindcss": "^0.6.10",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/user-event": "^14.5.2",
    "vitest": "^3.2.4",
    "@vitejs/plugin-react": "^4.3.4",
    "playwright": "^1.50.1",
    "@playwright/test": "^1.50.1",
    "msw": "^2.8.3",
    "jsdom": "^25.0.1"
  }
}
```

#### 2.3 Development Environment Setup
```typescript
// .env.example
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_API_GATEWAY_URL=https://api.yourdomain.com
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_VERSION=$npm_package_version

# Analytics & Monitoring
NEXT_PUBLIC_AMPLITUDE_API_KEY=
NEXT_PUBLIC_SENTRY_DSN=

# Feature Flags
NEXT_PUBLIC_FEATURE_ANALYTICS_ENABLED=true
NEXT_PUBLIC_FEATURE_NOTIFICATIONS_ENABLED=true
```

### Phase 2: Authentication Integration (Week 2-3)

#### 2.1 Direct Cognito Authentication Setup
```typescript
// src/lib/auth/cognito-client.ts
import { 
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { env } from '@/lib/env'

class CognitoAuthClient {
  private client: CognitoIdentityProviderClient
  private clientId: string

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: env.NEXT_PUBLIC_AWS_REGION,
    })
    this.clientId = env.NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID
  }

  async signIn(email: string, password: string) {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })

    return this.client.send(command)
  }

  async signUp(email: string, password: string, firstName: string, lastName: string) {
    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
      ],
    })

    return this.client.send(command)
  }

  async confirmSignUp(email: string, confirmationCode: string) {
    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: confirmationCode,
    })

    return this.client.send(command)
  }

  async getUser(accessToken: string) {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    })

    return this.client.send(command)
  }

  async signOut(accessToken: string) {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    })

    return this.client.send(command)
  }
}

export const cognitoAuthClient = new CognitoAuthClient()
```

#### 2.2 Authentication Hooks and Utilities
```typescript
// src/hooks/use-auth.ts
import { useState, useEffect } from 'react'
import { cognitoAuthClient } from '@/lib/auth/cognito-client'

interface AuthUser {
  email: string
  firstName: string
  lastName: string
  accessToken: string
  refreshToken: string
  idToken: string
}

interface UseAuthReturn {
  user: AuthUser | null
  loading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  confirmSignUp: (email: string, code: string) => Promise<void>
  getAccessToken: () => string | null
}

const AUTH_STORAGE_KEY = 'auth_user'

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadUserFromStorage()
  }, [])

  const loadUserFromStorage = () => {
    try {
      setLoading(true)
      const storedUser = localStorage.getItem(AUTH_STORAGE_KEY)
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      }
    } catch (err) {
      console.error('Failed to load user from storage:', err)
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await cognitoAuthClient.signIn(email, password)
      
      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, IdToken } = response.AuthenticationResult
        
        // Get user details
        const userResponse = await cognitoAuthClient.getUser(AccessToken!)
        const attributes = userResponse.UserAttributes || []
        
        const firstName = attributes.find(attr => attr.Name === 'given_name')?.Value || ''
        const lastName = attributes.find(attr => attr.Name === 'family_name')?.Value || ''
        
        const authUser: AuthUser = {
          email,
          firstName,
          lastName,
          accessToken: AccessToken!,
          refreshToken: RefreshToken!,
          idToken: IdToken!,
        }
        
        setUser(authUser)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      if (user?.accessToken) {
        await cognitoAuthClient.signOut(user.accessToken)
      }
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      setUser(null)
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      setError(null)
      await cognitoAuthClient.signUp(email, password, firstName, lastName)
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  const confirmSignUp = async (email: string, code: string) => {
    try {
      setError(null)
      await cognitoAuthClient.confirmSignUp(email, code)
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  const getAccessToken = (): string | null => {
    return user?.accessToken || null
  }

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    signUp,
    confirmSignUp,
    getAccessToken,
  }
}
```

### Phase 3: API Integration & State Management (Week 3-4)

#### 3.1 API Client Setup with TanStack Query
```typescript
// src/lib/api/client.ts
import { useAuth } from '@/hooks/use-auth'

class ApiClient {
  private baseURL: string
  private getToken: () => string | null

  constructor(baseURL: string, getToken: () => string | null) {
    this.baseURL = baseURL
    this.getToken = getToken
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken()
    
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = this.getAuthHeaders()
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config)
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // HTTP Methods
  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

// Create API client instance with auth token provider
export const createApiClient = (getToken: () => string | null) => 
  new ApiClient(process.env.NEXT_PUBLIC_API_GATEWAY_URL!, getToken)

// Hook to get authenticated API client
export const useApiClient = () => {
  const { getAccessToken } = useAuth()
  return createApiClient(getAccessToken)
}
```

#### 3.2 React Query Setup with Optimistic Updates
```typescript
// src/lib/api/react-query.ts
import { QueryClient, DefaultOptions } from '@tanstack/react-query'

const queryConfig: DefaultOptions = {
  queries: {
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false
      if (error?.status === 401) return false
      return failureCount < 3
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  },
  mutations: {
    retry: (failureCount, error: any) => {
      if (error?.status === 400) return false
      if (error?.status === 401) return false
      return failureCount < 2
    },
  },
}

export function createQueryClient() {
  return new QueryClient({ defaultOptions: queryConfig })
}

// src/hooks/api/use-user-profile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/lib/api/client'
import type { UserProfile } from '@/types/user'

export function useUserProfile() {
  const apiClient = useApiClient()
  
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => apiClient.get<UserProfile>('/users/profile'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient()
  const apiClient = useApiClient()

  return useMutation({
    mutationFn: (data: Partial<UserProfile>) =>
      apiClient.put<UserProfile>('/users/profile', data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['user', 'profile'] })
      
      const previousData = queryClient.getQueryData<UserProfile>(['user', 'profile'])
      
      if (previousData) {
        queryClient.setQueryData<UserProfile>(['user', 'profile'], {
          ...previousData,
          ...newData,
        })
      }

      return { previousData }
    },
    onError: (err, newData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['user', 'profile'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] })
    },
  })
}
```

### Phase 4: UI Components & Design System (Week 4-5)

#### 4.1 Design System Configuration
```typescript
// tailwind.config.js
import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...fontFamily.mono],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}

export default config
```

#### 4.2 Component Architecture
```typescript
// src/components/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

### Phase 5: Advanced Features & Optimization (Week 5-6)

#### 5.1 Real-time Updates with EventBridge
```typescript
// src/lib/realtime/websocket-client.ts
import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'

interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

export function useWebSocketUpdates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (!user) return

    const wsUrl = `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}?token=${user.userId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      wsRef.current = ws
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        handleRealtimeUpdate(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      wsRef.current = null
      
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [user])

  const handleRealtimeUpdate = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'ORDER_STATUS_UPDATED':
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.setQueryData(['orders', message.data.id], message.data)
        break
      
      case 'NOTIFICATION_RECEIVED':
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        // Show toast notification
        break
      
      case 'USER_PROFILE_UPDATED':
        queryClient.setQueryData(['user', 'profile'], message.data)
        break
    }
  }, [queryClient])

  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  return {
    isConnected: !!wsRef.current,
    reconnect: connect,
  }
}
```

#### 5.2 Performance Monitoring & Analytics
```typescript
// src/lib/monitoring/performance.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return

  const vitalsUrl = 'https://vitals.vercel-analytics.com/v1/vitals'

  function sendToAnalytics({ name, value, id }: any) {
    // Send to your analytics service
    if (process.env.NODE_ENV === 'production') {
      fetch(vitalsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          id,
          page: window.location.pathname,
          href: window.location.href,
          event_name: name,
          value: value.toString(),
          speed: getConnectionSpeed(),
        }),
      }).catch(console.error)
    }
  }

  // Core Web Vitals
  getCLS(sendToAnalytics)
  getFID(sendToAnalytics)
  getFCP(sendToAnalytics)
  getLCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}

function getConnectionSpeed(): string {
  const connection = (navigator as any).connection
  if (!connection) return 'unknown'
  
  if (connection.effectiveType) {
    return connection.effectiveType
  }
  
  if (connection.downlink) {
    return connection.downlink >= 10 ? '4g' : '3g'
  }
  
  return 'unknown'
}

// src/lib/monitoring/error-boundary.tsx
'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="mt-2 text-muted-foreground">
              We've been notified of this error and are working to fix it.
            </p>
            <button
              className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Phase 6: Testing Strategy (Week 6-7)

#### 6.1 Testing Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        'coverage/',
        '*.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

#### 6.2 Test Examples
```typescript
// tests/unit/components/button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('applies correct variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })
})

// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should sign in successfully', async ({ page }) => {
    await page.goto('/')
    
    // Navigate to login
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/auth/login')
    
    // Fill in credentials
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'Password123!')
    
    // Submit form
    await page.click('[data-testid="submit-button"]')
    
    // Verify successful login
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="submit-button"]')
    
    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })
})
```

### Phase 7: AWS Amplify Deployment (Week 7-8)

#### 7.1 Amplify Configuration (Hosting Only)
```yaml
# amplify.yml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm
            - pnpm install --frozen-lockfile
        build:
          commands:
            - pnpm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
      buildSettings:
        env:
          variables:
            NEXT_PUBLIC_AWS_REGION: us-east-1
            NEXT_PUBLIC_ENVIRONMENT: $AWS_BRANCH
            NEXT_PUBLIC_API_GATEWAY_URL: $API_GATEWAY_URL
            NEXT_PUBLIC_AWS_USER_POOL_ID: $USER_POOL_ID
            NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID: $USER_POOL_CLIENT_ID
    appRoot: web-app

# Note: Environment variables are managed through Amplify Console
# No amplify backend configuration - using existing infrastructure
```

#### 7.2 Environment-specific Configuration
```typescript
// src/lib/config/environment.ts
export const environments = {
  development: {
    apiUrl: 'https://dev-api.yourdomain.com',
    wsUrl: 'wss://dev-ws.yourdomain.com',
    cognitoUserPoolId: 'us-east-1_DEVPOOL',
    cognitoClientId: 'devclientid123',
  },
  staging: {
    apiUrl: 'https://staging-api.yourdomain.com',
    wsUrl: 'wss://staging-ws.yourdomain.com',
    cognitoUserPoolId: 'us-east-1_STAGINGPOOL',
    cognitoClientId: 'stagingclientid123',
  },
  production: {
    apiUrl: 'https://api.yourdomain.com',
    wsUrl: 'wss://ws.yourdomain.com',
    cognitoUserPoolId: 'us-east-1_PRODPOOL',
    cognitoClientId: 'prodclientid123',
  },
}

export const getEnvironmentConfig = () => {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT as keyof typeof environments
  return environments[env] || environments.development
}
```

#### 7.3 Custom Domain and SSL (CDK Infrastructure)
```typescript
// infrastructure/lib/stacks/amplify-hosting-stack.ts
import * as cdk from 'aws-cdk-lib'
import * as amplify from 'aws-cdk-lib/aws-amplify'
import * as ssm from 'aws-cdk-lib/aws-ssm'

export class AmplifyHostingStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps & {
    apiGatewayUrl: string
    userPoolId: string
    userPoolClientId: string
  }) {
    super(scope, id, props)

    const domainName = 'yourdomain.com'
    const appSubDomain = 'app'

    // Amplify App for Hosting Only
    const amplifyApp = new amplify.CfnApp(this, 'WebAppHosting', {
      name: 'serverless-web-app-hosting',
      repository: 'https://github.com/yourusername/serverless-blueprint',
      platform: 'WEB',
      buildSpec: `
        version: 1
        applications:
          - frontend:
              phases:
                preBuild:
                  commands:
                    - cd web-app
                    - npm install -g pnpm
                    - pnpm install --frozen-lockfile
                build:
                  commands:
                    - pnpm run build
              artifacts:
                baseDirectory: .next
                files:
                  - '**/*'
              cache:
                paths:
                  - node_modules/**/*
                  - .next/cache/**/*
            appRoot: web-app
      `,
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_AWS_REGION',
          value: this.region,
        },
        {
          name: 'AMPLIFY_MONOREPO_APP_ROOT',
          value: 'web-app',
        },
        {
          name: 'NEXT_PUBLIC_API_GATEWAY_URL',
          value: props.apiGatewayUrl,
        },
        {
          name: 'NEXT_PUBLIC_AWS_USER_POOL_ID',
          value: props.userPoolId,
        },
        {
          name: 'NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID',
          value: props.userPoolClientId,
        },
      ],
      accessToken: cdk.SecretValue.secretsManager('github-token').unsafeUnwrap(),
    })

    // Branch configurations
    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      stage: 'PRODUCTION',
      framework: 'Next.js - SSR',
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_ENVIRONMENT',
          value: 'production',
        },
      ],
    })

    const developBranch = new amplify.CfnBranch(this, 'DevelopBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'develop',
      stage: 'DEVELOPMENT',
      framework: 'Next.js - SSR',
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_ENVIRONMENT',
          value: 'development',
        },
      ],
    })

    // Custom Domain (Optional - can be configured manually)
    const domain = new amplify.CfnDomain(this, 'CustomDomain', {
      appId: amplifyApp.attrAppId,
      domainName,
      certificateSettings: {
        type: 'AMPLIFY_MANAGED',
      },
      subDomainSettings: [
        {
          prefix: appSubDomain,
          branchName: mainBranch.branchName,
        },
        {
          prefix: `dev-${appSubDomain}`,
          branchName: developBranch.branchName,
        },
      ],
    })

    // Store Amplify App ID for reference
    new ssm.StringParameter(this, 'AmplifyAppId', {
      parameterName: '/amplify/web-app/app-id',
      stringValue: amplifyApp.attrAppId,
      description: 'Amplify App ID for web application hosting',
    })

    // Outputs
    new cdk.CfnOutput(this, 'AmplifyAppIdOutput', {
      value: amplifyApp.attrAppId,
      description: 'Amplify App ID',
    })

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://${appSubDomain}.${domainName}`,
      description: 'Web Application URL',
    })
  }
}
```

---

## 3. Security Implementation

### 3.1 Security Headers & CSP
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['aws-amplify'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.amazonaws.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://*.amazonaws.com",
              "connect-src 'self' https://*.amazonaws.com wss://*.amazonaws.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

### 3.2 Input Validation & Sanitization
```typescript
// src/lib/validations/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(254, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  rememberMe: z.boolean().optional(),
})

export const registerSchema = z.object({
  email: loginSchema.shape.email,
  password: loginSchema.shape.password,
  confirmPassword: z.string(),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s]*$/, 'First name can only contain letters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s]*$/, 'Last name can only contain letters'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
```

---

## 4. Performance Optimization

### 4.1 Bundle Analysis & Code Splitting
```typescript
// src/app/dashboard/page.tsx
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton'

// Lazy load heavy components
const AnalyticsChart = dynamic(
  () => import('@/components/dashboard/analytics-chart'),
  {
    loading: () => <div className="h-64 animate-pulse bg-gray-200 rounded" />,
    ssr: false,
  }
)

const DataTable = dynamic(
  () => import('@/components/dashboard/data-table'),
  {
    loading: () => <div className="h-96 animate-pulse bg-gray-200 rounded" />,
  }
)

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <AnalyticsChart />
        <DataTable />
      </Suspense>
    </div>
  )
}
```

### 4.2 Image Optimization
```typescript
// src/components/optimized-image.tsx
import Image from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
  sizes?: string
}

export function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`duration-700 ease-in-out ${
          isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'
        }`}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  )
}
```

---

## 5. Monitoring & Observability

### 5.1 Application Performance Monitoring
```typescript
// src/lib/monitoring/apm.ts
import * as Sentry from '@sentry/nextjs'
import { BrowserTracing } from '@sentry/tracing'

export function initAPM() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === 'development',
    integrations: [
      new BrowserTracing({
        tracingOrigins: [
          'localhost',
          process.env.NEXT_PUBLIC_API_GATEWAY_URL!,
        ],
      }),
    ],
    beforeSend(event) {
      // Filter out known errors
      if (event.exception) {
        const error = event.exception.values?.[0]
        if (error?.type === 'ChunkLoadError') {
          return null // Filter out chunk load errors
        }
      }
      return event
    },
  })
}

// Custom performance tracking
export function trackPerformance(metricName: string, value: number) {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${metricName}: ${value}ms`,
    level: 'info',
  })

  // Also send to CloudWatch if needed
  if (typeof window !== 'undefined' && 'performance' in window) {
    performance.mark(`${metricName}-${Date.now()}`)
  }
}
```

### 5.2 Business Metrics Tracking
```typescript
// src/lib/analytics/events.ts
export const analyticsEvents = {
  // Authentication events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  
  // Business events
  ORDER_CREATED: 'order_created',
  ORDER_COMPLETED: 'order_completed',
  PROFILE_UPDATED: 'profile_updated',
  
  // UI interactions
  BUTTON_CLICKED: 'button_clicked',
  PAGE_VIEWED: 'page_viewed',
  FEATURE_USED: 'feature_used',
} as const

export type AnalyticsEvent = typeof analyticsEvents[keyof typeof analyticsEvents]

export interface EventProperties {
  userId?: string
  sessionId: string
  timestamp: number
  [key: string]: any
}

export function trackEvent(event: AnalyticsEvent, properties?: Partial<EventProperties>) {
  const eventData: EventProperties = {
    sessionId: getSessionId(),
    timestamp: Date.now(),
    ...properties,
  }

  // Send to multiple analytics providers
  if (process.env.NODE_ENV === 'production') {
    // Amplitude
    if (window.amplitude) {
      window.amplitude.track(event, eventData)
    }
    
    // Custom analytics endpoint
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties: eventData }),
    }).catch(console.error)
  }
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('sessionId')
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('sessionId', sessionId)
  }
  return sessionId
}
```

---

## 6. Quality Assurance & Best Practices

### 6.1 Code Quality Tools
```json
// .eslintrc.js
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### 6.2 Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  },
  "commitlint": {
    "extends": ["@commitlint/config-conventional"]
  }
}
```

---

## 7. Success Metrics & KPIs

### 7.1 Technical Metrics
- **Core Web Vitals**
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
  
- **Performance Metrics**
  - Time to First Byte (TTFB): < 600ms
  - Time to Interactive (TTI): < 5s
  - Bundle Size: < 250KB (gzipped)

### 7.2 Business Metrics
- **User Engagement**
  - User registration completion rate: > 85%
  - Session duration: > 3 minutes average
  - Pages per session: > 2.5 average
  
- **Reliability**
  - Uptime: > 99.9%
  - Error rate: < 0.1%
  - API response time: < 500ms P95

### 7.3 Security Metrics
- Zero critical security vulnerabilities
- All forms with proper CSRF protection
- 100% HTTPS coverage
- Regular security dependency updates

---

## 8. Deployment Timeline & Milestones

| Week | Phase | Deliverables | Success Criteria |
|------|-------|-------------|------------------|
| 1-2  | Foundation | Project setup, CI/CD pipeline | All tooling configured, builds passing |
| 2-3  | Authentication | Login/register flows | Users can authenticate with existing Cognito |
| 3-4  | API Integration | Data fetching, state management | All microservices endpoints integrated |
| 4-5  | UI Components | Design system, core pages | All major pages implemented |
| 5-6  | Advanced Features | Real-time updates, notifications | WebSocket integration working |
| 6-7  | Testing | Unit, integration, E2E tests | >80% test coverage, all E2E passing |
| 7-8  | Deployment | Production deployment | Live application on custom domain |
| 8    | Optimization | Performance tuning, monitoring | Core Web Vitals targets met |

---

## 9. Risk Management & Mitigation

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| Amplify hosting build failures | High | Medium | Implement comprehensive CI/CD with fallback deployments |
| API Gateway rate limits | Medium | Low | Implement client-side rate limiting and retry logic |
| Authentication token expiry | Medium | Medium | Automatic token refresh with graceful fallback |
| Performance degradation | High | Medium | Continuous monitoring with automated alerts |
| Direct AWS SDK client-side security | Medium | Medium | Use appropriate IAM policies and limit client permissions |

### 9.2 Business Risks

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| User adoption challenges | High | Medium | Comprehensive UX testing and gradual rollout |
| Security vulnerabilities | Very High | Low | Regular security audits and dependency updates |
| Scalability issues | Medium | Low | Load testing and auto-scaling configuration |

---

## 10. Maintenance & Support

### 10.1 Ongoing Maintenance Tasks
- **Weekly**: Security dependency updates, performance monitoring review
- **Monthly**: Code quality assessment, test coverage analysis
- **Quarterly**: Architecture review, technology stack updates
- **Annually**: Security audit, disaster recovery testing

### 10.2 Support Structure
- **Level 1**: Application monitoring and automated alerts
- **Level 2**: Development team on-call rotation
- **Level 3**: Architecture team for complex issues
- **Documentation**: Comprehensive runbooks and troubleshooting guides

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a modern, secure, and performant web application using **AWS Amplify for hosting only**, seamlessly integrating with your existing serverless microservices architecture. By following 2025 industry best practices and avoiding vendor lock-in through direct AWS SDK usage, the application will be maintainable, scalable, and provide an excellent user experience.

**Key Implementation Highlights:**
- **Hosting Only Approach**: Uses Amplify solely for static site hosting and CI/CD
- **Direct Integration**: Frontend communicates directly with existing API Gateway and Cognito
- **No Amplify SDK Dependency**: Uses standard AWS SDK for authentication and API calls
- **Existing Infrastructure**: Leverages your current serverless microservices without changes

The phased approach ensures steady progress with measurable milestones, while the focus on security, performance, and observability ensures the application meets enterprise-grade requirements without additional Amplify service dependencies.

For questions or clarifications on any aspect of this plan, please refer to the respective implementation sections or reach out to the development team.