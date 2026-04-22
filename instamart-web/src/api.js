export const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();
