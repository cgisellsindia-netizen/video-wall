import React, { useState } from 'react';
import { X } from 'lucide-react';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
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
        const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onLogin(data);
      } else {
        const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, phone, address }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
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
