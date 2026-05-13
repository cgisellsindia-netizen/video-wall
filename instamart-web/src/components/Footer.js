import React from 'react';
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col"><h4>Company</h4><a href="#">About Camigo</a><a href="#">Careers</a><a href="#">Blog</a><a href="#">Press</a></div>
        <div className="footer-col"><h4>Support</h4><a href="/install">Installation</a><a href="/terms-of-service">Terms of Service</a><a href="/privacy-policy">Privacy Policy</a><a href="/contact">Contact Us</a></div>
        <div className="footer-col"><h4>Products</h4><a href="#">AHD Cameras</a><a href="#">IP Cameras</a><a href="#">PTZ Cameras</a><a href="#">DVR/NVR</a></div>
        <div className="footer-col"><h4>Contact</h4><p>cgisellsindia@gmail.com</p><p>+91 9114 555 044</p><p>Swarnapuri Rd, Bajrang Vihar, Patia, Bhubaneswar, Odisha 751024</p></div>
      </div>
      <div className="footer-bottom"><div className="footer-logo">Cam<span style={{color:"#f6c400"}}>igo</span></div><div className="footer-copy">&copy; 2025 CGI CCTV Cameras. Odisha&apos;s Only CCTV Manufacturer. For authorized pentesting only.</div></div>
    </footer>
  );
}
export default Footer;
