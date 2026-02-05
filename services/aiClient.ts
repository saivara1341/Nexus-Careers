
// Removed direct GoogleGenAI import
// import { GoogleGenAI, Type } from "@google/genai";

interface AIRequestParams {
    task: string;
    payload: any;
    supabase: any; // Supabase client is now mandatory
}

// Removed cleanJson from here as it's now handled by the Edge Function directly.

export const runAI = async (params: AIRequestParams): Promise<any> => {
    const { task, payload, supabase } = params;

    try {
        console.log(`[AI-CLIENT] Invoking task: ${task}`, payload);
        const { data, error } = await supabase.functions.invoke('ai-handler', {
            body: { task, payload },
        });

        if (error) {
            console.error(`[AI-CLIENT] Edge Function invocation failed!`, {
                message: error.message,
                status: error.status,
                details: error
            });
            throw error;
        }

        console.log(`[AI-CLIENT] Task ${task} completed successfully:`, data);
        return data;

    } catch (e: any) {
        console.error(`[AI-CLIENT] Request failed:`, e);
        throw e;
    }
};
