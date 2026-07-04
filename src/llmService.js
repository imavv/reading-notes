import { CreateMLCEngine } from '@mlc-ai/web-llm';

// Qwen2.5-1.5B: better instruction-following than the previous 0.5B model,
// while staying under iOS Safari's WebGPU tab memory ceiling (~1.6GB vram_required_MB)
const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

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

  const prompt = `Turn these notes into 3 to 6 bullet points. Rules:
- Each bullet is one short sentence.
- Each bullet covers a different point - don't repeat the same idea twice.
- Keep the same order as the notes.
- Output only the bullet points, nothing else.

Example:
Notes: "So chapter three was about how the character finally decides to leave his job. He's been unhappy for years but keeps rationalizing why he stays. The turning point is when his mentor dies suddenly and he realizes he's been wasting time."
Bullets:
- The character has been unhappy at his job for years but keeps rationalizing staying.
- His mentor's sudden death is the turning point.
- He realizes he's been wasting time and decides to leave.

Now do the same for these notes:
${rawText}`;

  try {
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: "You turn short spoken notes about a book into clear bullet points. You only use information that is actually in the notes - never add outside facts or your own opinions." },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 500,
      frequency_penalty: 0.3,
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

  const prompt = `Create a 15-word maximum title for these book notes. Output only the title, nothing else. Don't make it too general, make it specific about the text at hand:

${rawText}`;

  try {
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 50,
      
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
