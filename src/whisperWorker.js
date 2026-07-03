/* eslint-disable no-restricted-globals */
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;

// tiny.en: smallest/fastest English-only Whisper checkpoint, so the model
// download and on-device inference stay usable on phones.
const MODEL = 'Xenova/whisper-tiny.en';

class WhisperPipeline {
  static instance = null;

  static getInstance(progressCallback) {
    if (this.instance === null) {
      this.instance = pipeline('automatic-speech-recognition', MODEL, {
        progress_callback: progressCallback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  if (event.data.type !== 'transcribe') return;

  try {
    const transcriber = await WhisperPipeline.getInstance((data) => {
      self.postMessage({ type: 'model-progress', data });
    });
    self.postMessage({ type: 'model-ready' });

    const output = await transcriber(event.data.audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    self.postMessage({ type: 'result', text: output.text });
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
});
