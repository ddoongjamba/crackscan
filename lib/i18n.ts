import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['ko', 'ja'] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'ko'

export default getRequestConfig(async () => {
  // profiles.locale을 쿠키에 저장해두고 읽거나, 기본값 사용
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? defaultLocale) as AppLocale
  const validLocale = locales.includes(locale) ? locale : defaultLocale

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  }
})
