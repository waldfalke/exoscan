'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Загружаем сохраненные данные при монтировании
  useEffect(() => {
    const savedPhone = localStorage.getItem('exoscan_remembered_phone')
    const savedRemember = localStorage.getItem('exoscan_remember_me') === 'true'
    
    if (savedPhone && savedRemember) {
      setPhone(savedPhone)
      setRememberMe(true)
    }
  }, [])

  // Функция для форматирования номера телефона
  const formatPhoneNumber = (value: string): string => {
    // Убираем все нецифровые символы
    let digits = value.replace(/\D/g, '')
    
    // Если начинается с 8, заменяем на 7
    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1)
    }
    
    // Если начинается с 7, добавляем +
    if (digits.startsWith('7')) {
      digits = '+' + digits
    }
    
    // Если не начинается с +7, добавляем +7
    if (!digits.startsWith('+7') && digits.length > 0) {
      digits = '+7' + digits
    }
    
    // Применяем маску +7 (XXX) XXX-XX-XX
    if (digits.startsWith('+7')) {
      const phoneDigits = digits.slice(2) // убираем +7
      let formatted = '+7'
      
      if (phoneDigits.length > 0) {
        formatted += ' (' + phoneDigits.slice(0, 3)
        if (phoneDigits.length > 3) {
          formatted += ') ' + phoneDigits.slice(3, 6)
          if (phoneDigits.length > 6) {
            formatted += '-' + phoneDigits.slice(6, 8)
            if (phoneDigits.length > 8) {
              formatted += '-' + phoneDigits.slice(8, 10)
            }
          }
        }
      }
      
      return formatted
    }
    
    return digits
  }

  // Функция для получения чистого номера (только цифры с +7)
  const getCleanPhoneNumber = (formattedPhone: string): string => {
    const digits = formattedPhone.replace(/\D/g, '')
    if (digits.startsWith('7')) {
      return '+' + digits
    }
    return formattedPhone
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatPhoneNumber(value)
    setPhone(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Получаем чистый номер для отправки
    const cleanPhone = getCleanPhoneNumber(phone)

    try {
      const result = await signIn('credentials', {
        login: cleanPhone,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Неверный номер телефона или пароль')
      } else {
        // Сохраняем данные если включен "Запомнить"
        if (rememberMe) {
          localStorage.setItem('exoscan_remembered_phone', cleanPhone)
          localStorage.setItem('exoscan_remember_me', 'true')
        } else {
          localStorage.removeItem('exoscan_remembered_phone')
          localStorage.removeItem('exoscan_remember_me')
        }
        
        router.push('/')
      }
    } catch {
      setError('Произошла ошибка при входе')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-4 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Вход в ExoScan
          </h2>
          <p className="mt-3 text-base text-gray-800 font-medium">
            Введите ваш номер телефона и пароль
          </p>
        </div>
        <form className="bg-white p-8 rounded-xl shadow-lg border space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Поле номера телефона */}
            <div>
              <label htmlFor="phone" className="block text-sm font-bold text-gray-900 mb-2">
                Номер телефона
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="appearance-none relative block w-full px-4 py-4 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-base font-medium"
                placeholder="+7 (999) 123-45-67"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={18} // +7 (XXX) XXX-XX-XX
              />
              <p className="mt-2 text-sm text-gray-700 font-medium">
                Можно вводить с 8 или +7, автоматически преобразуется
              </p>
            </div>

            {/* Поле пароля */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-900 mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="appearance-none relative block w-full px-4 py-4 pr-12 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-base font-medium"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer z-20"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowPassword(!showPassword)
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-6 w-6 text-gray-600 hover:text-gray-800 transition-colors" />
                  ) : (
                    <EyeIcon className="h-6 w-6 text-gray-600 hover:text-gray-800 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Чекбокс "Запомнить пользователя" */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-2 border-gray-300 rounded"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-3 block text-base text-gray-900 font-medium select-none">
                Запомнить пользователя
              </label>
            </div>
          </div>

          {error && (
            <div className="text-red-800 text-base font-medium text-center bg-red-50 border-2 border-red-200 p-4 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}