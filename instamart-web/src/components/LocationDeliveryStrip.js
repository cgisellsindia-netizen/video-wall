import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Zap } from 'lucide-react';

function LocationDeliveryStrip() {
  const [location, setLocation] = useState(localStorage.getItem('camigo_location') || 'Bhubaneswar');
  const [status, setStatus] = useState('Fast delivery zone active');
  const [estimate, setEstimate] = useState(localStorage.getItem('camigo_delivery_estimate') || '26 mins');

  const isLocalServiceZone = (lat, lng) => (
    lat >= 20.15 && lat <= 20.55 && lng >= 85.65 && lng <= 86.05
  );

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location not supported. Serving Bhubaneswar');
      return;
    }
    setStatus('Detecting your delivery location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const local = isLocalServiceZone(pos.coords.latitude, pos.coords.longitude);
        const value = `Near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
        localStorage.setItem('camigo_location', value);
        localStorage.setItem('camigo_delivery_estimate', local ? '26 mins' : '2-4 days');
        setLocation(value);
        setEstimate(local ? '26 mins' : '2-4 days');
        setStatus(local ? 'Location locked. Same-day dispatch available' : 'Outside Bhubaneswar/Cuttack. Dispatch by courier');
      },
      () => setStatus('Permission blocked. Showing Bhubaneswar delivery zone'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!localStorage.getItem('camigo_location')) detectLocation();
  }, []);

  return (
    <section className="delivery-strip">
      <div>
        <span className="eyebrow">Delivery in {estimate}</span>
        <h2><MapPin size={22} /> {location}</h2>
        <p>{status}</p>
      </div>
      <button onClick={detectLocation}><Navigation size={16} /> Auto fetch location</button>
      <div className="delivery-strip-badge"><Zap size={16} /> {estimate === '2-4 days' ? 'Courier dispatch + remote support' : 'Same-day CCTV delivery + install support'}</div>
    </section>
  );
}

export default LocationDeliveryStrip;
