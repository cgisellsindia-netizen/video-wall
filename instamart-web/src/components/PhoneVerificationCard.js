import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { API_URL } from '../api';
import { RecaptchaVerifier, firebaseAuth, firebasePhoneAuthReady, signInWithPhoneNumber, signOut } from '../firebaseClient';

const cleanPhone = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

function PhoneVerificationCard({ user, onUserUpdate }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);
  const recaptchaId = useMemo(
    () => `camigo-phone-recaptcha-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    setPhone(user?.phone || '');
    setOtp('');
    setOtpSent(false);
    setStatus('');
    setError('');
    confirmationRef.current = null;
    resetRecaptcha();
  }, [user?.id, user?.phone]);

  const ensureRecaptcha = async () => {
    if (!firebasePhoneAuthReady || !firebaseAuth) {
      throw new Error('Firebase phone verification is not ready on this app build yet.');
    }
    if (recaptchaRef.current) return recaptchaRef.current;

    const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaId, {
      size: 'invisible',
      callback: () => {}
    });
    await verifier.render();
    recaptchaRef.current = verifier;
    return verifier;
  };

  const resetRecaptcha = () => {
    try {
      recaptchaRef.current?.clear?.();
    } catch (e) {}
    recaptchaRef.current = null;
  };

  const sendOtp = async () => {
    const safePhone = cleanPhone(phone);
    if (!/^\d{10}$/.test(safePhone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSending(true);
    setError('');
    setStatus('');
    try {
      const verifier = await ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, `+91${safePhone}`, verifier);
      setOtpSent(true);
      setStatus(`OTP sent to +91 ${safePhone}. Enter the code to finish verification.`);
    } catch (otpError) {
      resetRecaptcha();
      setError(otpError.message || 'Could not send OTP right now.');
    }
    setSending(false);
  };

  const verifyOtp = async () => {
    if (!confirmationRef.current) {
      setError('Send OTP first.');
      return;
    }
    if (!otp.trim()) {
      setError('Enter the OTP code sent to your mobile.');
      return;
    }

    setVerifying(true);
    setError('');
    setStatus('');
    try {
      const credential = await confirmationRef.current.confirm(otp.trim());
      const idToken = await credential.user.getIdToken(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/auth/phone/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          idToken,
          phone: cleanPhone(phone)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');

      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        onUserUpdate?.(data.user);
      }
      setOtp('');
      setOtpSent(false);
      setStatus('Mobile number verified successfully. You can now use mobile login and checkout.');
      await signOut(firebaseAuth).catch(() => {});
      confirmationRef.current = null;
      resetRecaptcha();
    } catch (verifyError) {
      setError(verifyError.message || 'OTP verification failed.');
    }
    setVerifying(false);
  };

  const resendLabel = otpSent ? 'Resend OTP' : 'Send OTP';

  return (
    <section className={`phone-verify-card ${user?.phone_verified ? 'verified' : 'pending'}`}>
      <div className="phone-verify-head">
        <div>
          <span className="phone-verify-eyebrow">Account security</span>
          <h3>Mobile number verification</h3>
          <p>
            Verify your mobile once to unlock phone login, clean customer contact details,
            and checkout protection against fake numbers.
          </p>
        </div>
        <div className={`phone-verify-badge ${user?.phone_verified ? 'ok' : ''}`}>
          {user?.phone_verified ? <CheckCircle2 size={16} /> : <Smartphone size={16} />}
          <span>{user?.phone_verified ? 'Verified' : 'Not verified'}</span>
        </div>
      </div>

      <div className="phone-verify-grid">
        <div className="form-group">
          <label>Mobile number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength="10"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </div>
        <button type="button" className="phone-verify-send" onClick={sendOtp} disabled={sending}>
          <ShieldCheck size={17} />
          <span>{sending ? 'Sending...' : resendLabel}</span>
        </button>
      </div>

      {otpSent && (
        <div className="phone-verify-grid otp">
          <div className="form-group">
            <label>OTP code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength="6"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button type="button" className="phone-verify-confirm" onClick={verifyOtp} disabled={verifying}>
            <CheckCircle2 size={17} />
            <span>{verifying ? 'Verifying...' : 'Verify mobile'}</span>
          </button>
        </div>
      )}

      {status && <div className="phone-verify-status ok">{status}</div>}
      {error && <div className="phone-verify-status error">{error}</div>}
      <div id={recaptchaId} className="phone-verify-recaptcha" />
    </section>
  );
}

export default PhoneVerificationCard;
