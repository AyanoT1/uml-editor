import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'uml-editor:theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

const resolve = (mode: ThemeMode) => (mode === 'system' ? (media.matches ? 'dark' : 'light') : mode)

function apply(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

export const useTheme = create<{ mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (m: ThemeMode) => void }>()(
  (set) => ({
    mode: readMode(),
    resolved: resolve(readMode()),
    setMode(mode) {
      try {
        localStorage.setItem(KEY, mode)
      } catch {
        /* storage unavailable */
      }
      const resolved = resolve(mode)
      apply(resolved)
      set({ mode, resolved })
    },
  }),
)

apply(useTheme.getState().resolved)
media.addEventListener('change', () => {
  const { mode } = useTheme.getState()
  const resolved = resolve(mode)
  apply(resolved)
  useTheme.setState({ resolved })
})
