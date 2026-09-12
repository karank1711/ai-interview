import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const MODEL_URLS = [
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite',
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
];

let segmenterPromise = null;

export function browserSupportsSegmentation() {
  return typeof WebAssembly !== 'undefined';
}

async function createSegmenter(modelAssetPath, delegate) {
  console.info('[BG] Loading image segmenter', { modelAssetPath, delegate });
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath,
      delegate,
    },
    runningMode: 'VIDEO',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

async function createSegmenterWithFallbacks() {
  let lastError = null;
  for (const modelAssetPath of MODEL_URLS) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        const instance = await createSegmenter(modelAssetPath, delegate);
        console.info('[BG] Image segmenter ready', { modelAssetPath, delegate });
        return instance;
      } catch (error) {
        lastError = error;
        console.error('[BG] Image segmenter init failed', {
          modelAssetPath,
          delegate,
          message: error?.message || String(error),
        });
      }
    }
  }
  throw lastError || new Error('Could not initialize MediaPipe Image Segmenter');
}

export function getImageSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenterWithFallbacks().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}
