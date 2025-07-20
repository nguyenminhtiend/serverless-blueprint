// Common utility types
export type UUID = string
export type ISO8601 = string
export type Email = string

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  metadata?: {
    timestamp: ISO8601
    requestId: string
    version: string
  }
}

// Pagination types
export interface PaginationParams {
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
    totalCount?: number
  }
}

// Status types
export type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'DELETED'

// Audit fields
export interface AuditFields {
  createdAt: ISO8601
  updatedAt: ISO8601
  createdBy?: UUID
  updatedBy?: UUID
}

// Error types
export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface BusinessError {
  code: string
  message: string
  context?: Record<string, any>
}