import React from 'react';
import { FileText, ShieldCheck, Truck, Wrench, CreditCard, AlertCircle, Mail } from 'lucide-react';

const sectionStyle = {
  background: '#fff',
  borderRadius: '22px',
  padding: '24px',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
  border: '1px solid rgba(8,42,99,.08)'
};

function TermsCard({ icon: Icon, title, children }) {
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

function TermsOfServicePage() {
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
          <FileText size={16} />
          Terms of Service
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: '40px', lineHeight: 1.05 }}>Camigo Terms of Service</h1>
        <p style={{ margin: 0, maxWidth: '780px', color: 'rgba(255,255,255,.88)', fontSize: '15px', lineHeight: 1.8 }}>
          These terms govern the use of Camigo’s website, Android apps, admin systems and service
          workflows for customers, dealers, distributors, delivery partners and installers.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '18px' }}>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            Effective date: May 1, 2026
          </span>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            Applies to website and Android apps
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '18px' }}>
        <TermsCard icon={ShieldCheck} title="Acceptance of Terms">
          <p style={{ marginTop: 0 }}>
            By creating an account, placing an order, logging into a role-based Camigo app or using
            any Camigo service, you agree to these terms and any policies referenced by them, including
            the Camigo Privacy Policy.
          </p>
          <p style={{ marginBottom: 0 }}>
            If you do not agree with these terms, you should not use the Camigo website, mobile apps
            or related business systems.
          </p>
        </TermsCard>

        <TermsCard icon={Truck} title="Orders, Delivery and Courier Service">
          <p style={{ marginTop: 0 }}>
            Camigo provides product ordering, same-day local delivery in selected service zones and
            courier-based dispatch outside those zones. Delivery timelines shown at checkout are
            estimates and may change due to stock status, weather, route conditions, third-party
            partners, pincode serviceability or operational delays.
          </p>
          <p style={{ marginBottom: 0 }}>
            Delivery charges, installation charges, taxes and handling fees shown at checkout form part
            of the final order total. Courier orders may be fulfilled through third-party logistics
            partners such as Delhivery or other approved carriers.
          </p>
        </TermsCard>

        <TermsCard icon={CreditCard} title="Pricing, Payment and Cancellations">
          <p style={{ marginTop: 0 }}>
            Product prices, discounts, role-based dealer or distributor rates, taxes, service fees and
            delivery charges may change at any time before an order is successfully placed. Orders are
            considered confirmed only after successful payment or an approved alternate payment flow.
          </p>
          <p style={{ marginBottom: 0 }}>
            Camigo may limit or cancel orders where pricing, stock, address validation, fraud checks,
            payment verification or operational constraints make fulfilment impossible or unsafe.
          </p>
        </TermsCard>

        <TermsCard icon={Wrench} title="Installation, Warranty and Service">
          <p style={{ marginTop: 0 }}>
            Installation add-ons, technician visits, delivery-partner tasks and installer assignments are
            scheduled based on availability. Installation charges may be calculated per supported camera
            unit or service scope as shown at checkout or in admin-configured rates.
          </p>
          <p style={{ marginBottom: 0 }}>
            Product warranties are governed by the recorded order data, applicable product support
            period and any manufacturer-specific service conditions. Damage caused by misuse, external
            electrical faults, unauthorized repairs or unsupported installation conditions may not be
            covered.
          </p>
        </TermsCard>

        <TermsCard icon={AlertCircle} title="Account Use and Restricted Conduct">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>Do not use false names, fake phone numbers or invalid delivery addresses.</li>
            <li>Do not misuse admin, dealer, distributor, installer or delivery-partner access.</li>
            <li>Do not interfere with app security, tracking systems, OTP flows or payment processing.</li>
            <li>Do not upload harmful content, malware or misleading product/service information.</li>
            <li>Do not copy, scrape or resell Camigo operational data without permission.</li>
          </ul>
        </TermsCard>

        <TermsCard icon={ShieldCheck} title="Role-Based Access and Third-Party Services">
          <p style={{ marginTop: 0 }}>
            Some Camigo features depend on role-based access created by the admin, including dealer,
            distributor, delivery partner and installer panels. Access may be suspended, revoked or
            limited if credentials are misused or business terms are violated.
          </p>
          <p style={{ marginBottom: 0 }}>
            Camigo may use third-party services for payments, maps, notifications, authentication,
            logistics, hosting and communication. Their separate terms and policies may also apply.
          </p>
        </TermsCard>

        <TermsCard icon={Mail} title="Contact and Updates">
          <p style={{ marginTop: 0, marginBottom: '10px' }}>
            For questions about these terms, service disputes or account issues, contact:
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
          <p style={{ margin: '14px 0 0' }}>
            Camigo may update these terms from time to time. Continued use of the service after updates
            means you accept the revised version.
          </p>
        </TermsCard>
      </div>
    </div>
  );
}

export default TermsOfServicePage;
