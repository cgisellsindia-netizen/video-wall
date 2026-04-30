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
  const [sentPhone, setSentPhone] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);
  const recaptchaId = useMemo(
    () => `camigo-phone-recaptcha-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const savedVerifiedPhone = cleanPhone(user?.phone || '');
  const draftPhone = cleanPhone(phone);
  const isVerifiedForCurrentInput = Boolean(
    user?.phone_verified && savedVerifiedPhone && draftPhone === savedVerifiedPhone
  );

  const resetRecaptcha = () => {
    try {
      recaptchaRef.current?.clear?.();
    } catch (e) {}
    recaptchaRef.current = null;
  };

  const cancelOtpFlow = async ({ clearMessages = false } = {}) => {
    setOtp('');
    setOtpSent(false);
    setSentPhone('');
    setResendCountdown(0);
    confirmationRef.current = null;
    resetRecaptcha();
    await signOut(firebaseAuth).catch(() => {});
    if (clearMessages) {
      setStatus('');
      setError('');
    }
  };

  useEffect(() => {
    setPhone(user?.phone || '');
    cancelOtpFlow({ clearMessages: true });
  }, [user?.id, user?.phone]);

  useEffect(() => {
    if (!otpSent || resendCountdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCountdown(current => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [otpSent, resendCountdown]);

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
      setSentPhone(safePhone);
      setOtpSent(true);
      setResendCountdown(30);
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
      await cancelOtpFlow();
      setStatus('Mobile number verified successfully. You can now use mobile login and checkout.');
    } catch (verifyError) {
      setError(verifyError.message || 'OTP verification failed.');
    }
    setVerifying(false);
  };

  const resendLabel = sending
    ? 'Sending...'
    : otpSent && resendCountdown > 0
      ? `Resend in ${resendCountdown}s`
      : isVerifiedForCurrentInput
        ? 'Verify new number'
        : otpSent
          ? 'Resend OTP'
          : 'Send OTP';

  return (
    <section className={`phone-verify-card ${isVerifiedForCurrentInput ? 'verified' : 'pending'}`}>
      <div className="phone-verify-head">
        <div>
          <span className="phone-verify-eyebrow">Account security</span>
          <h3>Mobile number verification</h3>
          <p>
            Verify your mobile once to unlock phone login, clean customer contact details,
            and checkout protection against fake numbers.
          </p>
        </div>
        <div className={`phone-verify-badge ${isVerifiedForCurrentInput ? 'ok' : ''}`}>
          {isVerifiedForCurrentInput ? <CheckCircle2 size={16} /> : <Smartphone size={16} />}
          <span>{isVerifiedForCurrentInput ? 'Verified' : 'Not verified'}</span>
        </div>
      </div>

      {isVerifiedForCurrentInput && (
        <div className="phone-verify-success">
          <div className="phone-verify-success-icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="phone-verify-success-copy">
            <strong>Verified mobile: +91 {savedVerifiedPhone}</strong>
            <span>This saved number is now used for mobile login, checkout contact, and delivery updates.</span>
          </div>
        </div>
      )}

      <div className="phone-verify-grid">
        <div className="form-group">
          <label>Mobile number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength="10"
            placeholder="10-digit mobile"
            value={phone}
            disabled={otpSent}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </div>
        <button
          type="button"
          className="phone-verify-send"
          onClick={sendOtp}
          disabled={sending || (otpSent && resendCountdown > 0)}
        >
          <ShieldCheck size={17} />
          <span>{resendLabel}</span>
        </button>
      </div>

      {otpSent && (
        <>
          <div className="phone-verify-meta">
            <span>OTP sent to +91 {sentPhone}. You can request a new code after 30 seconds.</span>
            <button type="button" onClick={() => cancelOtpFlow({ clearMessages: false })}>Change number</button>
          </div>
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
        </>
      )}

      {status && <div className="phone-verify-status ok">{status}</div>}
      {error && <div className="phone-verify-status error">{error}</div>}
      <div id={recaptchaId} className="phone-verify-recaptcha" />
    </section>
  );
}

export default PhoneVerificationCard;
