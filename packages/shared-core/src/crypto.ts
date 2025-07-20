import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto'

export const hashPassword = (password: string, salt?: string): { hash: string; salt: string } => {
  const passwordSalt = salt || randomBytes(32).toString('hex')
  const hash = pbkdf2Sync(password, passwordSalt, 10000, 64, 'sha512').toString('hex')
  return { hash, salt: passwordSalt }
}

export const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  const hashedPassword = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashedPassword, 'hex'))
}

export const generateSecureToken = (length: number = 32): string => {
  return randomBytes(length).toString('hex')
}

export const hashString = (input: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string => {
  return createHash(algorithm).update(input).digest('hex')
}

export const generateApiKey = (): string => {
  const prefix = 'sk_'
  const key = randomBytes(24).toString('base64').replace(/[+/=]/g, '')
  return prefix + key
}

export const maskString = (str: string, visibleChars: number = 4): string => {
  if (str.length <= visibleChars * 2) {
    return '*'.repeat(str.length)
  }
  
  const start = str.substring(0, visibleChars)
  const end = str.substring(str.length - visibleChars)
  const middle = '*'.repeat(str.length - visibleChars * 2)
  
  return start + middle + end
}

export const generateOtp = (length: number = 6): string => {
  const digits = '0123456789'
  let otp = ''
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)]
  }
  
  return otp
}

export const createChecksum = (data: string): string => {
  return hashString(data, 'sha256').substring(0, 8)
}

export const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false
  }
  
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}