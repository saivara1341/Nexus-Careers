interface AIRequestParams {
    task: string;
    payload: any;
    supabase: any;
}

type AIProvider = 'supabase' | 'ollama';

const env = import.meta.env;

const getProvider = (): AIProvider => {
    const configured = (env.VITE_AI_PROVIDER || 'supabase').toLowerCase();
    return configured === 'ollama' ? 'ollama' : 'supabase';
};

const cleanJson = (text: string) => {
    const firstObject = text.indexOf('{');
    const firstArray = text.indexOf('[');
    let start = -1;
    if (firstObject === -1) start = firstArray;
    else if (firstArray === -1) start = firstObject;
    else start = Math.min(firstObject, firstArray);
    if (start === -1) throw new Error('AI response did not include JSON.');
    const endChar = text[start] === '{' ? '}' : ']';
    const end = text.lastIndexOf(endChar);
    if (end < start) throw new Error('AI response JSON was incomplete.');
    return JSON.parse(text.slice(start, end + 1));
};

const needsJson = new Set([
    'agentic-chat',
    'analyze-idea',
    'check-originality',
    'proctor-check',
    'opportunity-link-scraper',
    'search-opportunities',
    'opportunity-analysis',
    'candidate-pool-analysis',
    'optimize-schedule',
    'moderate-service-listing',
    'verify-milestone-proof',
    'job-matchmaking',
    'application-tailoring',
    'generate-mock-test',
    'resume-match-analysis',
]);

const buildPrompt = (task: string, payload: any) => {
    const base = `You are the AI engine for Nexus Careers. Task: ${task}. Return ${needsJson.has(task) ? 'valid JSON only' : 'clear markdown/plain text'}.`;
    switch (task) {
        case 'agentic-chat':
            return `${base}\nUser role: ${payload.userRole || 'user'}\nPage context: ${payload.pageContext || 'unknown'}\nMessage: ${payload.message}\nJSON schema: {"text":"response","command":null}`;
        case 'opportunity-analysis':
            return `${base}\nAnalyze this opportunity and return {"key_skills":[],"resume_tips":"","interview_questions":[],"pipeline":[]}.\n${JSON.stringify(payload)}`;
        case 'candidate-pool-analysis':
            return `${base}\nReturn {"summary_markdown":"","top_candidate_ids":[]}.\n${JSON.stringify(payload)}`;
        case 'job-matchmaking':
            return `${base}\nReturn {"recommendations":[{"jobId":"","matchScore":0,"reasoning":""}]}.\n${JSON.stringify(payload)}`;
        case 'generate-mock-test':
            return `${base}\nGenerate ${payload.count || 5} questions for ${payload.topic}. Return an array of MCQ objects with id,type,question,options,correctIndex,hint.`;
        default:
            return `${base}\nPayload:\n${JSON.stringify(payload, null, 2)}`;
    }
};

