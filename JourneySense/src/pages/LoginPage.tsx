import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { loginUser, logout } from '../actions/authActions'
import { store } from '../store'
import { useAppDispatch } from '../store/hooks'

export default function LoginPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!import.meta.env.VITE_API_BASE_URL) {
      setError('Thiếu VITE_API_BASE_URL — tạo file .env từ .env.example')
      return
    }
    setSubmitting(true)
    try {
      await dispatch(loginUser(email.trim(), password))
      const r = store.getState().auth.role ?? ''
      if (r === 'traveler') {
        const m = 'Portal web chỉ dành cho admin và staff.'
        setError(m)
        toast.warning(m)
        dispatch(logout())
        setSubmitting(false)
        return
      }
      toast.success('Đăng nhập thành công')
      if (r === 'admin') navigate('/admin/dashboard', { replace: true })
      else if (r === 'staff') navigate('/staff', { replace: true })
      else navigate('/', { replace: true })
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Đăng nhập thất bại'
      setError(m)
      toast.error(m)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-['Cormorant_Garamond',serif]">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-stone-50/90 backdrop-blur-sm border-b border-amber-100/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-wide text-stone-700">Journey Sense</span>
        </div>
        <div className="flex items-center gap-8 text-sm text-stone-500 font-['Lato',sans-serif]">
          <span className="text-stone-400">Cổng quản trị / nhân viên</span>
        </div>
      </nav>

      <div className="flex flex-1 pt-[60px]">
        <div className="relative hidden md:flex md:w-[48%] lg:w-[45%] min-h-[calc(100vh-60px)] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/55" />
          <div className="relative z-10 flex flex-col justify-end pb-16 px-10">
            <div className="max-w-md">
              <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg mb-3">
                <span className="block">
                  Chào mừng bạn <span className="whitespace-nowrap">trở lại</span>
                </span>
                <span className="block">hành trình của mình</span>
              </h1>
              <p className="text-white/85 text-sm font-['Lato',sans-serif] tracking-wide">
                Đăng nhập dành cho nhân viên và quản trị viên.
              </p>

              <div className="mt-7 flex flex-wrap gap-2 font-['Lato',sans-serif]">
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                  Theo dõi GPS thời gian thực
                </span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                  Quản trị hành trình
                </span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
                  Báo cáo &amp; phản hồi
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#fdfbf7] via-[#faf6ef] to-[#f5f0e8] px-8 py-12">
          <div className="w-full max-w-[420px] rounded-2xl border border-stone-200/80 bg-white/80 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-stone-100/80 backdrop-blur-sm sm:p-8">
            <form className="w-full" onSubmit={handleSubmit}>
              <div className="text-center mb-8">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/70">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-stone-800 mb-1">Đăng nhập</h2>
                <p className="text-sm text-stone-500 font-['Lato',sans-serif]">Cổng quản trị Journey Sense</p>
                <p className="mt-2 text-xs text-stone-400 font-['Lato',sans-serif]">Chỉ dành cho tài khoản nhân viên và quản trị viên.</p>
              </div>
            {error && (
              <p className="mb-3 text-sm text-red-600 font-['Lato',sans-serif]" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 font-['Lato',sans-serif]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Nhập email của bạn"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all duration-200 font-['Lato',sans-serif]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 font-['Lato',sans-serif]">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all duration-200 font-['Lato',sans-serif] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors duration-200 shadow-sm font-['Lato',sans-serif] mt-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập vào Journey Sense'}
              </button>
            </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
