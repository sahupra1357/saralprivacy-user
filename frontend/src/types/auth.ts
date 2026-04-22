export interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  provider: 'local' | 'google' | 'orchestrator';
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface SSOTokenRequest {
  orch_token: string;
}
