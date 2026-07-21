import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      user: null,
      theme: 'dark', // Para integración posterior con Tailwind dark mode
      setUser: (user) => set({ user }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      logout: () => set({ user: null })
    }),
    {
      name: 'vulnmind-storage', 
    }
  )
);
