import React from 'react';
import { ShieldCheck, MapPin, Bell, CreditCard, UserCheck, Mail } from 'lucide-react';

const sectionStyle = {
  background: '#fff',
  borderRadius: '22px',
  padding: '24px',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
  border: '1px solid rgba(8,42,99,.08)'
};

function PolicyCard({ icon: Icon, title, children }) {
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

function PrivacyPolicyPage() {
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
          <ShieldCheck size={16} />
          Privacy Policy
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: '40px', lineHeight: 1.05 }}>Camigo Privacy Policy</h1>
        <p style={{ margin: 0, maxWidth: '780px', color: 'rgba(255,255,255,.88)', fontSize: '15px', lineHeight: 1.8 }}>
          This policy explains how Camigo collects, uses, stores and protects personal information
          when customers, dealers, distributors, delivery partners and installers use our website,
          Android apps and related services.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '18px' }}>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            Effective date: April 30, 2026
          </span>
          <span style={{ padding: '8px 14px', borderRadius: '999px', background: 'rgba(255,255,255,.12)', fontSize: '13px', fontWeight: 700 }}>
            Applies to website and Android apps
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '18px' }}>
        <PolicyCard icon={UserCheck} title="Information We Collect">
          <p style={{ marginTop: 0 }}>
            We may collect the information you provide directly to us, including your name, email address,
            verified mobile number, delivery address, account role, order details, warranty records,
            product preferences and support requests.
          </p>
          <p style={{ marginBottom: 0 }}>
            When dealer, distributor, delivery partner or installer accounts are created by the admin,
            role-based business information such as assigned price lists, service areas, hubs, tasks and
            status updates may also be stored.
          </p>
        </PolicyCard>

        <PolicyCard icon={MapPin} title="Location Data">
          <p style={{ marginTop: 0 }}>
            Camigo may request access to device location to lock the customer delivery point at checkout,
            estimate delivery timelines, show nearby service availability and support live delivery tracking.
          </p>
          <p style={{ marginBottom: 0 }}>
            Delivery partner and installer apps may collect live location while an active task is in progress
            so customers and admins can monitor order movement, assign jobs and verify service completion.
          </p>
        </PolicyCard>

        <PolicyCard icon={Bell} title="Notifications and Device Data">
          <p style={{ marginTop: 0 }}>
            If you allow notifications, Camigo may send order updates, delivery status alerts, service
            reminders, product notifications and account notices. To support this, the app may store push
            notification tokens and basic device identifiers required by Android or Firebase services.
          </p>
          <p style={{ marginBottom: 0 }}>
            We also collect limited technical information such as app mode, platform type and session state
            to keep the service working correctly and to troubleshoot issues.
          </p>
        </PolicyCard>

        <PolicyCard icon={CreditCard} title="Payments, Orders and Warranty Records">
          <p style={{ marginTop: 0 }}>
            When you place an order, we store cart contents, order value, taxes, installation choices,
            delivery status, payment method selection and warranty start dates. Card, UPI or other payment
            details are processed through integrated payment providers and should also be reviewed under the
            privacy terms of those providers.
          </p>
          <p style={{ marginBottom: 0 }}>
            Product warranty records may be retained for after-sales service, support, replacement validation
            and audit purposes for the duration of the product support period.
          </p>
        </PolicyCard>

        <PolicyCard icon={ShieldCheck} title="How We Use Information">
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            <li>To create and manage user accounts and role-based access</li>
            <li>To process orders, installations, deliveries, returns and warranty support</li>
            <li>To validate service areas, addresses and mobile verification status</li>
            <li>To provide live tracking, dispatch coordination and installer task updates</li>
            <li>To improve product listings, security workflows and customer support</li>
            <li>To send service messages, transactional notifications and admin announcements</li>
          </ul>
        </PolicyCard>

        <PolicyCard icon={ShieldCheck} title="Sharing and Retention">
          <p style={{ marginTop: 0 }}>
            We may share required order, address and task information with delivery partners, installers,
            admins, dealers, distributors, payment providers and technical service providers only to the
            extent needed to operate Camigo services.
          </p>
          <p style={{ marginBottom: 0 }}>
            Information is retained as long as needed for service delivery, compliance, accounting,
            warranty support, dispute resolution and legitimate business operations. We take reasonable
            steps to protect stored information from unauthorized access.
          </p>
        </PolicyCard>

        <PolicyCard icon={Mail} title="Contact Us">
          <p style={{ marginTop: 0, marginBottom: '10px' }}>
            For privacy-related questions, corrections or account support, contact:
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
            We may update this policy from time to time. Updated versions will be posted on this page.
          </p>
        </PolicyCard>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
