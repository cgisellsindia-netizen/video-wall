import React from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';

function InstallationPolicyPage() {
  usePageSeo({
    title: 'Installation Policy | Camigo CCTV Setup Support',
    description: 'Read how Camigo handles CCTV installation support, site requirements, scheduling, setup coverage, and service expectations.',
    canonicalUrl: 'https://getcamigo.in/installation-policy',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          serviceType: 'CCTV Installation Support',
          provider: {
            '@type': 'Organization',
            name: 'Camigo',
            url: 'https://getcamigo.in/'
          },
          areaServed: 'Bhubaneswar',
          url: 'https://getcamigo.in/installation-policy'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'Installation Policy', item: 'https://getcamigo.in/installation-policy' }
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
        <span>Installation Policy</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">Installation Policy</span>
        <h1>How Camigo installation support works.</h1>
        <p>
          Camigo supports CCTV installation workflows for homes, shops, offices, and other practical surveillance
          requirements. This page explains what customers should expect before and after scheduling installation support.
        </p>

        <section className="policy-section">
          <h2>Before installation</h2>
          <ul>
            <li>Customers should confirm product compatibility, camera count, recorder requirements, and power/network needs.</li>
            <li>Site readiness can affect installation speed, including cable paths, mounting points, and electricity availability.</li>
            <li>Some installation requests may need prior discussion or site clarification before scheduling.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Scheduling and support</h2>
          <p>
            Installation assistance depends on service coverage, product type, and workload availability. Camigo may
            coordinate scheduling directly or through installation support channels where applicable.
          </p>
        </section>

        <section className="policy-section">
          <h2>Service scope</h2>
          <p>
            Installation support is generally focused on CCTV setup execution. Additional civil, electrical, structural,
            or extended network work may require separate assessment depending on the site.
          </p>
        </section>

        <section className="policy-section">
          <h2>After installation</h2>
          <p>
            Customers should verify camera views, recorder access, storage operation, and agreed setup points at handover.
            Any follow-up support depends on the original order scope, location, and service arrangement.
          </p>
        </section>
      </div>
    </main>
  );
}

export default InstallationPolicyPage;
