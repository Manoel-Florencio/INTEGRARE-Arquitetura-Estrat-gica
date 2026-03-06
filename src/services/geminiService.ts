import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const getGeminiResponse = async (prompt: string) => {
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);
    return response.response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};
