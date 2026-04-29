export const isLocalServiceZone = (lat, lng) => {
  const valueLat = Number(lat);
  const valueLng = Number(lng);
  if (!Number.isFinite(valueLat) || !Number.isFinite(valueLng)) return false;

  // Covers the Bhubaneswar, Khordha, and Cuttack delivery corridor.
  return valueLat >= 20.05 && valueLat <= 20.65 && valueLng >= 85.50 && valueLng <= 86.10;
};

export const extractPincode = (value = '') => {
  const match = String(value).match(/\b(75[123]\d{3})\b/);
  return match ? match[1] : '';
};

export const isServiceablePincode = (pincode = '') => {
  const pin = String(pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) return false;

  // Camigo local service corridor: Bhubaneswar (751), Khordha/Jatni belt (7520xx/7521xx), and Cuttack (753).
  return pin.startsWith('751') || pin.startsWith('753') || /^752[01]\d{2}$/.test(pin);
};

export const isLocalAddressText = (address = '') => {
  const text = String(address).toLowerCase();
  return ['bhubaneswar', 'bbsr', 'cuttack', 'khordha', 'khurda', 'jatni', 'patia'].some(place => text.includes(place));
};

export const checkServiceability = ({ address = '', pincode = '', lat, lng } = {}) => {
  const detectedPincode = String(pincode || '').trim() || extractPincode(address);
  const gpsLocal = isLocalServiceZone(lat, lng);
  const pincodeLocal = isServiceablePincode(detectedPincode);
  const addressLocal = isLocalAddressText(address);
  const hasPincode = Boolean(detectedPincode);
  return {
    serviceable: hasPincode ? pincodeLocal : (gpsLocal || addressLocal),
    detectedPincode,
    gpsLocal,
    pincodeLocal,
    addressLocal
  };
};
