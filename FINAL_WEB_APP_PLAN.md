# Final Web App Implementation Plan
## Modern Next.js 15 + Direct Cognito Integration

### Executive Summary

This plan creates a production-ready web application using **Next.js 15** with **Server-Side Rendering (SSR)** and **direct AWS Cognito integration**. The app will integrate seamlessly with your existing serverless backend APIs while following 2025 industry best practices.

**Key Features:**
- User registration, login, logout with token refresh
- Simple order creation form
- Order lookup by ID
- Direct integration with existing serverless APIs
- Modern tech stack with latest package versions

---

## Technology Stack

**Frontend Framework:** Next.js 15.4.6 with App Router
**React:** 19.1.1 (latest stable)
**Authentication:** Direct AWS Cognito SDK integration
**State Management:** TanStack Query v5 + Zustand
**UI Framework:** Tailwind CSS v4 + Shadcn/ui + Radix UI
**Validation:** Zod v4 + React Hook Form v7
**TypeScript:** 5.9.2
**Deployment:** AWS Amplify Hosting (hosting only)

---

## Phase-by-Phase Implementation

### Phase 1: Foundation Setup (Week 1)
**Goal:** Initialize project with proper structure and configuration

#### 1.1 Project Structure
```
web-app/
├── src/
│   ├── app/                     # Next.js 15 App Router
│   │   ├── (auth)/             # Route groups
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── orders/
│   │   │   ├── new/
│   │   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── forms/              # Form components
│   │   ├── layouts/            # Layout components
│   │   └── providers/          # Context providers
│   ├── lib/
│   │   ├── auth/               # Cognito client
│   │   ├── api/                # API client
│   │   ├── validations/        # Zod schemas
│   │   └── utils.ts
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript definitions
├── public/                     # Static assets
├── .env.example
├── next.config.js
├── tailwind.config.js
├── package.json
└── README.md
```

#### 1.2 Package Installation
```json
{
  "name": "serverless-web-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.4.6",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "@aws-sdk/client-cognito-identity-provider": "^3.863.0",
    "@tanstack/react-query": "^5.84.1",
    "@hookform/resolvers": "^5.2.1",
    "react-hook-form": "^7.62.0",
    "zod": "^4.0.15",
    "zustand": "^5.0.7",
    "tailwindcss": "^4.1.11",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.7.0",
    "lucide-react": "^0.537.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.4",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.3",
    "typescript": "^5.9.2",
    "eslint": "^9.19.0",
    "eslint-config-next": "^15.4.6",
    "prettier": "^3.4.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

#### 1.3 Environment Configuration
```bash
# .env.example
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AWS_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=your-client-id
NEXT_PUBLIC_API_GATEWAY_URL=your-api-gateway-url
NEXT_PUBLIC_ENVIRONMENT=development
```

---

### Phase 2: Authentication Implementation (Week 2)
**Goal:** Implement complete authentication flow with direct Cognito integration

#### 2.1 Cognito Client Setup
```typescript
// src/lib/auth/cognito-client.ts
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  RefreshTokenAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'

