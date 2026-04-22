import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Zap } from 'lucide-react';
import { captureCustomerLocation, getSavedCustomerLocation } from '../locationLock';
import { isLocalServiceZone } from '../deliveryZone';

function LocationDeliveryStrip() {
  const [location, setLocation] = useState(localStorage.getItem('camigo_location') || 'Bhubaneswar');
  const [status, setStatus] = useState('Fast delivery zone active');
  const [estimate, setEstimate] = useState(localStorage.getItem('camigo_delivery_estimate') || '26 mins');

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location not supported. Serving Bhubaneswar');
      return;
    }
    setStatus('Detecting your delivery location...');
    captureCustomerLocation({ source: 'delivery-strip', timeout: 8000, maximumAge: 300000 }).then((pos) => {
      if (pos) {
        const local = isLocalServiceZone(pos.lat, pos.lng);
        const value = `Near ${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)}`;
        localStorage.setItem('camigo_location', value);
        localStorage.setItem('camigo_delivery_estimate', local ? '26 mins' : '2-4 days');
        setLocation(value);
        setEstimate(local ? '26 mins' : '2-4 days');
        setStatus(local ? `Location saved with ${Math.round(pos.accuracy || 0)}m accuracy` : 'Outside Bhubaneswar/Cuttack. Dispatch by courier');
      } else {
        setStatus('Permission blocked. Showing Bhubaneswar delivery zone');
      }
    });
  };

  useEffect(() => {
    const saved = getSavedCustomerLocation();
    if (saved?.lat && saved?.lng) {
      const local = isLocalServiceZone(saved.lat, saved.lng);
      setLocation(`Near ${saved.lat.toFixed(3)}, ${saved.lng.toFixed(3)}`);
      setEstimate(local ? '26 mins' : '2-4 days');
      setStatus(saved.locked ? `Locked for delivery with ${Math.round(saved.accuracy || 0)}m accuracy` : `Location saved with ${Math.round(saved.accuracy || 0)}m accuracy`);
      return;
    }
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
