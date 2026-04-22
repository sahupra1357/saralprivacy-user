import axios from 'axios';

const axiosInstance = axios.create({ baseURL: '/api', withCredentials: true });

let _accessToken: string | null = null;
let _onLogout: (() => Promise<void>) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function setLogoutHandler(handler: () => Promise<void>): void {
  _onLogout = handler;
}

axiosInstance.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers['Authorization'] = `Bearer ${_accessToken}`;
  }
  return config;
});

let isRefreshing = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !isRefreshing &&
      _accessToken !== null
    ) {
      isRefreshing = true;
      try {
        const { data } = await axios.post<{ access_token: string }>('/api/auth/refresh', {}, { withCredentials: true });
        _accessToken = data.access_token;
        if (axios.isAxiosError(error) && error.config) {
          error.config.headers['Authorization'] = `Bearer ${_accessToken}`;
          return axiosInstance(error.config);
        }
      } catch {
        _accessToken = null;
        if (_onLogout) await _onLogout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
