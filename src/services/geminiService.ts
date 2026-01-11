import { GoogleGenAI } from "@google/genai";
import { Student, GenerationStyle } from "../types";

const getClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const generateStudentMessage = async (
  student: Student,
  style: GenerationStyle,
  customInstructions: string,
  teacherName: string,
  abortSignal?: AbortSignal
): Promise<string> => {
  const ai = getClient();
  
  const prompt = createPrompt(student, style, customInstructions, teacherName);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        systemInstruction: `You are a professional, empathetic, and precise school teacher writing a personalized update to parents.
        
        **DATA INTERPRETATION RULES (Mashov/Event Logs):**
        1. **Structure:** The data provided is a list of EVENTS. Each item is a single event (e.g., "Late", "Absence", "Good Word").
        2. **Subject Grouping:** Multiple events may have the SAME "subjectName". You must AGGREGATE them in your mind. 
           - Example: If you see 3 records for "Math" with "Late", say "In Math, there were 3 incidents of lateness."
        3. **Justifications:** 
           - Events marked as "(מוצדק)" or "Justified" or "Medical" (מחלה) are NOT disciplinary issues. Mention them only as context if significant (e.g., "Note: recent medical absences") or ignore them. DO NOT scold the student for justified absences.
        4. **Event Types:**
           - **Positive:** "מילה טובה" (Good Word), "הצטיינות" (Excellence), "חיזוק". -> **Highlight these warmly!**
           - **Negative:** "איחור" (Late), "חיסור" (Absence), "הפרעה" (Disturbance), "אי הכנת שיעורי בית" (No Homework).
        
        **Tone & Style:**
        - Be constructive. Start with the good news.
        - Sign as: "${teacherName}".
        - Language: ${student.language || 'Hebrew'}.
        `
      }
    });

    if (abortSignal?.aborted) {
        throw new Error("Aborted");
    }

    return response.text?.trim() || "שגיאה ביצירת ההודעה.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "שגיאה בהתחברות ל-AI. אנא בדוק את מפתח ה-API או נסה שנית.";
  }
};

const createPrompt = (student: Student, style: GenerationStyle, customInstructions: string, teacherName: string): string => {
  // Convert subjects to a JSON string for the model
  let dataDescription = JSON.stringify(student.subjects, null, 2);
  
  let styleInstructions = "";
  let openingInstruction = "";

  if (style === GenerationStyle.REPORT_CARD) {
     openingInstruction = `Start with: "${student.firstName} היקר/ה,"`;
     styleInstructions = `
     **Goal: Report Card Comment (הערה לתעודה)**
     - Length: 4-6 sentences.
     - Tone: Formal yet warm.
     - **Aggregation is Key:** Do not list every single date. Summarize the behavior and academic performance across subjects.
     - Focus: 
       1. Personal qualities (Derek Eretz).
       2. Effort and participation.
       3. Academic achievements.
       4. One specific goal for improvement next semester (if applicable).
     `;
  } else if (style === GenerationStyle.DETAILED) {
     openingInstruction = `Start with a polite greeting to the parents.`;
     styleInstructions = `
     **Goal: Comprehensive Status Report**
     - Summarize the behavioral events by subject.
     - Explicitly mention the number of "Positive Words" (מילה טובה) if any.
     - Address specific challenges (Unjustified Lates, Homework) if they appear frequently in specific subjects.
     - Use the "Verbal Comment" (הערה מילולית) field content if available to add depth.
     `;
  } else {
     openingInstruction = `Start with a polite greeting to the parents.`;
     styleInstructions = `
     **Goal: General Overview**
     - Identify the MAIN TREND (e.g., "Generally positive but needs to work on punctuality").
     - Keep it short (3 sentences).
     - Do not list specific grades or dates.
     `;
  }

  return `
  Student Name: ${student.fullName} (First: ${student.firstName})
  Teacher: ${teacherName}
  
  --- RAW DATA (List of Events/Grades) ---
  ${dataDescription}
  --- END DATA ---

  User Custom Requests: ${customInstructions}
  `;
};