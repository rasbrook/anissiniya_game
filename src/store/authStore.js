import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            userId: null,
            isAuthenticated: false,
            setUser: (id) => set({ userId: id, isAuthenticated: true }),
            logout: () => set({ userId: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
        }
    )
)