interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: Request) => string
}

interface MockResponse {
  setHeader: (name: string, value: string | number) => void
  status: (code: number) => {
    json: (data: Record<string, unknown>) => void
  }
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key)
      }
    }
  }

  private getKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req)
    }
    
    // Default key generation using IP
    const reqWithIp = req as Request & { ip?: string; connection?: { remoteAddress?: string } }
    return reqWithIp.ip || reqWithIp.connection?.remoteAddress || 'unknown'
  }

  async checkLimit(req: Request): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getKey(req)
    const now = Date.now()
    const resetTime = now + this.config.windowMs

    let entry = this.store.get(key)

    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime
      }
      this.store.set(key, entry)
      
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime
      }
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      }
    }

    entry.count++
    this.store.set(key, entry)

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const sheetsApiLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Google Sheets API quota consideration
  keyGenerator: (req) => {
    const reqWithIp = req as Request & { ip?: string }
    return `sheets:${reqWithIp.ip || 'unknown'}`
  }
})

export const scanApiLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // Scanning operations
  keyGenerator: (req) => {
    const reqWithIp = req as Request & { ip?: string }
    return `scan:${reqWithIp.ip || 'unknown'}`
  }
})

export const authApiLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // Auth attempts
  keyGenerator: (req) => {
    const reqWithIp = req as Request & { ip?: string }
    return `auth:${reqWithIp.ip || 'unknown'}`
  }
})

// Middleware factory
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (req: Request, res: MockResponse, next: () => void) => {
    try {
      const result = await limiter.checkLimit(req)
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter['config'].maxRequests)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000))

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        })
        return
      }

      next()
    } catch (error) {
      console.error('Rate limiter error:', error)
      // Fail open - allow request if rate limiter fails
      next()
    }
  }
}