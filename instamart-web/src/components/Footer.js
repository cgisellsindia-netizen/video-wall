import React from 'react';
import { localSeoPages } from '../localSeoPages';

function Footer() {
  const primaryLocalPages = localSeoPages.slice(0, 5);
  const secondaryLocalPages = localSeoPages.slice(5);

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col"><h4>Company</h4><a href="/about-camigo">About Camigo</a><a href="/security-scan">Camigo Security Scan</a><a href="/contact">Contact Us</a><a href="/terms-of-service">Terms of Service</a><a href="/privacy-policy">Privacy Policy</a></div>
        <div className="footer-col"><h4>Support</h4><a href="/install">Installation</a><a href="/installation-policy">Installation Policy</a><a href="/shipping-policy">Shipping Policy</a><a href="/returns-policy">Returns Policy</a><a href="/contact">Support Contact</a></div>
        <div className="footer-col"><h4>Products</h4><a href="/category/1">AHD Cameras</a><a href="/category/2">IP Cameras</a><a href="/category/3">PTZ Cameras</a><a href="/shop">DVR/NVR</a></div>
        <div className="footer-col">
          <h4>Local CCTV Pages</h4>
          {primaryLocalPages.map((page) => (
            <a key={page.slug} href={`/${page.slug}`}>{page.label}</a>
          ))}
        </div>
        <div className="footer-col">
          <h4>More Local SEO Pages</h4>
          {secondaryLocalPages.map((page) => (
            <a key={page.slug} href={`/${page.slug}`}>{page.label}</a>
          ))}
        </div>
        <div className="footer-col"><h4>Contact</h4><p>cgisellsindia@gmail.com</p><p>+91 9114 555 044</p><p>Swarnapuri Rd, Bajrang Vihar, Patia, Bhubaneswar, Odisha 751024, India</p><p>Mon-Sat: 9:00 AM - 8:00 PM</p></div>
      </div>
      <div className="footer-bottom"><div className="footer-logo">Cam<span style={{color:"#f6c400"}}>igo</span></div><div className="footer-copy">&copy; 2026 Camigo / CGI CCTV Cameras. CCTV products, setup packages, delivery, and installation support in Bhubaneswar, Odisha.</div></div>
    </footer>
  );
}
export default Footer;
