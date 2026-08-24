import dotenv from 'dotenv';
dotenv.config();

export interface PreVisitAIResult {
  urgencyLevel: 'Low' | 'Medium' | 'High';
  chiefComplaint: string;
  suggestedQuestions: string[];
  fullSummary: string;
}

export interface PostVisitAIResult {
  patientFriendlySummary: string;
  medicationSchedule: string;
  followUpSteps: string[];
}

/**
 * Intelligent deterministic fallback generator for Pre-Visit Summary
 * Ensures zero downtime and strict adherence to guidance even without an active API key.
 */
function generateFallbackPreVisitSummary(symptoms: string): PreVisitAIResult {
  const lower = symptoms.toLowerCase();
  
  let urgency: 'Low' | 'Medium' | 'High' = 'Low';
  if (
    lower.includes('chest pain') ||
    lower.includes('tightness') ||
    lower.includes('shortness of breath') ||
    lower.includes('breathing') ||
    lower.includes('severe') ||
    lower.includes('fainting') ||
    lower.includes('blood') ||
    lower.includes('unconscious')
  ) {
    urgency = 'High';
  } else if (
    lower.includes('fever') ||
    lower.includes('pain') ||
    lower.includes('migraine') ||
    lower.includes('dizziness') ||
    lower.includes('weeks') ||
    lower.includes('rash') ||
    lower.includes('vomiting')
  ) {
    urgency = 'Medium';
  }

  // Chief complaint extraction heuristic
  const sentences = symptoms.split(/[.!?\n]/).filter(s => s.trim().length > 0);
  const chief = sentences.length > 0 ? sentences[0].trim() : symptoms.substring(0, 80);

  // Suggested questions based on detected keywords
  const questions: string[] = [];
  if (lower.includes('pain') || lower.includes('tightness') || lower.includes('chest')) {
    questions.push('On a scale of 1-10, how would you rate the pain, and does it radiate to other areas?');
    questions.push('What specific activities or postures trigger or relieve these symptoms?');
  } else if (lower.includes('rash') || lower.includes('skin') || lower.includes('itch')) {
    questions.push('Have you started using any new soaps, cosmetics, or topical creams recently?');
    questions.push('Is the rash accompanied by burning sensations or itching at night?');
  } else if (lower.includes('headache') || lower.includes('migraine') || lower.includes('dizzy')) {
    questions.push('Are you experiencing any visual auras, nausea, or sensitivity to light/sound?');
    questions.push('Have there been notable changes in your hydration or sleep patterns?');
  } else {
    questions.push('When did you first notice the onset of these symptoms, and have they worsened over time?');
    questions.push('Have you noticed any associated triggers, such as meals, exertion, or stress?');
  }
  questions.push('Are you currently taking any prescription medications or over-the-counter remedies for this?');

  const fullSummary = `AI Pre-Visit Assessment:\n- Urgency Level: ${urgency}\n- Chief Complaint: ${chief}\n- Clinical Context: Patient reports symptoms for clinical evaluation. Review vital signs and targeted history.`;

  return {
    urgencyLevel: urgency,
    chiefComplaint: chief,
    suggestedQuestions: questions.slice(0, 3),
    fullSummary
  };
}

/**
 * Intelligent fallback generator for Post-Visit Summary
 */
function generateFallbackPostVisitSummary(clinicalNotes: string, prescriptionNotes?: string): string {
  return `### Patient-Friendly Visit Summary

**Overview & Doctor's Findings:**
${clinicalNotes}

${prescriptionNotes ? `**Medication Schedule:**\n${prescriptionNotes}\n\n*Important:* Take all medications as prescribed with meals unless otherwise directed.` : ''}

**Recommended Follow-Up Steps:**
1. Monitor your symptoms daily and record any significant changes.
2. Follow all lifestyle and dietary suggestions provided during your consultation.
3. Schedule your recommended follow-up review or reach out immediately if your symptoms change or worsen.`;
}

/**
 * Generate Pre-Visit Summary using LLM (Gemini / OpenAI API) with graceful fallback
 * Prompt: "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"
 */
export async function generatePreVisitSummary(symptoms: string): Promise<PreVisitAIResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.log('[AI Service] No LLM API Key provided. Using intelligent medical NLP fallback.');
    return generateFallbackPreVisitSummary(symptoms);
  }

  const prompt = `You are a clinical AI assistant for a medical practice.
Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}

Respond strictly in valid JSON format with this exact structure:
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "Short concise summary of the primary complaint",
  "suggestedQuestions": [
    "Question 1 for doctor to ask",
    "Question 2 for doctor to ask",
    "Question 3 for doctor to ask"
  ],
  "fullSummary": "Comprehensive 2-3 sentence clinical overview for doctor"
}`;

  // Try Gemini API if key exists
  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            urgencyLevel: ['Low', 'Medium', 'High'].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : 'Medium',
            chiefComplaint: parsed.chiefComplaint || symptoms.slice(0, 60),
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
            fullSummary: parsed.fullSummary || parsed.chiefComplaint
          };
        }
      } else {
        console.warn(`[AI Service] Gemini API returned error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.warn('[AI Service] Gemini request error, falling back gracefully:', err);
    }
  }

  // Fallback to OpenAI API if key exists
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            urgencyLevel: ['Low', 'Medium', 'High'].includes(parsed.urgencyLevel) ? parsed.urgencyLevel : 'Medium',
            chiefComplaint: parsed.chiefComplaint || symptoms.slice(0, 60),
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
            fullSummary: parsed.fullSummary || parsed.chiefComplaint
          };
        }
      }
    } catch (err) {
      console.warn('[AI Service] OpenAI request error, falling back gracefully:', err);
    }
  }

  // Graceful fallback if network or API fail
  return generateFallbackPreVisitSummary(symptoms);
}

/**
 * Generate Post-Visit Patient Friendly Summary using LLM with graceful fallback
 * Prompt: "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
export async function generatePostVisitSummary(clinicalNotes: string, prescriptionNotes?: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const combinedNotes = `Clinical Notes:\n${clinicalNotes}\n\nPrescription / Rx:\n${prescriptionNotes || 'None'}`;

  if (!geminiKey && !openaiKey) {
    console.log('[AI Service] No LLM API Key provided. Using structured medical translator fallback.');
    return generateFallbackPostVisitSummary(clinicalNotes, prescriptionNotes);
  }

  const prompt = `You are an empathetic, clear medical communicator.
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${combinedNotes}

Format the output in clear Markdown with the following sections:
### 1. Diagnosis & What We Found
(Clear explanation avoiding obscure jargon)

### 2. Medication Schedule & Instructions
(Organized bullet list with medication name, exact dose, when to take it, and with/without food)

### 3. Follow-Up Steps & Self Care
(Numbered actionable steps, warning signs to watch for, and next checkup date)`;

  // Try Gemini
  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) return rawText.trim();
      }
    } catch (err) {
      console.warn('[AI Service] Gemini post-visit error, fallback:', err);
    }
  }

  // Try OpenAI
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content.trim();
      }
    } catch (err) {
      console.warn('[AI Service] OpenAI post-visit error, fallback:', err);
    }
  }

  return generateFallbackPostVisitSummary(clinicalNotes, prescriptionNotes);
}
