// Institutional AI Handler - Zero Dependency
// Optimized for Stability and Speed on Supabase Edge Runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Declare Deno global for TypeScript
declare const Deno: {
    env: {
        get(key: string): string | undefined;
    };
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-user-agent',
};

const MODEL_ID = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1/models';

console.log("AI Handler v4.3 Optimized");

// --- UTILITIES ---
const createResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
};

const cleanJson = (text: string) => {
    // Find the start and end of a JSON object or array
    const firstBracket = text.indexOf('{');
    const firstSquare = text.indexOf('[');

    let start = -1;
    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);

    if (start === -1) {
        throw new Error("AI response did not contain a valid JSON object or array.");
    }

    const endChar = text[start] === '{' ? '}' : ']';
    const end = text.lastIndexOf(endChar);

    if (end === -1 || end < start) {
        throw new Error("AI response contained an incomplete JSON structure.");
    }

    const raw = text.substring(start, end + 1);

    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error("JSON Parse Error:", e, "Raw text:", raw);
        throw new Error("AI response contained malformed JSON.");
    }
};


// --- GEMINI API CLIENT ---
async function generateContent(apiKey: string, contents: any[], systemInstruction?: string, jsonMode = false) {
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-flash-latest',
        'gemini-3-flash-preview',
        'gemini-1.5-flash-latest'
    ];
    let lastError = null;

    for (const modelId of models) {
        try {
            console.log(`[AI] Attempting ${modelId}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

            const body: any = {
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            };

            if (systemInstruction) {
                body.systemInstruction = { parts: [{ text: systemInstruction }] };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.status === 404) {
                console.warn(`[AI] Model ${modelId} not found on v1beta. Trying next...`);
                continue;
            }

            if (!response.ok) {
                let errorText = await response.text();
                throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text && jsonMode && data.candidates?.[0]?.content?.parts?.[0]?.json) {
                return JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.json);
            }

            if (!text) throw new Error("Empty response from AI model.");

            console.log(`[AI] Successfully used ${modelId}`);
            return text;

        } catch (e: any) {
            console.error(`[AI] Error with ${modelId}:`, e.message);
            lastError = e;
            if (e.message.includes("404")) continue;
            throw e; // If it's not a 404, it might be a key or quota error, so stop.
        }
    }

    throw lastError || new Error("All AI models failed to respond.");
}

// --- SUPABASE CLIENT ---
async function supabaseRest(method: string, endpoint: string, body?: any) {
    const url = Deno.env.get('SUPABASE_URL') + '/rest/v1/' + endpoint;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const headers: any = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
        const txt = await res.text();
        console.error(`Supabase REST Error (${endpoint}):`, txt);
        return null;
    }
    return res.json().catch(() => ({}));
}

// --- MAIN HANDLER ---
serve(async (req: Request) => {
    // 1. Handle CORS Preflight - CRITICAL
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            return createResponse({ error: 'Method Not Allowed' }, 405);
        }



        let body;
        try {
            body = await req.json();
        } catch {
            return createResponse({ error: 'Invalid JSON body' }, 400);
        }

        const { task, payload = {} } = body;
        console.log(`[V5.1] Processing Task: ${task}`);

        if (!task) {
            return createResponse({ success: false, error: 'Missing task' }, 400);
        }

        const API_KEY = Deno.env.get('API_KEY');
        if (!API_KEY || API_KEY.length < 10 || API_KEY.includes('PLACEHOLDER')) {
            console.error("CRITICAL: API_KEY is missing/invalid.");
            return createResponse({
                success: false,
                version: "5.1",
                error: 'AI Configuration Error',
                message: 'Your Google Gemini API Key is missing or invalid. Please set it using: "supabase secrets set API_KEY=..."'
            }, 200);
        }

        let textResponse: string;
        let jsonResponse: any;

        switch (task) {
            case 'verify-admin-id': {
                const { fullName, role, college, mimeType, base64Data } = payload;
                if (!base64Data) throw new Error("No image data provided.");

                textResponse = await generateContent(API_KEY, [{
                    parts: [
                        { inlineData: { mimeType: mimeType, data: base64Data } },
                        {
                            text: `ACT AS AN AI-POWERED DOCUMENT FORENSIC OFFICER. Analyze this ID card with extreme precision.
                                
                                USER DETAILS TO VERIFY:
                                - CLAIMED NAME: "${fullName}"
                                - CLAIMED ROLE: "${role}"
                                - CLAIMED INSTITUTION: "${college}"
                                
                                MANDATORY CHECKS:
                                1. **Originality vs. Modification**: Inspect for signs of digital tampering. Look for:
                                   - Inconsistent font faces or weights.
                                   - Pixelation around text regions that doesn't match the background.
                                   - Background patterns (guilloche) that are interrupted or blurred.
                                   - "Cut and Paste" edges around photos or names.
                                2. **Institutional Accuracy**: Does the ID card explicitly belong to "${college}"?
                                3. **Role Validation**: Does the ID clearly state the user is a "${role}" or equivalent?
                                4. **Name Cross-Check**: Does the name on the ID card match "${fullName}"?
                                5. **Employee ID Extraction**: Locate and extract the numeric/alphanumeric Employee ID, Roll No, or Registration ID from the card.
                                
                                Return JSON: { 
                                    "isMatch": boolean, 
                                    "reason": "string", 
                                    "isOriginal": boolean, 
                                    "employeeId": "string" | null,
                                    "confidenceScore": number (0-100)
                                }
                                
                                REJECTION RULES:
                                - If 'isOriginal' is false, set 'isMatch' to false.
                                - If Institution name is different, set 'isMatch' to false.
                                - If Role does not match 'Dean', set 'isMatch' to false.`
                        }
                    ]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                if (jsonResponse?.isMatch && jsonResponse.confidenceScore > 70) { // Add a confidence threshold
                    return createResponse(jsonResponse);
                } else {
                    return createResponse({ success: false, message: jsonResponse?.reason || "Verification failed with low confidence." }, 200);
                }
            }

            case 'generate-idf': {
                const { title, studentName, rollNo, faculty, objective, novelty } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `ACT AS AN INTELLECTUAL PROPERTY CONSULTANT. 
                    Generate a professional Invention Disclosure Form (IDF) for Anurag University based on these details:
                    TITLE: "${title}"
                    INVENTOR: "${studentName} (${rollNo})"
                    FACULTY IN CHARGE: "${faculty}"
                    MAIN OBJECTIVE: "${objective}"
                    NOVELTY: "${novelty}"
                    
                    Format the output into a formal document with these sections:
                    1. Invention Title
                    2. Names of Inventor(s)
                    3. Faculty In Charge
                    4. Description of Invention (elaborate based on title/objective)
                    5. Main Objective
                    6. Novelty of the Project
                    7. Advantages
                    
                    Use clear Markdown formatting and professional technical language.` }]
                }]);
                return createResponse({ text: textResponse });
            }

            case 'structured-circular': {
                const { office, refNo, subject, content, target, deadline } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Generate an official University Circular for Anurag University.
                    ISSUING OFFICE: "${office}"
                    REF NO: "${refNo}"
                    SUBJECT: "${subject}"
                    CONTENT: "${content}"
                    TARGET AUDIENCE: "${target}"
                    DEADLINE/DATE: "${deadline}"
                    
                    The format must strictly follow:
                    - Top: ANURAG UNIVERSITY Logo placeholder and Office Name
                    - Middle-Left: Cir. No
                    - Middle-Center: CIRCULAR (Underlined)
                    - Middle-Center: Subject Header (Bold/Underlined)
                    - Body: Formal text with table for dates/schedules if applicable.
                    - Footer: Signatory placeholders for Director (OIA) and Dean.
                    
                    Use Markdown.` }]
                }]);
                return createResponse({ text: textResponse });
            }

            case 'generate-research-paper': {
                const { topic, focus } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `ACT AS A SENIOR RESEARCH SCIENTIST. 
                    Write a comprehensive research paper draft in IEEE format for the topic: "${topic}".
                    Focus specifically on: "${focus}".
                    Include: Abstract, Introduction, Literature Review, Proposed Methodology, Results (Hypothetical), Conclusion, and References. 
                    Use formal academic language and Markdown.` }]
                }]);
                return createResponse({ text: textResponse });
            }

            case 'check-originality': {
                const { text } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Analyze this text for academic originality and AI probability: "${text}".
                    Return JSON: { "score": number (0-100, where 100 is highly original), "verdict": "string", "analysis": "string", "flags": ["string"] }` }]
                },
                ], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'generate-mom': {
                const { notes, title } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Convert these raw meeting notes into professional Minutes of Meeting (MoM).
                    Meeting Title: "${title}".
                    Raw Notes: "${notes}".
                    Format: Attendance, Agenda, Key Decisions, Action Items (with owners), and Next Meeting Date. Use clear Markdown tables.` }]
                }]);
                return createResponse({ text: textResponse });
            }

            case 'proctor-check': {
                const { base64Data } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                        { text: `ACT AS AN AI PROCTOR. Analyze this frame. Return JSON: { "isViolation": boolean, "reason": "str", "severity": "low" | "high" }` }
                    ]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'agentic-chat': {
                const { message, userRole, pageContext, currentDate } = payload;
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: message }] }],
                    `You are Nexus AI Mentor for ${userRole}. Today is ${currentDate}.
                    ${pageContext ? `Current user context: ${pageContext}.` : ''}
                    ALWAYS return JSON: { "text": "spoken response", "command": object | null }`,
                    true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'analyze-idea': {
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: `Analyze startup idea: ${JSON.stringify(payload)}. Return JSON: { "noveltyScore": number, "marketExistence": { "isExistent": boolean, "details": "str" }, "investorPitch": "str" }` }] }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'opportunity-link-scraper': {
                const res = await fetch(payload.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    }
                });

                if (!res.ok) throw new Error(`Could not access the URL (Status: ${res.status}). Some sites like LinkedIn may block automated requests.`);

                let html = await res.text();

                // --- METADATA EXTRACTION ---
                const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1].trim() : "";

                const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
                const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

                const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["']/i);
                const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : "";

                const metadataStr = `Page Title: ${title}\nDescription: ${metaDesc}\nSocial Description: ${ogDesc}\n\n`;

                // --- ADVANCED CLEANING ---
                // Remove scripts, styles, and comments
                html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
                html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
                html = html.replace(/<!--([\s\S]*?)-->/g, "");

                // Extract body content if available
                const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                let bodyContent = bodyMatch ? bodyMatch[1] : html;

                // Strip all other HTML tags and normalize whitespace
                bodyContent = bodyContent.replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                const clean = (metadataStr + bodyContent).substring(0, 5000); // Increased limit for better context

                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `ACT AS A HIGH-PRECISION JOB OPPORTUNITY DATA EXTRACTOR. 
                    I have scraped text from a webpage: "${clean}". 
                    
                    TASK:
                    1. Extract the Job Title and Company Name accurately.
                    2. Summarize the Job Description in 2-3 concise sentences.
                    3. Find the minimum CGPA required (if missing, return 0).
                    4. Identify the application deadline (Format: YYYY-MM-DD). If no date is found, use a date 30 days from today.
                    5. Construct a logical hiring pipeline (e.g., ["Registration", "Assessment", "Technical Interview", "HR Interview", "Offer"]).
                    
                    CRITICAL: If the text is "miscellaneous" (not a clear job post), still try to find ANY relevant career information or return the best possible guess.
                    
                    RETURN JSON ONLY: { 
                      "title": "str", 
                      "company": "str", 
                      "description": "str", 
                      "min_cgpa": number, 
                      "deadline": "YYYY-MM-DD",
                      "pipeline": ["str", "str"...] 
                    }` }]
                }], undefined, true);

                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'search-opportunities': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Search for job roles matching: "${payload.query}". 
                    Return JSON: { "opportunities": [{ "title": "str", "company": "str", "link": "str", "summary": "str" }] }` }]
                }], undefined, true);

                let parsedResponse = cleanJson(textResponse);

                // Ensure the response always has an 'opportunities' array property
                if (!parsedResponse || typeof parsedResponse !== 'object') {
                    // If the AI returned an array directly, wrap it
                    if (Array.isArray(parsedResponse)) {
                        parsedResponse = { opportunities: parsedResponse };
                    } else {
                        // Fallback if it's neither an object nor an array (e.g., null, string)
                        parsedResponse = { opportunities: [] };
                    }
                } else if (!Array.isArray(parsedResponse.opportunities)) {
                    // If it's an object but 'opportunities' is missing or not an array
                    parsedResponse.opportunities = [];
                }

                jsonResponse = parsedResponse;
                return createResponse(jsonResponse);
            }

            case 'opportunity-analysis': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Analyze this job posting: Title: ${payload.title}, Company: ${payload.company}, Desc: ${payload.description}.
                    Return JSON: { "key_skills": ["str"], "resume_tips": "markdown_str", "interview_questions": ["str"], "pipeline": ["Registration", "Assessment", "Interview", "Offer"] }` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'detention-risk-analysis': {
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: `Analyze these academic/placement metrics: ${JSON.stringify(payload.metrics)}. ${payload.customPrompt || ''}. Provide a markdown report.` }] }]);
                return createResponse({ text: textResponse });
            }

            case 'candidate-pool-analysis': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Analyze candidate pool for ${payload.jobTitle}. Data: ${JSON.stringify(payload.candidates)}. 
                    Identify top matches and provide a markdown summary.
                    Return JSON: { "summary_markdown": "str", "top_candidate_ids": ["str"] }` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'generate-interview-report': {
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: `Generate a detailed interview performance report. History: ${JSON.stringify(payload.history)}. Role: ${payload.role}. Company: ${payload.company}. Provide markdown.` }] }]);
                return createResponse({ text: textResponse });
            }

            case 'query-summary': {
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: `Summarize these student queries: ${JSON.stringify(payload.queries)}. Group them by topic and urgency in markdown.` }] }]);
                return createResponse({ text: textResponse });
            }

            case 'optimize-schedule': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Optimize this student schedule. Deadlines: ${JSON.stringify(payload.deadlines)}. Current: ${JSON.stringify(payload.currentEvents)}. 
                    Return JSON: [{ "title": "Study: Topic", "start": "ISO_DATE", "reason": "str" }]` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'moderate-service-listing': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Moderate this campus service listing. Title: ${payload.title}, Desc: ${payload.description}. 
                    Check for illegal items, drugs, or explicit content.
                    Return JSON: { "isAppropriate": boolean, "reason": "str" }` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'verify-milestone-proof': {
                const { mimeType, base64Data, milestone, companyName, applicationId, studentId } = payload;
                if (!base64Data) throw new Error("No image data provided.");

                textResponse = await generateContent(API_KEY, [{
                    parts: [
                        { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
                        {
                            text: `Verify this image proof for the "${milestone}" stage at "${companyName}".
                    Return JSON: { "success": boolean, "message": "string" }`
                        }
                    ]
                }], undefined, true);

                jsonResponse = cleanJson(textResponse);

                if (jsonResponse?.success) {
                    const apps = await supabaseRest('GET', `applications?id=eq.${applicationId}&select=opportunity_id`);
                    const appData = apps?.[0];
                    if (appData) {
                        const opps = await supabaseRest('GET', `opportunities?id=eq.${appData.opportunity_id}&select=ai_analysis`);
                        const pipeline = opps?.[0]?.ai_analysis?.pipeline || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];

                        const currentIdx = pipeline.findIndex((p: string) => p.toLowerCase() === milestone.toLowerCase());
                        const nextStage = (currentIdx !== -1 && currentIdx < pipeline.length - 1) ? pipeline[currentIdx + 1] : milestone;

                        let status = 'verified';
                        if (nextStage.toLowerCase().includes('offer')) status = 'offered';
                        if (nextStage.toLowerCase().includes('interview') || nextStage.toLowerCase().includes('assessment')) status = 'shortlisted';
                        if (nextStage.toLowerCase().includes('hired')) status = 'hired';


                        const xp = milestone.toLowerCase().includes('offer') ? 100 : 20; // XP logic adjusted from 150/30

                        await supabaseRest('PATCH', `applications?id=eq.${applicationId}`, { status, current_stage: nextStage, rejection_reason: null });
                        await supabaseRest('POST', `rpc/award_xp`, { user_id: studentId, xp_amount: xp });
                        return createResponse({ success: true, message: `Proof Validated! Advanced to ${nextStage}. (+${xp} XP)` });
                    } else {
                        return createResponse({ success: true, message: "Proof Validated." });
                    }
                } else {
                    await supabaseRest('PATCH', `applications?id=eq.${applicationId}`, { status: 'applied', rejection_reason: jsonResponse?.message || "Invalid Proof" });
                    return createResponse({ success: false, message: `Verification Rejected: ${jsonResponse?.message || "Invalid Proof"}` });
                }
            }

            case 'generate-exam-report': {
                const { topic, score, violations, feedback } = payload;
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: `Generate a student exam report. Subject: ${topic}, Score: ${score}, Proctored Violations: ${JSON.stringify(violations)}. Provide markdown with specific feedback: "${feedback || ''}" ` }] }]);
                return createResponse({ text: textResponse });
            }

            case 'job-matchmaking': {
                const { student, jobs } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `ACT AS AN AI RECRUITER. Match this student to the available jobs.
                    STUDENT: ${JSON.stringify(student)}
                    JOBS: ${JSON.stringify(jobs)}
                    
                    TASK:
                    1. For each job, calculate a match percentage (0-100).
                    2. Provide a 1-sentence "AI Reasoning" for the match.
                    3. Return ONLY the top 5 matches.
                    
                    RETURN JSON ONLY: { "recommendations": [{ "jobId": "str", "matchScore": number, "reasoning": "str" }] }` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'application-tailoring': {
                const { student, job } = payload;
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `ACT AS A CAREER ARCHITECT. Create a high-impact application pitch for this student.
                    STUDENT: ${JSON.stringify(student)}
                    JOB: ${JSON.stringify(job)}
                    
                    TASK:
                    Generate a 3-sentence "Why me?" pitch that highlights the student's top relevant skills and projects for this specific role. 
                    Be authoritative, data-driven (use CGPA/XP), and persuasive.
                    
                    RETURN JSON ONLY: { "pitch": "str" }` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            case 'generate-mock-test': {
                textResponse = await generateContent(API_KEY, [{
                    parts: [{
                        text: `Generate ${payload.count} technical questions for ${payload.topic}. 
                    Return JSON: [{ "id": 1, "type": "mcq", "question": "str", "options": ["str"], "correctIndex": 0, "hint": "str" }]` }]
                }], undefined, true);
                jsonResponse = cleanJson(textResponse);
                return createResponse(jsonResponse);
            }

            default:
                textResponse = await generateContent(API_KEY, [{ parts: [{ text: payload.prompt || payload.message || JSON.stringify(payload) }] }]);
                return createResponse({ text: textResponse });
        }

    } catch (error: any) {
        console.error("Global Handler Error:", error);
        return createResponse({
            success: false,
            error: error.message || 'Internal Server Error',
            details: String(error)
        }, 200);
    }
});