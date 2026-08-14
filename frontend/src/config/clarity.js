import Clarity from '@microsoft/clarity';

const clarityId = import.meta.env.VITE_CLARITY_ID;

if (import.meta.env.PROD && clarityId) {
  Clarity.init(clarityId);
}