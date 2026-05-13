import React from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';

function ShippingPolicyPage() {
  usePageSeo({
    title: 'Shipping Policy | Camigo',
    description: 'Read the Camigo shipping policy for order processing, dispatch, delivery timelines, local support, shipping charges, and delivery coverage.',
    canonicalUrl: 'https://getcamigo.in/shipping-policy',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'Shipping Policy',
          url: 'https://getcamigo.in/shipping-policy',
          description: 'Camigo shipping policy for CCTV products and setup packages.'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'Shipping Policy', item: 'https://getcamigo.in/shipping-policy' }
          ]
        }
      ]
    }
  });

  return (
    <main className="container policy-page">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Shipping Policy</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">Shipping Policy</span>
        <h1>Camigo shipping, dispatch, and delivery expectations.</h1>
        <p>
          This shipping policy explains how Camigo processes and dispatches CCTV products, accessories,
          recorders, and setup packages across supported delivery regions.
        </p>

        <section className="policy-section">
          <h2>Order processing</h2>
          <p>
            Orders are typically reviewed after successful placement. Dispatch timing depends on stock availability,
            order size, service area, and whether the order includes installation or setup coordination.
          </p>
        </section>

        <section className="policy-section">
          <h2>Delivery timelines</h2>
          <ul>
            <li>Local fast-dispatch orders may arrive within the ETA shown on the site for eligible areas.</li>
            <li>Courier-routed orders outside the local zone may take several working days depending on destination and carrier service.</li>
            <li>Large setup-package or project orders may need additional confirmation before dispatch.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Shipping charges</h2>
          <p>
            Shipping charges may vary by order value, destination, and fulfillment method. Promotional free-shipping
            thresholds and local-dispatch availability are displayed during checkout where applicable.
          </p>
        </section>

        <section className="policy-section">
          <h2>Coverage and exceptions</h2>
          <p>
            Some products, services, or COD options may not be available for every area. Delivery estimates and
            available fulfillment methods depend on the active customer location selected on the site.
          </p>
        </section>
      </div>
    </main>
  );
}

export default ShippingPolicyPage;
