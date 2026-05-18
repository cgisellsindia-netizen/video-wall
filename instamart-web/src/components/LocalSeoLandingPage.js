import React from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';
import { localSeoPages } from '../localSeoPages';

function LocalSeoLandingPage({ page }) {
  if (!page) return null;

  const relatedLocalPages = localSeoPages.filter((entry) => entry.slug !== page.slug);
  const searchVariants = [
    page.label,
    `${page.label} near me`,
    `${page.label} price`,
    `${page.label} dealer`,
    `${page.label} installation support`
  ];

  usePageSeo({
    title: page.title,
    description: page.description,
    canonicalUrl: `https://getcamigo.in/${page.slug}`,
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: page.label,
          url: `https://getcamigo.in/${page.slug}`,
          description: page.description
        },
        {
          '@type': 'LocalBusiness',
          name: 'Camigo',
          url: `https://getcamigo.in/${page.slug}`,
          description: page.description,
          areaServed: page.areaServed,
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Swarnapuri Rd, Bajrang Vihar, Patia',
            addressLocality: 'Bhubaneswar',
            addressRegion: 'Odisha',
            postalCode: '751024',
            addressCountry: 'IN'
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: page.label, item: `https://getcamigo.in/${page.slug}` }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: (page.faqs || []).map((item) => ({
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
        <span>{page.label}</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">{page.eyebrow}</span>
        <h1>{page.heroTitle}</h1>
        <p>{page.lead}</p>

        <section className="policy-section">
          <h2>What buyers usually need</h2>
          <ul>
            {(page.bullets || []).map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        </section>

        <section className="policy-section">
          <h2>Popular related searches people use</h2>
          <div className="local-seo-topic-list">
            {searchVariants.map((term) => (
              <span key={term} className="seo-link-chip subtle">{term}</span>
            ))}
          </div>
        </section>

        <section className="policy-section">
          <h2>Search intent this page supports</h2>
          <p>{page.searchText}</p>
        </section>

        <section className="policy-section">
          <h2>Why this page is tied to Camigo</h2>
          <p>
            Camigo is building these Bhubaneswar and Odisha CCTV pages to help Google and buyers connect a real local
            brand with CCTV cameras, recorders, installation support, setup packages, and fast product discovery.
            This page is part of that stronger brand and local-intent footprint.
          </p>
        </section>

        <section className="policy-section">
          <h2>Coverage and local relevance</h2>
          <p>{page.coverageText}</p>
          {!!page.areaServed?.length && (
            <ul>
              {page.areaServed.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="policy-section">
          <h2>Helpful internal links</h2>
          <ul>
            {(page.internalLinks || []).map((item) => (
              <li key={`${item.to}-${item.label}`}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="policy-section">
          <h2>Best next Camigo pages to index</h2>
          <div className="local-seo-topic-list">
            <Link to="/" className="seo-link-chip subtle">Camigo homepage</Link>
            <Link to="/shop" className="seo-link-chip subtle">Camigo shop</Link>
            <Link to="/about-camigo" className="seo-link-chip subtle">About Camigo</Link>
            {(page.internalLinks || []).slice(0, 3).map((item) => (
              <Link key={`index-${item.to}`} to={item.to} className="seo-link-chip subtle">{item.label}</Link>
            ))}
          </div>
        </section>

        <section className="policy-section">
          <h2>More Bhubaneswar and Odisha CCTV pages</h2>
          <div className="local-seo-topic-list">
            {relatedLocalPages.map((entry) => (
              <Link key={entry.slug} to={`/${entry.slug}`} className="seo-link-chip subtle">
                {entry.label}
              </Link>
            ))}
          </div>
        </section>

        <FaqSection title={page.faqTitle} eyebrow={page.faqEyebrow} items={page.faqs || []} />
      </div>
    </main>
  );
}

export default LocalSeoLandingPage;
