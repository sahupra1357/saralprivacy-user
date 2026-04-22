import axiosInstance from './axiosInstance';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth';

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await axiosInstance.post<AuthResponse>('/auth/login', data);
  return res.data;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await axiosInstance.post<AuthResponse>('/auth/register', data);
  return res.data;
}

export async function logout(): Promise<void> {
  await axiosInstance.post('/auth/logout');
}

export async function refreshToken(): Promise<{ access_token: string }> {
  const res = await axiosInstance.post<{ access_token: string }>('/auth/refresh');
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await axiosInstance.get<User>('/auth/me');
  return res.data;
}

export async function exchangeSSOToken(orchToken: string): Promise<AuthResponse> {
  const res = await axiosInstance.post<AuthResponse>('/auth/sso-token', { orch_token: orchToken });
  return res.data;
}
