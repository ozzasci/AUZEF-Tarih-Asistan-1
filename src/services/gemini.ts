import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const summarizeLesson = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Aşağıdaki AUZEF Tarih ders notunu akademik bir dille özetle. Önemli kavramları (terminolojiyi) ve kritik tarihleri vurgula. 
    
    Ders Notu:
    ${text.substring(0, 15000)}`, // Limit text for safety
    config: {
      systemInstruction: "Sen uzman bir AUZEF Tarih akademisyenisin. Öğrenci Oğuz'a asistanlık yapıyorsun. Akademik terminoloji kullan ve sınav odaklı özet çıkar.",
    },
  });
  return response.text;
};

export const generateQuiz = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Aşağıdaki ders notundan 5 soruluk çoktan seçmeli bir test oluştur. Sorular akademik düzeyde ve vize sınavı formatında olmalı.
    
    Ders Notu:
    ${text.substring(0, 10000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            correctAnswer: { type: Type.INTEGER, description: "0-3 arası index" },
            explanation: { type: Type.STRING, description: "Neden bu şık doğru?" }
          },
          required: ["question", "options", "correctAnswer", "explanation"]
        }
      },
      systemInstruction: "AUZEF Tarih vize sınavı formatında, akademik terminoloji içeren sorular hazırla.",
    },
  });
  return JSON.parse(response.text || "[]");
};

export const generateAudio = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say clearly and academically: ${text.substring(0, 1000)}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Charon' }, // Professional male voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  return null;
};
