export const isLocalServiceZone = (lat, lng) => {
  const valueLat = Number(lat);
  const valueLng = Number(lng);
  if (!Number.isFinite(valueLat) || !Number.isFinite(valueLng)) return false;

  // Covers the Bhubaneswar, Khordha, and Cuttack delivery corridor.
  return valueLat >= 20.05 && valueLat <= 20.65 && valueLng >= 85.50 && valueLng <= 86.10;
};

export const isLocalAddressText = (address = '') => {
  const text = String(address).toLowerCase();
  return ['bhubaneswar', 'bbsr', 'cuttack', 'khordha', 'khurda', 'jatni', 'patia'].some(place => text.includes(place));
};
