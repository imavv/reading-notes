import { CreateMLCEngine } from '@mlc-ai/web-llm';

// Use Qwen2-0.5B - smallest model, ~500MB, good for summarization
const MODEL_ID = 'Qwen2-0.5B-Instruct-q4f16_1-MLC';

let engine = null;
let loadingProgress = 0;
let isLoading = false;

/**
 * Initialize the LLM engine with progress callback
 * @param {function} onProgress - Callback for loading progress (0-100)
 * @returns {Promise<boolean>} - True if initialization successful
 */
export const initLLM = async (onProgress) => {
  if (engine) {
    return true;
  }

  if (isLoading) {
    return false;
  }

  isLoading = true;

  try {
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        loadingProgress = Math.round(progress.progress * 100);
        if (onProgress) {
          onProgress(loadingProgress, progress.text);
        }
      }
    });

    isLoading = false;
    return true;
  } catch (error) {
    console.error('Failed to initialize LLM:', error);
    isLoading = false;
    engine = null;
    throw error;
  }
};

/**
 * Check if the model is loaded and ready
 * @returns {boolean}
 */
export const isModelLoaded = () => engine !== null;

/**
 * Check if the model is currently loading
 * @returns {boolean}
 */
export const isModelLoading = () => isLoading;

/**
 * Get current loading progress
 * @returns {number} - Progress 0-100
 */
export const getLoadingProgress = () => loadingProgress;

/**
 * Generate bullet point summary from raw text
 * @param {string} rawText - The raw transcript text
 * @returns {Promise<string>} - Bullet point summary
 */
export const generateSummary = async (rawText) => {
  if (!engine) {
    throw new Error('LLM not initialized. Call initLLM first.');
  }

  const prompt = `Summarize the following reading notes into concise bullet points. Only output the bullet points, no introduction or conclusion:

${rawText}`;

  try {
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Failed to generate summary:', error);
    throw error;
  }
};

/**
 * Generate a 10-word maximum title from raw text
 * @param {string} rawText - The raw transcript text
 * @returns {Promise<string>} - Short title
 */
export const generateTitle = async (rawText) => {
  if (!engine) {
    throw new Error('LLM not initialized. Call initLLM first.');
  }

  const prompt = `Create a 10-word maximum title for these reading notes. Output only the title, nothing else:

${rawText}`;

  try {
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 30
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Failed to generate title:', error);
    throw error;
  }
};

/**
 * Unload the model to free memory
 */
export const unloadModel = async () => {
  if (engine) {
    await engine.unload();
    engine = null;
  }
};
