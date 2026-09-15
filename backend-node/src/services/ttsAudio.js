export function audioMagic(buffer) {
  if (!buffer || buffer.length < 4) return "";
  return buffer.subarray(0, 4).toString("ascii");
}

export function inspectAudioBuffer(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const magic = audioMagic(bytes);
  const mpeg = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  let mimeType = "application/octet-stream";
  let playable = false;
  if (magic === "RIFF") {
    mimeType = "audio/wav";
    playable = true;
  } else if (magic.startsWith("ID3") || mpeg) {
    mimeType = "audio/mpeg";
    playable = true;
  } else if (magic === "OggS") {
    mimeType = "audio/ogg";
    playable = true;
  } else if (magic === "fLaC") {
    mimeType = "audio/flac";
    playable = true;
  } else if (bytes[0] === 0x7b) {
    mimeType = "application/json";
  }
  return { mimeType, playable, magic: magic.replace(/[^\x20-\x7e]/g, "."), bytes: bytes.length };
}

export function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
  const blockAlign = (channels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export function ensurePlayableAudio(buffer, sampleRate = 24000) {
  const inspected = inspectAudioBuffer(buffer);
  if (inspected.playable) {
    return { buffer, mimeType: inspected.mimeType, inspected };
  }
  if (buffer?.length && buffer.length % 2 === 0 && inspected.mimeType !== "application/json") {
    const wav = pcmToWav(buffer, sampleRate);
    return { buffer: wav, mimeType: "audio/wav", inspected: inspectAudioBuffer(wav) };
  }
  return { buffer, mimeType: inspected.mimeType, inspected };
}

export function sendTtsAudio(res, audio) {
  const ensured = ensurePlayableAudio(audio.buffer);
  console.log("[TTS] send", {
    provider: audio.provider || "",
    fallback: Boolean(audio.fallback),
    contentType: ensured.mimeType,
    bytes: ensured.buffer.length,
    magic: ensured.inspected.magic,
    playable: ensured.inspected.playable,
  });
  if (!ensured.inspected.playable) {
    const error = new Error("Audio is temporarily unavailable. You can still read the response.");
    error.statusCode = 502;
    error.code = "TTS_UNAVAILABLE";
    error.voiceAvailable = false;
    error.textOnly = true;
    throw error;
  }
  res.setHeader("Content-Type", ensured.mimeType);
  res.setHeader("Content-Length", String(ensured.buffer.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Tts-Provider", audio.provider || "");
  res.setHeader("X-Tts-Language", audio.language || "");
  res.setHeader("X-Voice-Available", "true");
  return res.end(ensured.buffer);
}