const invokeOllama = async (task: string, payload: any) => {
    const baseUrl = env.VITE_OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = env.VITE_OLLAMA_MODEL || 'llama3.1:8b';
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [
                { role: 'system', content: 'You power a career platform. Be concise, practical, and obey requested JSON schemas.' },
                { role: 'user', content: buildPrompt(task, payload) }
            ],
            options: { temperature: 0.4 }
        })
    });
    if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`);
    const data = await response.json();
    const content = data?.message?.content || data?.response || '';
    if (!content) throw new Error('Ollama returned an empty response.');
    return needsJson.has(task) ? cleanJson(content) : { text: content };
};

const words = (value: unknown) => String(value || '').toLowerCase().match(/[a-z0-9+#.]+/g) || [];

const inferSkills = (text: string) => {
    const known = ['react', 'typescript', 'javascript', 'python', 'java', 'sql', 'node', 'cloud', 'aws', 'azure', 'ml', 'ai', 'data', 'analytics', 'communication', 'testing', 'security'];
    const haystack = new Set(words(text));
    const found = known.filter(skill => haystack.has(skill));
    return found.length ? found.slice(0, 6) : ['communication', 'problem solving', 'collaboration'];
};

const fallback = (task: string, payload: any, cause?: any): any => {
    console.warn(`[AI-CLIENT] Using local fallback for ${task}:`, cause?.message || cause);

    switch (task) {
        case 'agentic-chat':
        case 'chat':
            return {
                text: `I can help with that. ${payload?.message || payload?.prompt || 'Tell me the goal, the deadline, and what you have already tried.'}`,
                command: null
            };

        case 'opportunity-analysis': {
            const text = `${payload.title || ''} ${payload.company || ''} ${payload.description || ''}`;
            const keySkills = inferSkills(text);
            return {
                key_skills: keySkills,
                resume_tips: `Emphasize projects and measurable outcomes related to ${keySkills.slice(0, 3).join(', ')}. Keep the resume one page and mirror the job description keywords honestly.`,
                interview_questions: [
                    `Tell me about a project where you used ${keySkills[0]}.`,
                    'How do you debug a production issue under time pressure?',
                    'Why are you interested in this role and company?'
                ],
                pipeline: ['Registration', 'Resume Shortlist', 'Assessment', 'Technical Interview', 'HR Interview', 'Offer']
            };
        }

        case 'candidate-pool-analysis': {
            const candidates = [...(payload.candidates || [])].sort((a, b) => ((b.cgpa || 0) - (a.cgpa || 0)) || ((a.backlogs || 0) - (b.backlogs || 0)));
            const top = candidates.slice(0, 5);
            return {
                summary_markdown: `### Candidate Pool Summary\n\nReviewed ${candidates.length} candidates for **${payload.jobTitle || 'this role'}**. Top matches were prioritized by CGPA, backlog count, and department fit. Use this as a first-pass shortlist, not a final hiring decision.`,
                top_candidate_ids: top.map(c => c.id).filter(Boolean)
            };
        }

        case 'job-matchmaking': {
            const studentSkills = new Set(words([...(payload.student?.skills || []), payload.student?.department, payload.student?.project_details].join(' ')));
            const recommendations = (payload.jobs || []).map((job: any) => {
                const jobSkills = inferSkills(`${job.title} ${job.company} ${job.desc}`);
                const overlap = jobSkills.filter(skill => studentSkills.has(skill));
                const cgpaBoost = Math.min(20, Math.max(0, Number(payload.student?.ug_cgpa || 0) * 2));
                return {
                    jobId: job.id,
                    matchScore: Math.min(95, 45 + overlap.length * 12 + cgpaBoost),
                    reasoning: overlap.length ? `Matches ${overlap.join(', ')} and academic profile.` : 'General fit based on role and available profile data.'
                };
            }).sort((a: any, b: any) => b.matchScore - a.matchScore).slice(0, 5);
            return { recommendations };
        }

        case 'application-tailoring':
            return { pitch: `I am a strong fit for ${payload.job?.title || 'this role'} because my academic record, projects, and campus experience align with the role expectations. I can contribute quickly, communicate clearly, and keep learning on the job.` };

        case 'generate-mock-test': {
            const topic = payload.topic || 'technical fundamentals';
            const count = Number(payload.count || 5);
            return Array.from({ length: count }, (_, index) => ({
                id: index + 1,
                type: 'mcq',
                question: `Which concept is most important when applying ${topic} in a real project?`,
                options: ['Clear requirements', 'Random implementation', 'Ignoring tests', 'Skipping documentation'],
                correctIndex: 0,
                hint: 'Start from the user need and constraints.'
            }));
        }

        case 'proctor-check':
            return { isViolation: false, reason: 'No automated vision model configured; no violation flagged by fallback.', severity: 'low' };

        case 'generate-exam-report':
            return { text: `### Exam Report\n\nScore: ${payload.score}\n\nFocus next on weak areas, review incorrect answers, and practice timed questions for ${payload.topic || 'the subject'}.` };

        case 'moderate-service-listing': {
            const text = `${payload.title || ''} ${payload.description || ''}`.toLowerCase();
            const blocked = ['drug', 'weapon', 'fake certificate', 'exam leak', 'password'];
            const hit = blocked.find(term => text.includes(term));
            return { isAppropriate: !hit, reason: hit ? `Blocked term detected: ${hit}` : 'No obvious policy issue detected.' };
        }

        case 'optimize-schedule': {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            tomorrow.setHours(18, 0, 0, 0);
            return [{ title: 'Study: Placement preparation', start: tomorrow.toISOString(), reason: 'Fallback planner reserved an evening deep-work block.' }];
        }

        case 'analyze-idea':
            return {
                noveltyScore: 70,
                marketExistence: { isExistent: true, details: 'Similar solutions may exist; refine the target user and differentiation.' },
                investorPitch: 'This idea can become compelling if it solves a painful, measurable problem for a narrow audience first.'
            };

        case 'check-originality':
            return { score: 65, verdict: 'Needs human review', analysis: 'Fallback estimate only. Use a configured model or plagiarism service for stronger evidence.', flags: ['AI service unavailable'] };

        case 'generate-mom':
            return { text: `### Minutes of Meeting\n\n**Title:** ${payload.title || 'Meeting'}\n\n**Key Notes:** ${payload.notes || 'No notes provided.'}\n\n**Action Items:**\n- Assign owners\n- Confirm deadlines\n- Share follow-up summary` };

        case 'detention-risk-analysis':
            return { text: `### Risk Analysis\n\nReviewed ${payload.metrics?.length || 0} records. Prioritize students with low CGPA, active backlogs, and low application activity. Schedule mentor follow-ups for high-risk groups.` };

        case 'query-summary':
            return { text: `### Query Summary\n\nGrouped ${payload.queries?.length || 0} open queries. Prioritize unresolved placement, profile correction, and deadline-related issues first.` };

        case 'generate-interview-report':
            return { text: `### Interview Report\n\nRole: ${payload.role || 'Target role'}\nCompany: ${payload.company || 'Target company'}\n\nImprove answer structure with STAR examples, quantify results, and prepare two role-specific projects.` };

        case 'search-opportunities':
            return { opportunities: [] };

        case 'opportunity-link-scraper': {
            const domain = (() => {
                try { return new URL(payload.url).hostname.replace(/^www\./, ''); } catch { return 'Unknown Company'; }
            })();
            const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            return {
                title: 'Imported Opportunity',
                company: domain,
                description: 'AI link scraping needs a configured hosted model. Please review and complete this draft manually.',
                min_cgpa: 0,
                deadline,
                pipeline: ['Registration', 'Assessment', 'Interview', 'Offer'],
                apply_link: payload.url
            };
        }

        case 'verify-milestone-proof':
            return { success: false, message: 'Vision verification requires a configured AI model. Please route this proof to manual review.' };

        case 'resume-match-analysis':
            return { matchScore: 68, missingSkills: ['role-specific keywords'], learningPath: 'Add quantified projects, align skills to the role, and include one relevant certification or portfolio link.' };

        case 'generate-idf':
        case 'structured-circular':
        case 'generate-research-paper':
        default:
            return { text: payload?.prompt || payload?.message || 'AI draft unavailable. Configure Supabase AI or Ollama to generate this content.' };
    }
};

export const runAI = async (params: AIRequestParams): Promise<any> => {
    const { task, payload, supabase } = params;
    const allowFallback = env.VITE_AI_ENABLE_FALLBACKS !== 'false';

    try {
        console.log(`[AI-CLIENT] Invoking task: ${task}`, payload);
        if (getProvider() === 'ollama') {
            return await invokeOllama(task, payload);
        }

        const { data, error } = await supabase.functions.invoke('ai-handler', {
            body: { task, payload },
        });

        if (error) throw error;
        if (data?.success === false || data?.error) {
            throw new Error(data.message || data.error || 'AI request failed.');
        }
        return data;
    } catch (e: any) {
        if (allowFallback) return fallback(task, payload, e);
        console.error(`[AI-CLIENT] Request failed:`, e);
        throw e;
    }
};
