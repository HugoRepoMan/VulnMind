/** Sesión global persistida para conservar el acceso al recargar la SPA. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      theme: 'dark', // Para integración posterior con Tailwind dark mode
      setUser: (user) => set({ user }),
      setSession: ({ user, token }) => set({ user, token }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      logout: () => set({ user: null, token: null })
    }),
    {
      name: 'vulnmind-storage', 
    }
  )
);
