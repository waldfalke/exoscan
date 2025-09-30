import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      phone?: string | null
      role?: string | null
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
    role?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    phone?: string
  }
}