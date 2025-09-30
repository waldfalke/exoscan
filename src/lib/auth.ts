import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

interface User {
  id: string
  phone: string
  email: string
  password: string
  role: 'admin' | 'employee'
  createdAt: string
}

// Путь к файлу с пользователями
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

// Функция для чтения пользователей из файла
function readUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // Создаем директорию и файл с админом по умолчанию
      const dir = path.dirname(USERS_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      // Создаем админа по умолчанию
      const defaultAdmin: User = {
        id: 'admin-1',
        phone: '+79991234567',
        email: 'admin@exoscan.ru',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9qK', // password123
        role: 'admin',
        createdAt: new Date().toISOString()
      }
      
      fs.writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2))
      return [defaultAdmin]
    }
    
    const data = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading users file:', error)
    return []
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        login: { label: "Телефон или Email", type: "text" },
        password: { label: "Пароль", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          return null
        }

        // Поиск пользователя по телефону или email
        const users = readUsers()
        const user = users.find(u => 
          u.phone === credentials.login || u.email === credentials.login
        )

        if (!user) {
          return null
        }

        // Проверка пароля
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          name: user.role === 'admin' ? 'Администратор' : 'Сотрудник',
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || undefined
        token.phone = user.phone || undefined
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = (token.role as string) || undefined
        session.user.phone = (token.phone as string) || undefined
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Всегда перенаправляем на нашу кастомную страницу логина
      if (url.includes('/api/auth/signin')) {
        return `${baseUrl}/login`
      }
      // Если пользователь уже авторизован, перенаправляем на главную
      if (url.startsWith(baseUrl)) {
        return url
      }
      return baseUrl
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development'
}