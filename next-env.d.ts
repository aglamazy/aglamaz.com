/// <reference types="next" />
/// <reference types="next/types/global" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    FIREBASE_PROJECT_ID: string;
    FIREBASE_CLIENT_EMAIL: string;
    FIREBASE_PRIVATE_KEY: string;
    FIREBASE_API_KEY: string;
    FIREBASE_AUTH_DOMAIN: string;
    FIREBASE_APP_ID: string;
    FIREBASE_MEASUREMENT_ID?: string;
  }
}

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
