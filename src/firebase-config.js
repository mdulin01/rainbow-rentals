// Firebase Configuration for Rainbow Reality
// Replace these values with your own Firebase project credentials
// Get these from: https://console.firebase.google.com > Project Settings > General > Your apps

export const firebaseConfig = {
  apiKey: "AIzaSyCHkestt-F4NqtzNmPbMzDwLNQ6g8xFAjM",
  authDomain: "rainbow-rentals.firebaseapp.com",
  projectId: "rainbow-rentals",
  storageBucket: "rainbow-rentals.firebasestorage.app",
  messagingSenderId: "558747458333",
  appId: "1:558747458333:web:3f0483e2d67588473a9ff4",
  measurementId: "G-9D92M790LS"
};

// SETUP INSTRUCTIONS:
//
// 1. Go to https://console.firebase.google.com
// 2. Click "Create a project" (or select existing)
// 3. Name it something like "rainbow-rentals"
// 4. Go to Project Settings (gear icon) > General
// 5. Scroll down to "Your apps" and click the web icon (</>)
// 6. Register app and copy the config values above
//
// 7. Enable Authentication:
//    - Go to Authentication > Sign-in method
//    - Enable "Google" provider
//    - Add your domain to Authorized domains
//
// 8. Enable Firestore:
//    - Go to Firestore Database
//    - Click "Create database"
//    - Start in "test mode" for development
//    - Choose a region close to you
//
// 9. Enable Storage:
//    - Go to Storage
//    - Click "Get Started"
//    - Start in test mode
//
// 10. Firestore Security Rules (for production):
//     Go to Firestore > Rules and use:
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rental data - shared between authorized users
    match /rentalData/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
*/
//
// 11. Storage Security Rules:
/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rentals/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
*/
