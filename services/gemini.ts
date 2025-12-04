import { GoogleGenAI, Type } from "@google/genai";
import { Annotation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const detectUVParts = async (base64Image: string): Promise<Annotation[]> => {
  const prompt = `
    Analyze this Roblox character UV layout image. 
    Identify the center point of the main body parts: Face (or Head), Torso (Front), Torso (Back), Left Arm, Right Arm, Left Leg, Right Leg.
    
    Return a JSON array of objects with 'label', 'x', and 'y' properties.
    x and y must be coordinates as a percentage (0-100) of the image width and height.
    
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
  let annotationText = "";
  let faceDefined = false;

  if (annotations.length > 0) {
    annotationText = "COORDINATES OF BODY PARTS (Center points):\n";
    annotations.forEach((ann) => {
      annotationText += `- At ${Math.round(ann.x)}% x, ${Math.round(ann.y)}% y: "${ann.label}".\n`;
      
      const labelLower = ann.label.toLowerCase();
      if (labelLower.includes('face') || labelLower.includes('head') || labelLower.includes('лицо') || labelLower.includes('голова')) {
        faceDefined = true;
      }
    });
  }

  const fullPrompt = `
    You are a professional 3D Texture Artist for Roblox.
    
    INPUT: A UV Layout wireframe image.
    TASK: Create a FINAL PRODUCTION TEXTURE.
    
    STYLE DESCRIPTION: ${stylePrompt}
    
    ${annotationText}
    
    CRITICAL RENDERING RULES (MUST FOLLOW):
    1. **OBLITERATE THE WIREFRAME**: The input image contains black layout lines. You must PAINT COMPLETELY OVER THEM. The final output must be a solid, painted texture map. If I see the original grid lines in the output, it is a failure.
    2. **SOLID FILL**: Fill the texture islands with opaque materials (metal, cloth, skin, etc.) based on the style. No transparency inside the body parts.
    3. **FACE**: ${faceDefined ? 'Focus on the area marked "Face" or "Head".' : 'Locate the Face area.'} Paint a human/character face (eyes, mouth) suitable for the style. **DO NOT DRAW A HELMET OVER THE FACE**. The helmet is a separate 3D attachment. The face must be visible.
    4. **LAYOUT ACCURACY**: Keep the painted areas exactly in the same positions as the input islands, but replace the wireframe pixels with texture pixels.
    5. **BACKGROUND**: The space between the body parts should be transparent or solid black/dark.
    
    Think: "I see the wireframe guide. I will paint a ${stylePrompt} texture on top of it, covering every single black line with color. For the face, I will draw a face, not a mask."
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
