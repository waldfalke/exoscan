import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

// Путь к файлу с пользователями (временное решение)
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

// Функция для чтения пользователей из файла
function readUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      // Создаем директорию и файл, если их нет
      const dir = path.dirname(USERS_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify([]))
      return []
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading users file:', error)
    return []
  }
}

// Функция для записи пользователей в файл
function writeUsers(users: User[]): void {
  try {
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  } catch (error) {
    console.error('Error writing users file:', error)
    throw new Error('Failed to save user data')
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = readUsers()
    
    // Убираем пароли из ответа
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safeUsers = users.map(({ password: _, ...user }) => user)
    
    return NextResponse.json({ users: safeUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { phone, email, password, role } = body

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Phone and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const users = readUsers()
    
    // Проверяем, что пользователь с таким телефоном не существует
    const existingUser = users.find(user => user.phone === phone)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this phone number already exists' },
        { status: 400 }
      )
    }

    // Проверяем email, если он указан
    if (email) {
      const existingEmailUser = users.find(user => user.email === email)
      if (existingEmailUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      }
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12)

    // Создаем нового пользователя
    const newUser: User = {
      id: `user-${Date.now()}`,
      phone,
      email: email || '',
      password: hashedPassword,
      role: role || 'employee',
      createdAt: new Date().toISOString()
    }

    users.push(newUser)
    writeUsers(users)
    
    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully',
      userId: newUser.id 
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}