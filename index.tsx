/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from '@google/genai';

const API_KEY = process.env.API_KEY;

// --- State Management ---
let state = {
  originalImage: null as { file: File, base64: string } | null,
  generatedImages: null as { name: string, base64: string }[] | null,
  prompt: '',
  isLoading: false,
  error: null as string | null,
};

// --- API and Utilities ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

const prompts = [
  {
    name: 'Natural Elegance',
    prompt: 'An elegant women\'s bag is placed on a light wooden table, with soft sunlight from the side highlighting the bag. A thin fashion book and a small cup of coffee are slightly blurred beside it, with a soft-focus background of green plants. The camera focus is sharp and full only on the bag.',
  },
  {
    name: 'Minimalist Indoor',
    prompt: 'A beige women\'s bag is photographed on a white marble table, with a small prop of transparent glass perfume in the corner of the frame. The background is a blurred modern interior, natural light from a window, with the main focus fully on the bag, highlighting the shine and texture of its fabric.',
  },
  {
    name: 'Cozy Style',
    prompt: 'An elegant women\'s bag is placed on a neutral-colored fabric sofa with a soft throw blanket as the background. The only prop is a pastel-colored magazine placed far away and blurred. The lighting is warm and natural from the right, framing the bag as the main point of interest.',
  },
  {
    name: 'Street Lifestyle',
    prompt: 'An elegant beige women\'s bag is placed on an outdoor cafe chair. The background is a city sunset during the golden hour. The main focus is fully on the bag. The single canvas strap looks neat, falling naturally with gravity towards the back of the chair, not bent or doubled, its texture clear and detailed. There is no deformation in the strap; it looks natural and realistic, clearly separate from the chair.',
  },
  {
    name: 'Editorial Premium',
    prompt: 'A close-up of a women\'s bag placed on a white linen cloth with small props: a gold ring and compact powder at the edge of the frame, blurred to serve as accents. The lighting is dramatic yet soft, giving a glossy and elegant finish, making the bag the center of attention.',
  },
];

const editingInstructions = `Keep the product exactly the same. Do not change anything about its color, texture, or details. Only modify the background and lighting. No watermark.`;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

const getMimeType = (base64: string) => base64.substring(base64.indexOf(':') + 1, base64.indexOf(';'));
const getBase64Data = (base64: string) => base64.substring(base64.indexOf(',') + 1);


// --- Event Handlers ---
async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.type.startsWith('image/')) {
    try {
      const base64 = await fileToBase64(file);
      setState({ originalImage: { file, base64 }, generatedImages: null, error: null });
    } catch (err) {
      console.error('Error converting file to base64:', err);
      setState({ error: 'Could not read the selected image file.' });
    }
  }
}

function handlePresetClick(promptText: string) {
  const textarea = document.getElementById('prompt-input') as HTMLTextAreaElement;
  textarea.value = promptText;
  setState({ prompt: promptText });
}

function handlePromptInput(e: Event) {
    setState({ prompt: (e.target as HTMLTextAreaElement).value });
}

async function handleGenerate() {
  if (!state.originalImage || !state.prompt || state.isLoading) return;

  setState({ isLoading: true, error: null, generatedImages: null });

  try {
    const fullPrompt = `${state.prompt} ${editingInstructions}`;

    const imagePart = {
      inlineData: {
        data: getBase64Data(state.originalImage.base64),
        mimeType: getMimeType(state.originalImage.base64),
      },
    };
    const textPart = { text: fullPrompt };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let foundImage = false;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType;
        const base64Data = part.inlineData.data;
        setState({ generatedImages: [{ name: 'Custom Prompt', base64: `data:${mimeType};base64,${base64Data}` }] });
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
        throw new Error("The model did not return an image. Please try a different prompt.");
    }

  } catch (err) {
    console.error('API Error:', err);
    setState({ error: `An error occurred: ${err.message}` });
  } finally {
    setState({ isLoading: false });
  }
}

