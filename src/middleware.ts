import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Разрешаем публичный доступ к статическим файлам
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // Разрешаем все NextAuth API маршруты
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Перехватываем запросы к стандартной странице входа NextAuth
  if (pathname === '/api/auth/signin') {
    // Перенаправляем на нашу кастомную страницу логина
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Публичные маршруты, которые не требуют авторизации
  const publicPaths = ['/login', '/api/auth/signin', '/api/auth/callback']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Проверяем авторизацию для защищенных маршрутов
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  
  // Если пользователь не авторизован и пытается зайти на защищенную страницу
  if (!token && (pathname === '/' || pathname.startsWith('/api/inventory'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|images).*)',
  ]
}