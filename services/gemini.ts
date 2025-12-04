import { GoogleGenAI, Type } from "@google/genai";
import { Annotation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const detectUVParts = async (base64Image: string): Promise<Annotation[]> => {
  const prompt = `
    Analyze this Roblox character UV layout image. 
    Identify the CENTER POINT of the main body parts: Face (or Head), Torso (Front), Torso (Back), Left Arm, Right Arm, Left Leg, Right Leg.
    
    Return a JSON array of objects with 'label', 'x', and 'y' properties.
    x and y must be coordinates as a percentage (0-100) of the image width and height.
    0,0 is top-left. 100,100 is bottom-right.
    
    Example: [{"label": "Face", "x": 82, "y": 20}, {"label": "Torso", "x": 50, "y": 50}]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              x: { type: Type.NUMBER, description: "X coordinate percentage 0-100" },
              y: { type: Type.NUMBER, description: "Y coordinate percentage 0-100" },
            },
            required: ["label", "x", "y"],
          },
        },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      // Map to Annotation type with IDs
      return parsed.map((item: any, index: number) => ({
        id: `auto-${Date.now()}-${index}`,
        label: item.label,
        x: item.x,
        y: item.y
      }));
    }
    return [];
  } catch (error) {
    console.error("Detection Error:", error);
    return []; // Return empty if detection fails, don't break app
  }
};

export const generateTexture = async (
  baseImageBase64: string,
  stylePrompt: string,
  annotations: Annotation[]
): Promise<string> => {
  
  // Construct a detailed prompt based on user input and annotations
  let annotationText = "NO EXPLICIT COORDINATES PROVIDED. USE STANDARD ROBLOX UV KNOWLEDGE.";
  let faceDefined = false;

  if (annotations.length > 0) {
    annotationText = "CRITICAL: MANDATORY SPATIAL MAPPING (0% is Top/Left, 100% is Bottom/Right):\n";
    annotations.forEach((ann) => {
      annotationText += `   - POSITION [X:${Math.round(ann.x)}%, Y:${Math.round(ann.y)}%] -> EXACT CENTER of "${ann.label}". Paint the "${ann.label}" texture HERE.\n`;
      
      const labelLower = ann.label.toLowerCase();
      if (labelLower.includes('face') || labelLower.includes('head') || labelLower.includes('лицо') || labelLower.includes('голова')) {
        faceDefined = true;
      }
    });
  }

  const fullPrompt = `
    Role: Professional Roblox Texture Artist.
    Task: Create a FINAL PRODUCTION SKIN based on the User's Style and Spatial Instructions.
    
    USER STYLE: "${stylePrompt}"
    
    ${annotationText}
    
    EXECUTION RULES (YOU MUST OBEY):
    1. **RESPECT MARKERS**: I have provided explicit coordinates for body parts above. You MUST paint the specific design for that part EXACTLY at those X/Y coordinates.
       - If I say "Face" is at 80% X, 20% Y, you MUST draw the face eyes/mouth there. 
       - Do not rely on "default" template positions if the coordinates say otherwise.
       - The coordinates point to the CENTER of the texture island.
    
    2. **OBLITERATE THE WIREFRAME**: The input image contains layout lines. You must PAINT COMPLETELY OVER THEM with the skin texture. The final result should look like a game-ready texture file, not a wireframe.
    
    3. **FACE**: ${faceDefined ? 'Paint a character face (eyes, mouth) at the coordinates marked "Face".' : 'Locate the Face area and paint a face.'} 
       - **NO HELMET ON FACE**: Even if the style is "armor", the face itself must be visible (skin + face features) unless the user explicitly asked for a full mask.
    
    4. **SOLID FILL**: Fill the body part islands with opaque materials matching the style.
    
    5. **BACKGROUND**: Keep the empty space between islands dark or transparent.
    
    Think: "I will find pixel location X,Y from the instructions. I will paint the ${stylePrompt} version of the body part exactly there."
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: fullPrompt,
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: baseImageBase64,
            },
          },
        ],
      },
      config: {
        temperature: 0.65
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
         return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data received from Gemini.");

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate texture");
  }
};

export const editTexture = async (
  currentImageBase64: string,
  editInstruction: string
): Promise<string> => {
  const prompt = `
    EDIT INSTRUCTION: ${editInstruction}
    
    CONTEXT: This is a Roblox character texture (UV Map). 
    RULES:
    1. Apply the edit specifically to the requested parts or globally as asked.
    2. KEEP the exact UV layout structure. Do not move body parts.
    3. Maintain the style consistency.
    4. Ensure the output is high quality and ready for game use.
    
    Do not add any conversational text, just return the image.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: currentImageBase64,
            },
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
         return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No edited image data received.");

  } catch (error: any) {
    console.error("Gemini Edit Error:", error);
    throw new Error(error.message || "Failed to edit texture");
  }
};