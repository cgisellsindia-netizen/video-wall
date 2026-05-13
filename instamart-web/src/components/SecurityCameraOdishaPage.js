import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';

function SecurityCameraOdishaPage() {
  const faqs = useMemo(() => ([
    {
      question: 'Does Camigo serve customers outside Bhubaneswar in Odisha?',
      answer: 'Yes. Camigo can serve Odisha customers through local dispatch where available and courier-supported fulfillment for supported zones outside the fastest local corridor.'
    },
    {
      question: 'What security camera products can Odisha customers buy from Camigo?',
      answer: 'Odisha customers can browse IP cameras, dome cameras, bullet cameras, PTZ cameras, DVRs, NVRs, PoE switches, power supplies, and setup packages.'
    },
    {
      question: 'Can Odisha businesses order CCTV systems online?',
      answer: 'Yes. Camigo supports homes, offices, retail shops, warehouses, and installer-led buying workflows for surveillance products across Odisha.'
    }
  ]), []);

  usePageSeo({
    title: 'Security Camera in Odisha | CCTV Cameras, DVRs and Installation Support | Camigo',
    description: 'Buy security cameras in Odisha with Camigo. Browse CCTV cameras, PTZ cameras, DVRs, NVRs, PoE switches, and setup packages with Bhubaneswar-based support and Odisha delivery coverage.',
    canonicalUrl: 'https://getcamigo.in/security-camera-odisha',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'Security Camera in Odisha',
          url: 'https://getcamigo.in/security-camera-odisha',
          description: 'Landing page for security camera buyers across Odisha.'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'Security Camera in Odisha', item: 'https://getcamigo.in/security-camera-odisha' }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer
            }
          }))
        }
      ]
    }
  });

  return (
    <main className="container policy-page">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Security Camera in Odisha</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">Odisha Coverage</span>
        <h1>Security camera supply and CCTV buying support across Odisha.</h1>
        <p>
          Camigo is positioned for people searching across Odisha for security cameras, CCTV camera dealers,
          recorder systems, and setup accessories. The catalog supports both local buyers in Bhubaneswar and
          customers searching from other Odisha locations who need practical surveillance products online.
        </p>

        <section className="policy-section">
          <h2>What Odisha customers can buy</h2>
          <ul>
            <li>IP cameras, dome cameras, bullet cameras, and PTZ cameras.</li>
            <li>DVR and NVR recorders for small, medium, and larger surveillance setups.</li>
            <li>PoE switches, SMPS units, connectors, cables, and CCTV accessories.</li>
            <li>Setup packages for common home, office, and commercial CCTV needs.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Search intent this page supports</h2>
          <p>
            This page is designed for searches such as security camera in Odisha, CCTV camera Odisha, CCTV dealer
            Odisha, CCTV installation Odisha, and business or home surveillance product sourcing from an Odisha-based supplier.
          </p>
        </section>

        <section className="policy-section">
          <h2>Useful next steps</h2>
          <p>
            Explore the <Link to="/shop">full product catalog</Link>, visit
            <Link to="/category/2"> IP camera options</Link>, or if you need faster local intent pages, go to
            <Link to="/cctv-camera-bhubaneswar"> CCTV camera in Bhubaneswar</Link>.
          </p>
        </section>

        <FaqSection title="Security Camera Odisha FAQs" eyebrow="Popular queries" items={faqs} />
      </div>
    </main>
  );
}

export default SecurityCameraOdishaPage;
