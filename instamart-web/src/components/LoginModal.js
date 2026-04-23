import React, { useState } from 'react';
import { X } from 'lucide-react';
import { API_URL } from '../api';

const parseJsonResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text().catch(() => '');
  if (!contentType.includes('application/json') && !text.trim().startsWith('{')) return null;
  return JSON.parse(text);
};

const postAuth = async (path, body) => {
  const primaryUrl = `https://camigo-store.onrender.com/api${path}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fallbackUrls = [
    `${API_URL}${path}`,
    `${origin}${path}`,
    `https://camigo-store.onrender.com${path}`,
  ].filter((url, index, urls) => url && url !== primaryUrl && urls.indexOf(url) === index);
  const request = { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) };
  let res = await fetch(primaryUrl, request);
  let data = await parseJsonResponse(res);

  for (const fallbackUrl of fallbackUrls) {
    if (data) break;
    res = await fetch(fallbackUrl, request);
    data = await parseJsonResponse(res);
  }

  if (!data) throw new Error(`Login server returned website HTML instead of JSON. API tried: ${primaryUrl}`);
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
};

function LoginModal({ open, onClose, onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        const loginId = email.trim();
        const data = await postAuth('/auth/login', { email: loginId, loginId, phone: loginId, password });
        onLogin(data);
      } else {
        await postAuth('/auth/register', { email, password, name, phone, address });
        setMode('login'); setError('Registered! Please login.');
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  };
  if (!open) return null;
  return (
    <div className={`modal-overlay ${open ? 'open' : ''}`} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
        <div className="login-body">
          <h2>{mode === 'login' ? 'Login' : 'Create Account'}</h2>
          <p>{mode === 'login' ? 'Welcome back to Camigo' : 'Join Camigo for fast CCTV delivery'}</p>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (<><div className="form-group"><label>Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} required /></div><div className="form-group"><label>Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></div><div className="form-group"><label>Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} rows="2" required /></div></>)}
            <div className="form-group"><label>Login ID</label><input type="text" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="form-group"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}</button>
          </form>
          <div className="login-divider">or</div>
          <button className="submit-btn" style={{ background: '#333' }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create new account' : 'Already have an account? Login'}</button>
        </div>
      </div>
    </div>
  );
}
export default LoginModal;
