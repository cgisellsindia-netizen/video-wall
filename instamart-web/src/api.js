export const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isLocalWeb = (hostname === 'localhost' || hostname === '127.0.0.1') && (protocol === 'http:' || protocol === 'https:');
    const isCamigoHostedOrigin = (
      hostname === 'getcamigo.in'
      || hostname === 'www.getcamigo.in'
      || origin.includes('camigo-store.onrender.com')
    );

    if (protocol === 'capacitor:' || protocol === 'ionic:' || !isLocalWeb) {
      return isCamigoHostedOrigin ? `${origin}/api` : 'https://camigo-store.onrender.com/api';
    }

    return 'http://localhost:3001/api';
  }

  return 'https://camigo-store.onrender.com/api';
};

export const API_URL = getApiUrl();
