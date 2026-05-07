const LOCATION_KEY = 'camigo_customer_location';
const LOCK_KEY = 'camigo_customer_location_lock';
const AREA_KEY = 'camigo_customer_area_name';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const normalizePosition = (position, source, locked = false) => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  altitudeAccuracy: position.coords.altitudeAccuracy,
  heading: position.coords.heading,
  speed: position.coords.speed,
  source,
  locked,
  savedAt: Date.now()
});

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (e) {
    localStorage.removeItem(key);
    return null;
  }
};

export const getSavedCustomerLocation = () => readJson(LOCK_KEY) || readJson(LOCATION_KEY);

export const getSavedCustomerAreaName = () => localStorage.getItem(AREA_KEY) || '';

export const saveCustomerLocation = (location, locked = false) => {
  const payload = { ...location, locked, savedAt: location.savedAt || Date.now() };
  localStorage.setItem(locked ? LOCK_KEY : LOCATION_KEY, JSON.stringify(payload));
  if (locked) localStorage.setItem(LOCATION_KEY, JSON.stringify(payload));
  return payload;
};

const getAreaParts = (address = {}) => {
  const locality = [
    address.suburb,
    address.neighbourhood,
    address.city_district,
    address.residential,
    address.quarter,
    address.hamlet,
    address.village,
    address.town,
    address.city
  ].filter(Boolean);
  const region = [
    address.city,
    address.county,
    address.state_district,
    address.state
  ].filter(Boolean);
  return {
    primary: locality[0] || region[0] || '',
    secondary: region.find((value) => value && value !== locality[0]) || ''
  };
};

export const resolveCustomerAreaName = async ({ lat, lng } = {}) => {
  if (!lat || !lng) return getSavedCustomerAreaName();
  try {
    let areaName = '';
    if (GOOGLE_MAPS_API_KEY) {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`);
      if (response.ok) {
        const data = await response.json();
        const components = Array.isArray(data?.results?.[0]?.address_components) ? data.results[0].address_components : [];
        const pick = (...types) => (
          components.find((component) => types.every((type) => component.types.includes(type)))?.long_name || ''
        );
        const primary = pick('sublocality_level_1', 'sublocality') || pick('locality', 'political') || pick('neighborhood', 'political') || pick('administrative_area_level_2', 'political');
        const secondary = pick('locality', 'political') || pick('administrative_area_level_2', 'political') || pick('administrative_area_level_1', 'political');
        areaName = [primary, secondary].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(', ');
        if (!areaName) areaName = data?.results?.[0]?.formatted_address || '';
      }
    }
    if (!areaName) {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en'
        }
      });
      if (!response.ok) throw new Error('Reverse geocode failed');
      const data = await response.json();
      const parts = getAreaParts(data?.address || {});
      areaName = [parts.primary, parts.secondary].filter(Boolean).join(', ') || data?.display_name || '';
    }
    areaName = areaName || getSavedCustomerAreaName() || 'Bhubaneswar, Odisha';
    localStorage.setItem(AREA_KEY, areaName);
    return areaName;
  } catch (error) {
    return getSavedCustomerAreaName() || 'Bhubaneswar, Odisha';
  }
};

export const captureCustomerLocation = ({ lock = false, timeout = 10000, maximumAge = 0, source = 'auto' } = {}) => (
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(saveCustomerLocation(normalizePosition(position, source, lock), lock)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge }
    );
  })
);
