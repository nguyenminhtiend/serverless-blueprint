import type { ISO8601 } from '@shared/types'

export const getCurrentISOString = (): ISO8601 => new Date().toISOString()

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

export const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

export const formatDate = (date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string => {
  const options: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: '2-digit', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  }
  
  return new Intl.DateTimeFormat('en-US', options[format]).format(date)
}

export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date)
}

export const isDateExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate
}

export const getDaysDifference = (date1: Date, date2: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((date2.getTime() - date1.getTime()) / msPerDay)
}

export const getStartOfDay = (date: Date): Date => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export const getEndOfDay = (date: Date): Date => {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

export const isValidDate = (date: any): date is Date => {
  return date instanceof Date && !isNaN(date.getTime())
}

export const parseISOString = (isoString: string): Date | null => {
  try {
    const date = new Date(isoString)
    return isValidDate(date) ? date : null
  } catch {
    return null
  }
}

export const getTTLTimestamp = (hoursFromNow: number): number => {
  return Math.floor((Date.now() + (hoursFromNow * 60 * 60 * 1000)) / 1000)
}

export const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  
  return formatDate(date, 'short')
}