class CognitoAuthClient {
  private client: CognitoIdentityProviderClient
  private clientId: string

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION!,
    })
    this.clientId = process.env.NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID!
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

  async refreshToken(refreshToken: string) {
    const command = new RefreshTokenAuthCommand({
      ClientId: this.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
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

#### 2.2 Authentication Hook
```typescript
// src/hooks/use-auth.ts
import { useState, useEffect, createContext, useContext } from 'react'
import { cognitoAuthClient } from '@/lib/auth/cognito-client'

interface AuthUser {
  email: string
  firstName: string
  lastName: string
  accessToken: string
  refreshToken: string
  idToken: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserFromStorage()
  }, [])

  const signIn = async (email: string, password: string) => {
    const response = await cognitoAuthClient.signIn(email, password)
    // Handle response and store tokens
    // Implementation details...
  }

  const signOut = async () => {
    if (user?.accessToken) {
      await cognitoAuthClient.signOut(user.accessToken)
    }
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  return { user, loading, signIn, signOut }
}
```

#### 2.3 Login & Register Forms
- Create responsive login/register forms using React Hook Form + Zod
- Implement proper error handling and validation
- Add loading states and accessibility features

---

### Phase 3: API Integration & State Management (Week 3)
**Goal:** Connect to existing serverless APIs with proper state management

#### 3.1 API Client Setup
```typescript
// src/lib/api/client.ts
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

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = this.getAuthHeaders()
    const config: RequestInit = {
      ...options,
      headers: { ...headers, ...options.headers },
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config)

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }
}
```

#### 3.2 React Query Setup
```typescript
// src/hooks/api/use-orders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/lib/api/client'

export function useCreateOrder() {
  const apiClient = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderData: any) => apiClient.post('/orders', orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useOrder(orderId: string) {
  const apiClient = useApiClient()

  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => apiClient.get(`/orders/${orderId}`),
    enabled: !!orderId,
  })
}
```

---

### Phase 4: Core Features Implementation (Week 4)
**Goal:** Build the main user features

#### 4.1 Order Creation Form
```typescript
// src/app/orders/new/page.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateOrder } from '@/hooks/api/use-orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const orderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  items: z.string().min(1, 'Items are required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
})

export default function NewOrderPage() {
  const createOrder = useCreateOrder()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(orderSchema),
  })

  const onSubmit = async (data: any) => {
    try {
      await createOrder.mutateAsync(data)
      // Redirect to success page
    } catch (error) {
      // Handle error
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        {...register('customerName')}
        placeholder="Customer Name"
        error={errors.customerName?.message}
      />
      {/* Additional form fields */}
      <Button type="submit" loading={createOrder.isPending}>
        Create Order
      </Button>
    </form>
  )
}
```

#### 4.2 Order Lookup
```typescript
// src/app/orders/[id]/page.tsx
'use client'

import { useOrder } from '@/hooks/api/use-orders'
import { useParams } from 'next/navigation'

export default function OrderDetailsPage() {
  const params = useParams()
  const { data: order, isLoading, error } = useOrder(params.id as string)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading order</div>
  if (!order) return <div>Order not found</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Order #{order.id}</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-medium">Customer:</label>
          <p>{order.customerName}</p>
        </div>
        <div>
          <label className="font-medium">Status:</label>
          <p>{order.status}</p>
        </div>
        {/* Additional order details */}
      </div>
    </div>
  )
}
```

#### 4.3 Dashboard
```typescript
// src/app/dashboard/page.tsx
import { useAuth } from '@/hooks/use-auth'
import { useUserOrders } from '@/hooks/api/use-orders'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: orders } = useUserOrders()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName}!</h1>
        <p className="text-muted-foreground">Manage your orders and account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-lg">
          <h3 className="font-semibold">Total Orders</h3>
          <p className="text-2xl font-bold">{orders?.length || 0}</p>
        </div>
        {/* Additional dashboard cards */}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        {/* Order list component */}
      </div>
    </div>
  )
}
```

---

### Phase 5: UI Components & Design (Week 5)
**Goal:** Create a polished, accessible user interface

#### 5.1 Design System Setup
- Implement Tailwind CSS v4 configuration
- Set up Shadcn/ui component library
- Create consistent design tokens and spacing
- Implement dark/light mode support

#### 5.2 Component Development
- Build reusable UI components (Button, Input, Card, etc.)
- Create form components with validation
- Implement loading states and error boundaries
- Add responsive design for mobile/desktop

#### 5.3 Navigation & Layout
- Create main navigation with protected routes
- Implement breadcrumbs and page headers
- Add user menu with logout functionality
- Design responsive sidebar for mobile

---

### Phase 6: Testing & Quality Assurance (Week 6)
**Goal:** Ensure code quality and reliability

#### 6.1 Testing Setup
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
```

#### 6.2 Test Implementation
- Unit tests for components and hooks
- Integration tests for authentication flow
- API client tests with mocked responses
- Form validation tests

#### 6.3 Code Quality
- ESLint configuration with TypeScript rules
- Prettier for code formatting
- Pre-commit hooks with Husky
- Type checking with TypeScript strict mode

---

### Phase 7: Deployment & Production Setup (Week 7)
**Goal:** Deploy to production with proper configuration

#### 7.1 AWS Amplify Setup (Hosting Only)
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
    appRoot: web-app
```

#### 7.2 Environment Configuration
- Set up production environment variables
- Configure AWS Cognito for production
- Set up custom domain and SSL certificate
- Configure CDN and caching policies

#### 7.3 CI/CD Pipeline
- Automated builds on git push
- Branch-based deployments (main → production, develop → staging)
- Build optimization and testing integration

---

## Implementation Checklist

### Phase 1: Foundation ✅
- [ ] Initialize Next.js 15 project with App Router
- [ ] Install all dependencies with correct versions
- [ ] Set up project structure and configuration
- [ ] Configure TypeScript, ESLint, and Prettier
- [ ] Set up environment variables

### Phase 2: Authentication ✅
- [ ] Implement Cognito client with AWS SDK
- [ ] Create authentication hook with token management
- [ ] Build login and registration forms
- [ ] Add token refresh functionality
- [ ] Implement logout and session management

### Phase 3: API Integration ✅
- [ ] Set up API client with authentication headers
- [ ] Configure React Query for state management
- [ ] Create API hooks for orders and users
- [ ] Implement error handling and retry logic
- [ ] Add loading states and optimistic updates

### Phase 4: Core Features ✅
- [ ] Build order creation form with validation
- [ ] Implement order lookup by ID
- [ ] Create user dashboard with order overview
- [ ] Add order status and history views
- [ ] Implement user profile management

### Phase 5: UI/UX ✅
- [ ] Set up Tailwind CSS and Shadcn/ui
- [ ] Create design system and component library
- [ ] Build responsive layouts and navigation
- [ ] Add loading states and error boundaries
- [ ] Implement accessibility features

### Phase 6: Testing ✅
- [ ] Set up testing framework (Vitest)
- [ ] Write unit tests for components
- [ ] Add integration tests for auth flow
- [ ] Test API integration with mocks
- [ ] Set up code quality tools

### Phase 7: Deployment ✅
- [ ] Configure AWS Amplify for hosting
- [ ] Set up production environment
- [ ] Deploy to staging for testing
- [ ] Configure custom domain
- [ ] Deploy to production

---

## Next Steps

1. **Start with Phase 1**: Initialize the project structure and dependencies
2. **Follow incrementally**: Complete each phase before moving to the next
3. **Test continuously**: Ensure each feature works before adding new ones
4. **Reference existing APIs**: Use your current serverless backend endpoints
5. **Iterate and improve**: Gather feedback and refine features

This plan provides a solid foundation for your modern web application while maintaining simplicity and following industry best practices. Each phase builds upon the previous one, allowing you to have a working application at each milestone.

Would you like me to start implementing Phase 1, or do you have any questions about the plan?