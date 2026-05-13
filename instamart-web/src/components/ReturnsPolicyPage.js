import React from 'react';
import { RotateCcw, ShieldCheck, PackageCheck, CreditCard, AlertCircle, Mail } from 'lucide-react';

const sectionStyle = {
  background: '#fff',
  borderRadius: '22px',
  padding: '24px',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
  border: '1px solid rgba(8,42,99,.08)'
};

function ReturnsCard({ icon: Icon, title, children }) {
  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #082a63, #0b3d91)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#082a63' }}>{title}</h2>
      </div>
      <div style={{ color: '#475569', lineHeight: 1.8, fontSize: '14px' }}>
        {children}
      </div>
    </section>
  );
}

function ReturnsPolicyPage() {
  return (
    <div className="container" style={{ maxWidth: '1120px', padding: '28px 16px 110px' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(8,42,99,.98), rgba(11,61,145,.92))',
        borderRadius: '28px',
        padding: '32px',
        color: '#fff',
        boxShadow: '0 24px 60px rgba(8,42,99,.18)',
        marginBottom: '22px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 14px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,.12)',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          marginBottom: '16px'
        }}>
          <RotateCcw size={16} />
          Returns Policy
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: '40px', lineHeight: 1.05 }}>Camigo Returns and Refund Policy</h1>
        <p style={{ margin: 0, maxWidth: '780px', color: 'rgba(255,255,255,.88)', fontSize: '15px', lineHeight: 1.8 }}>
          This policy explains how returns, replacements and refunds work for products ordered
          through Camigo, including CCTV cameras, recorders, accessories and setup packages.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '18px' }}>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            Effective date: May 13, 2026
          </span>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            India orders only
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '18px' }}>
        <ReturnsCard icon={ShieldCheck} title="Return Eligibility">
          <p style={{ marginTop: 0 }}>
            We accept returns for defective products and for eligible non-defective products.
            Non-defective items must be unused, in resellable condition and returned with the
            original packaging, accessories, labels and invoice.
          </p>
          <p style={{ marginBottom: 0 }}>
            Custom-cut materials, installed service items, opened software-linked products and
            products damaged by misuse, liquid exposure, voltage issues or unauthorized repairs
            are not eligible for standard return approval.
          </p>
        </ReturnsCard>

        <ReturnsCard icon={PackageCheck} title="Return Window">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Defective, damaged or wrong-item claims should be reported within 48 hours of delivery.</li>
            <li>Eligible non-defective products may be returned within 7 calendar days of delivery.</li>
            <li>Returns requested after the allowed window may be rejected unless covered by warranty support.</li>
          </ul>
        </ReturnsCard>

        <ReturnsCard icon={AlertCircle} title="Items Not Eligible for Standard Return">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Products with physical damage caused after delivery.</li>
            <li>Products missing serial labels, accessories, packaging or invoice details.</li>
            <li>Installed products where drilling, mounting or wiring work has already been completed.</li>
            <li>Service visits, installation labor and delivery charges once the service has been completed.</li>
            <li>Products damaged due to electrical fluctuations, moisture, accidents or unauthorized modifications.</li>
          </ul>
        </ReturnsCard>

        <ReturnsCard icon={CreditCard} title="Refunds and Replacements">
          <p style={{ marginTop: 0 }}>
            Once a return is approved and the item is inspected, Camigo will either issue a replacement
            or process a refund to the original payment method, depending on stock availability and the
            customer’s preference.
          </p>
          <p style={{ marginBottom: 0 }}>
            Approved refunds are usually processed within 5 to 7 business days after the returned item
            is received and verified. COD refunds may be completed through bank transfer or another
            supported refund method after customer confirmation.
          </p>
        </ReturnsCard>

        <ReturnsCard icon={RotateCcw} title="How to Request a Return">
          <ol style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Open your order and raise a support or return request.</li>
            <li>Share the order number, issue details and clear photos or videos if the item is defective or damaged.</li>
            <li>Wait for Camigo support to confirm return approval, pickup instructions or replacement guidance.</li>
            <li>Do not send the product back without confirmation from the Camigo team.</li>
          </ol>
        </ReturnsCard>

        <ReturnsCard icon={Mail} title="Support Contact">
          <p style={{ marginTop: 0, marginBottom: '10px' }}>
            For return approvals, replacement help or refund questions, contact:
          </p>
          <div style={{
            background: 'linear-gradient(135deg, rgba(246,196,0,.14), rgba(8,42,99,.05))',
            borderRadius: '18px',
            padding: '16px',
            border: '1px solid rgba(246,196,0,.28)'
          }}>
            <div><strong>Camigo / CGI CCTV Cameras</strong></div>
            <div>Email: cgisellsindia@gmail.com</div>
            <div>Phone: +91 9114 555 044</div>
            <div>Address: Swarnapuri Rd, Bajrang Vihar, Patia, Bhubaneswar, Odisha 751024, India</div>
          </div>
        </ReturnsCard>
      </div>
    </div>
  );
}

export default ReturnsPolicyPage;