async function handleGenerateAll() {
    if (!state.originalImage || state.isLoading) return;

    setState({ isLoading: true, error: null, generatedImages: [] });
    
    const currentResults: { name: string, base64: string }[] = [];

    for (const p of prompts) {
        try {
            const fullPrompt = `${p.prompt} ${editingInstructions}`;
            const imagePart = {
                inlineData: {
                    data: getBase64Data(state.originalImage.base64),
                    mimeType: getMimeType(state.originalImage.base64),
                },
            };
            const textPart = { text: fullPrompt };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType;
                    const base64Data = part.inlineData.data;
                    const newImage = {
                        name: p.name,
                        base64: `data:${mimeType};base64,${base64Data}`
                    };
                    currentResults.push(newImage);
                    setState({ generatedImages: [...currentResults] });
                    break;
                }
            }
        } catch (err) {
            console.error(`Error generating image for prompt "${p.name}":`, err);
        }
    }

    setState({ isLoading: false });
}

// --- Render Logic ---
const app = document.getElementById('app')!;

function render() {
  app.innerHTML = `
    <header>
      <h1>AI Product Photo Studio</h1>
    </header>
    <main>
      <div class="controls-panel">
        <div class="card">
          <h2>1. Upload Product</h2>
          <label class="upload-area" for="file-upload" role="button" aria-label="Upload your product image">
            <span>Click to upload or drag & drop</span>
          </label>
          <input id="file-upload" type="file" accept="image/*" style="display: none;">
        </div>
        <div class="card">
          <h2>2. Choose a Style</h2>
          <div class="prompt-presets">
            ${prompts.map(p => `<button class="preset-btn" data-prompt="${p.prompt}">${p.name}</button>`).join('')}
          </div>
        </div>
        <div class="card">
          <h2>3. Customize & Generate</h2>
          <textarea id="prompt-input" placeholder="Or write your own prompt here...">${state.prompt}</textarea>
          <div class="error-message" style="display: ${state.error ? 'block' : 'none'}" role="alert">${state.error}</div>
          <div class="generate-actions">
            <button class="generate-btn" id="generate-btn" ${!state.originalImage || !state.prompt ? 'disabled' : ''}>
              ${state.isLoading ? '<div class="loader btn-loader"></div> Generating...' : 'Generate Scene'}
            </button>
            <button class="generate-all-btn" id="generate-all-btn" ${!state.originalImage ? 'disabled' : ''}>
              Generate All Styles
            </button>
          </div>
        </div>
      </div>
      <div class="image-panel">
        <div class="image-container single-image-container">
          <h3>Original</h3>
          <div class="image-preview" id="original-preview">
            ${state.originalImage 
                ? `<img src="${state.originalImage.base64}" alt="Original product image">` 
                : `<div class="placeholder">Upload an image to start</div>`
            }
          </div>
        </div>
        <div class="generated-panel">
           ${state.isLoading 
              ? `<div class="full-panel-loader"><div class="loader"></div><p>Generating styles... this may take a moment.</p></div>` 
              : state.generatedImages && state.generatedImages.length > 0
                  ? `
                      <div class="generated-grid">
                          ${state.generatedImages.map(img => `
                              <div class="image-container generated-item">
                                  <h3>${img.name}</h3>
                                  <div class="image-preview">
                                      <img src="${img.base64}" alt="AI generated scene for ${img.name}">
                                  </div>
                                  <a href="${img.base64}" download="generated-${img.name.replace(/\s+/g, '-')}.png" class="download-btn">Download</a>
                              </div>
                          `).join('')}
                      </div>
                  `
                  : `<div class="image-container"><div class="placeholder full-height">Your new product shots will appear here</div></div>`
          }
        </div>
      </div>
    </main>
  `;

  // --- Add event listeners after rendering ---
  document.getElementById('file-upload')?.addEventListener('change', handleImageUpload);
  document.querySelectorAll('.preset-btn').forEach(button => {
    button.addEventListener('click', () => handlePresetClick((button as HTMLElement).dataset.prompt!));
  });
  document.getElementById('prompt-input')?.addEventListener('input', handlePromptInput);
  document.getElementById('generate-btn')?.addEventListener('click', handleGenerate);
  document.getElementById('generate-all-btn')?.addEventListener('click', handleGenerateAll);
}

function setState(newState: Partial<typeof state>) {
  state = { ...state, ...newState };
  render();
}

// --- Initial Render ---
render();