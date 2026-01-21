import { PinataSDK } from "pinata";

// Centralized SDK instance
export const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!, // Matches your .env variable name
  pinataGateway: process.env.PINATA_GATEWAY!, // Matches your .env variable name
});

export const pinataService = {
  // We will now call the SDK directly from the route to follow the Next.js pattern
};