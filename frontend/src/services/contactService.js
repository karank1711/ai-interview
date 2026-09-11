import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiBaseUrl.js';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

export async function sendContactMessage({ name, email, message }) {
  try {
    const response = await api.post('/contact', { name, email, message });
    return response.data;
  } catch (error) {
    const messageText =
      error.response?.data?.message || error.message || 'Could not send your message. Please try again.';
    throw new Error(messageText);
  }
}
