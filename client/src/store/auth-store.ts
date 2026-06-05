// Zustand auth store — JWT, role, areaId persistence

import { create } from 'zustand';
import type { UserRow } from '../types';

interface AuthState {
  user: UserRow | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isDefaultPassword: boolean;
  login: (user: UserRow, token: string, refreshToken: string) => void;
  logout: () => void;
  setDefaultPassword: (value: boolean) => void;
  updateToken: (token: string, refreshToken: string) => void;
}

const savedUser = localStorage.getItem('user');
const savedToken = localStorage.getItem('token');
const savedRefreshToken = localStorage.getItem('refreshToken');

export const useAuthStore = create<AuthState>((set) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  token: savedToken,
  refreshToken: savedRefreshToken,
  isAuthenticated: !!savedToken && !!savedUser,
  isDefaultPassword: false,

  login: (user, token, refreshToken) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, token, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isDefaultPassword: false });
  },

  setDefaultPassword: (value) => {
    set({ isDefaultPassword: value });
  },

  updateToken: (token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    set({ token, refreshToken });
  },
}));