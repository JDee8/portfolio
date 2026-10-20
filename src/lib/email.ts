import cv from '../content/cv.json';

// Decoded in the browser by src/scripts/email.ts.
export const encodedEmail = btoa([...cv.contact.email].reverse().join(''));
