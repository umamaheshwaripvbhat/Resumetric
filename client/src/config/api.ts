import { Platform } from 'react-native';

/**
 * REMOTE ACCESS MODE:
 * If you are using this in another state, you must set EXPO_PUBLIC_API_URL
 * or VITE_API_URL
 * environment variable to your public tunnel URL (e.g., https://my-backend.loca.lt)
 */
const envApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL;

// Local Defaults (used if no env variable is provided)
const LOCAL_IP = '172.20.10.2'; // Your laptop's local IP for physical devices
const DEFAULT_WEB_API_URL = 'http://localhost:5000';
const DEFAULT_ANDROID_API_URL = 'http://10.0.2.2:5000'; // Standard Android Emulator loopback
const DEFAULT_NATIVE_API_URL = `http://${LOCAL_IP}:5000`;

export const API_BASE_URL =
  envApiUrl ||
  (Platform.OS === 'android'
    ? DEFAULT_ANDROID_API_URL
    : Platform.OS === 'web'
    ? DEFAULT_WEB_API_URL
    : DEFAULT_NATIVE_API_URL);

console.log(`[API] Connecting to: ${API_BASE_URL}`);

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const url = apiUrl(path);
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      console.warn(`[API] Request to ${url} returned status ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error(`[API] Connection failed at ${url}`);
    throw new Error(`Backend not reachable. Ensure your tunnel or server is running at ${API_BASE_URL}`);
  }
}

export async function checkBackendHealth() {
  try {
    const response = await apiFetch('/');
    return response.ok;
  } catch (e) {
    return false;
  }
}
