# Serverless Web App

A modern web application built with Next.js 15, React 19, Tailwind CSS 4.0, and AWS Cognito authentication following 2025 industry best practices.

## 🚀 Features

- **Next.js 15** with App Router and Server Components
- **React 19** with latest features and improvements
- **Tailwind CSS 4.0** with enhanced performance and new architecture
- **TypeScript 5.9** for type safety
- **AWS Cognito** for secure authentication
- **TanStack Query v5** for data fetching and state management
- **React Hook Form** with Zod validation
- **Zustand** for client-side state management
- **Shadcn/ui** components with Radix UI primitives

## 🛠️ Tech Stack

| Technology      | Version | Purpose                  |
| --------------- | ------- | ------------------------ |
| Next.js         | 15.4+   | React framework with SSR |
| React           | 19.1+   | UI library               |
| TypeScript      | 5.9+    | Type safety              |
| Tailwind CSS    | 4.1+    | Utility-first CSS        |
| AWS SDK         | 3.863+  | AWS Cognito integration  |
| TanStack Query  | 5.84+   | Data fetching & caching  |
| React Hook Form | 7.62+   | Form handling            |
| Zod             | 4.0+    | Schema validation        |
| Zustand         | 5.0+    | State management         |

## 📁 Project Structure

```
web-app/
├── src/
│   ├── app/                     # Next.js 15 App Router
│   │   ├── auth/               # Authentication pages
│   │   ├── dashboard/          # Dashboard page
│   │   ├── orders/             # Order management
│   │   ├── globals.css         # Global styles with Tailwind
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── forms/              # Form components
│   │   ├── layouts/            # Layout components
│   │   └── providers/          # Context providers
│   ├── lib/
│   │   ├── auth/               # AWS Cognito client
│   │   ├── api/                # API client
│   │   ├── validations/        # Zod schemas
│   │   └── utils.ts            # Utility functions
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript definitions
├── public/                     # Static assets
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 22.0 or later
- pnpm 10.0 or later

### Installation

This web-app is part of the serverless-blueprint pnpm workspace.

1. **From the workspace root**:

   ```bash
   # Install all workspace dependencies
   pnpm install
   ```

2. **Or install web-app dependencies only**:

   ```bash
   cd web-app
   pnpm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your AWS Cognito configuration:

   ```bash
   NEXT_PUBLIC_AWS_REGION=us-east-1
   NEXT_PUBLIC_AWS_USER_POOL_ID=your-user-pool-id
   NEXT_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=your-client-id
   NEXT_PUBLIC_API_GATEWAY_URL=your-api-gateway-url
   ```

4. **Run the development server**:

   ```bash
   # From workspace root
   pnpm -w run web:dev

   # Or from web-app directory
   cd web-app
   pnpm dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

## 📜 Available Scripts

### Web-app Scripts (from web-app directory)

| Script           | Description              |
| ---------------- | ------------------------ |
| `pnpm dev`       | Start development server |
| `pnpm build`     | Build for production     |
| `pnpm start`     | Start production server  |
| `pnpm lint`      | Run ESLint               |
| `pnpm typecheck` | Run TypeScript checks    |
| `pnpm clean`     | Clean build artifacts    |

### Workspace Scripts (from root directory)

| Script                  | Description                      |
| ----------------------- | -------------------------------- |
| `pnpm -w run web:dev`   | Start web-app development server |
| `pnpm -w run web:build` | Build web-app for production     |
| `pnpm -w run web:start` | Start web-app production server  |
| `pnpm run build`        | Build all workspace packages     |
| `pnpm run lint`         | Lint all workspace packages      |
| `pnpm run typecheck`    | TypeScript check all packages    |

## 🎨 Styling

This project uses **Tailwind CSS 4.0** with:

- **CSS-first configuration** using `@theme` directive
- **Modern CSS features** like native cascade layers and `color-mix()`
- **Custom color palette** with OKLCH color space
- **Dark mode** support with `prefers-color-scheme`
- **Responsive design** with mobile-first approach

### Tailwind CSS 4.0 Features Used

- `@import "tailwindcss"` - Single import for all Tailwind features
- `@theme` directive for CSS-first configuration
- Modern CSS properties and functions
- Enhanced performance with new engine

## 🔐 Authentication

Authentication is handled using **AWS Cognito** with direct SDK integration:

- User registration with email verification
- Secure login/logout
- Token refresh handling
- Password reset functionality
- Protected routes and components

## 📊 State Management

- **Server state**: TanStack Query v5 for data fetching and caching
- **Client state**: Zustand for lightweight state management
- **Form state**: React Hook Form with Zod validation

## 🔄 API Integration

The app integrates with serverless backend APIs:

- RESTful API client with authentication headers
- Automatic token refresh
- Error handling and retry logic
- TypeScript interfaces for API responses

## 🧪 Development

### Code Quality

- **TypeScript** for type safety
- **ESLint** with Next.js recommended rules
- **Prettier** for code formatting
- **Strict mode** enabled for better development experience

### Performance

- **Next.js 15** with App Router for optimal performance
- **React 19** with concurrent features
- **Tailwind CSS 4.0** with enhanced build performance
- **Automatic code splitting** and lazy loading

## 🚀 Deployment

The application is designed for deployment on:

- **Vercel** (recommended for Next.js)
- **AWS Amplify** (hosting only)
- **Netlify**
- Any Node.js hosting platform

### Build for Production

```bash
npm run build
```

## 📝 Next Steps

This is the foundation setup for Phase 1. Next phases will include:

1. **Phase 2**: Authentication implementation
2. **Phase 3**: API integration and state management
3. **Phase 4**: Core features (order management)
4. **Phase 5**: UI components and design system
5. **Phase 6**: Testing and quality assurance
6. **Phase 7**: Deployment and production setup

## 🤝 Contributing

1. Follow the existing code style
2. Use TypeScript for all new files
3. Add tests for new features
4. Update documentation as needed

## 📄 License

This project is part of the serverless-blueprint and follows the same licensing terms.
