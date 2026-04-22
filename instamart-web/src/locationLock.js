const LOCATION_KEY = 'camigo_customer_location';
const LOCK_KEY = 'camigo_customer_location_lock';

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

export const saveCustomerLocation = (location, locked = false) => {
  const payload = { ...location, locked, savedAt: location.savedAt || Date.now() };
  localStorage.setItem(locked ? LOCK_KEY : LOCATION_KEY, JSON.stringify(payload));
  if (locked) localStorage.setItem(LOCATION_KEY, JSON.stringify(payload));
  return payload;
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
