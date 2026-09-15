import { preparePlayableAudioBlob } from '../utils/interviewerPlayback';
import api from './authService';

export async function sendInterviewFriendMessage(payload, { signal } = {}) {
  const response = await api.post('/interview-friend/message', payload, { signal });
  return response.data;
}

export async function fetchInterviewFriendSpeech(text, { signal } = {}) {
  const response = await api.post(
    '/interview-friend/tts',
    { text },
    { signal, responseType: 'blob' }
  );
  const type = String(response.headers?.['content-type'] || '').split(';')[0];
  const provider = response.headers?.['x-tts-provider'] || '';
  console.log('[AI-VOICE] tts response', {
    status: response.status,
    contentType: type,
    provider,
    bytes: response.data?.size,
  });
  if (type.includes('application/json') || response.status >= 400) {
    const message = await blobErrorMessage(response.data);
    const error = new Error(message || 'Audio is temporarily unavailable. You can still read the response.');
    error.voiceAvailable = false;
    error.audioError = true;
    error.textOnly = true;
    throw error;
  }
  return preparePlayableAudioBlob(new Blob([response.data], { type: type || 'audio/wav' }));
}

async function blobErrorMessage(data) {
  try {
    const text = data instanceof Blob ? await data.text() : String(data || '');
    const parsed = JSON.parse(text);
    return parsed?.message || '';
  } catch {
    return '';
  }
}

export async function listFriendConversations() {
  const response = await api.get('/interview-friend/conversations');
  return response.data?.data || [];
}

export async function getFriendConversation(id) {
  const response = await api.get(`/interview-friend/conversations/${id}`);
  return response.data?.data;
}

export async function createFriendConversation(payload) {
  const response = await api.post('/interview-friend/conversations', payload);
  return response.data?.data;
}

export async function updateFriendConversation(id, payload) {
  const response = await api.put(`/interview-friend/conversations/${id}`, payload);
  return response.data?.data;
}

export function friendApiErrorMessage(error) {
  return (
    error?.response?.data?.message
    || (typeof error?.message === 'string' ? error.message : '')
    || 'Interview Friend could not answer right now. Please try again.'
  );
}
