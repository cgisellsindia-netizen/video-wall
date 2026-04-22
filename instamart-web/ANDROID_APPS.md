# Camigo Android Apps

This project has two Capacitor Android shells:

- Customer app: `android-customer`, package `com.camigo.customer`
- Delivery partner app: `android-delivery`, package `com.camigo.deliverypartner`

## Build web bundles

```powershell
npm run android:sync:customer
npm run android:sync:delivery
```

## Open in Android Studio

```powershell
npm run android:open:customer
npm run android:open:delivery
```

## Backend URL

The app uses `REACT_APP_API_URL`.

For Android emulator, use:

```powershell
set REACT_APP_API_URL=http://10.0.2.2:3001/api
```

For a physical phone, use your computer LAN IP, for example:

```powershell
set REACT_APP_API_URL=http://192.168.1.50:3001/api
```

Then run the sync command again.

## Required local tools to generate APK

Install:

- Android Studio
- Java JDK 17+
- Android SDK

After that, use Android Studio to build APK/AAB from each app folder.
