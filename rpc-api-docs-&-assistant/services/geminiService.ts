import { GoogleGenAI } from "@google/genai";
import { RpcMethod, ProgrammingLanguage } from "../types";

// Initialize the Google GenAI client with the API key from the environment.
// The API key must be obtained exclusively from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Use gemini-3-pro-preview for complex coding tasks.
const CODE_GEN_MODEL = "gemini-3-pro-preview";
// Use gemini-2.5-flash for basic text tasks/explanations.
const EXPLAIN_MODEL = "gemini-2.5-flash";

export const generateClientCode = async (
  method: RpcMethod,
  language: ProgrammingLanguage
): Promise<string> => {
  const prompt = `
    You are an expert API developer. 
    Generate a production-ready client code snippet for the following RPC method in ${language}.
    
    Method Definition:
    ${JSON.stringify(method, null, 2)}
    
    Requirements:
    - Use standard libraries where possible or popular HTTP clients (e.g., axios for JS, requests for Python).
    - Include error handling.
    - Add comments explaining the key parts.
    - Return ONLY the code, no markdown fencing.
  `;

  try {
    const response = await ai.models.generateContent({
      model: CODE_GEN_MODEL,
      contents: prompt,
    });
    return response.text?.trim() || "// No code generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return `// Error generating code: ${error instanceof Error ? error.message : String(error)}`;
  }
};

export const explainMethod = async (method: RpcMethod, query: string): Promise<string> => {
  const prompt = `
    You are a helpful technical writer and API expert.
    The user is asking a question about the following RPC method: "${method.name}".
    
    Method Definition:
    ${JSON.stringify(method, null, 2)}
    
    User Question: "${query}"
    
    Answer concisely and clearly. Focus on helping the developer understand how to use the API.
  `;

  try {
    const response = await ai.models.generateContent({
      model: EXPLAIN_MODEL,
      contents: prompt,
    });
    return response.text?.trim() || "I couldn't generate an explanation.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I encountered an error while trying to explain this.";
  }
};