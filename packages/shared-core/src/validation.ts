import { z } from 'zod'
import type { ValidationError } from '@shared/types'

export const EmailSchema = z.string().email()
export const UuidSchema = z.string().uuid()
export const PasswordSchema = z.string().min(8).max(128)

export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
})

export const validateEmail = (email: string): boolean => {
  return EmailSchema.safeParse(email).success
}

export const validateUuid = (id: string): boolean => {
  return UuidSchema.safeParse(id).success
}


export const createValidationError = (field: string, message: string, value?: unknown): ValidationError => {
  return { field, message, value }
}

export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: ValidationError[] } => {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => 
    createValidationError(
      err.path.join('.'),
      err.message,
      err.code
    )
  )
  
  return { success: false, errors }
}

export const phoneNumberSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format'
)

export const zipCodeSchema = z.string().regex(
  /^\d{5}(-\d{4})?$/,
  'Invalid ZIP code format'
)

export const creditCardSchema = z.string().regex(
  /^\d{13,19}$/,
  'Invalid credit card number'
)

