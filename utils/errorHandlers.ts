import toast from 'react-hot-toast';

const recentErrorToasts = new Map<string, number>();
const ERROR_TOAST_DEDUP_MS = 6000;

/**
 * Centralized function to handle AI and Supabase invocation errors.
 */
export const handleAiInvocationError = (error: any, options?: { showToast?: boolean }): string => {
    const shouldToast = options?.showToast ?? true;
    let extractedMessage = 'An unexpected error occurred.';

    // Deep parsing for nested error structures
    if (typeof error === 'string') {
        extractedMessage = error;
    } else if (error?.data?.error?.message) {
        extractedMessage = error.data.error.message;
    } else if (error?.error?.message) {
        extractedMessage = error.error.message;
    } else if (error?.message) {
        extractedMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
        try {
            extractedMessage = JSON.stringify(error, null, 2);
        } catch (e) {
            extractedMessage = String(error);
        }
    }

    // Handle specific Supabase schema errors
    if (extractedMessage.includes('idea_submissions')) {
        extractedMessage = "Launchpad Database Table Missing: Please contact the system developer to initialize the 'idea_submissions' schema.";
    }

    // Handle API key / model provider specific error messages
    if (extractedMessage.includes("API Key Error") || extractedMessage.includes("Requested entity was not found.")) {
        extractedMessage = `AI configuration error: check your selected provider, model name, and API key. For local open-source mode, run Ollama and set VITE_AI_PROVIDER=ollama.`;
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            window.aistudio.openSelectKey().catch(e => console.error("Failed to open selector", e));
        }
    }

    // Handle Edge Function connectivity issues
    if (extractedMessage.includes("Failed to send a request to the Edge Function")) {
        extractedMessage = "AI backend connectivity error: deploy the Supabase 'ai-handler' function, run local Supabase functions, or switch to local Ollama with VITE_AI_PROVIDER=ollama.";
    }

    if (shouldToast) {
        const now = Date.now();
        const lastShownAt = recentErrorToasts.get(extractedMessage) || 0;
        if (now - lastShownAt > ERROR_TOAST_DEDUP_MS) {
            recentErrorToasts.set(extractedMessage, now);
            toast.error(extractedMessage, { id: `error-${extractedMessage.slice(0, 80)}`, duration: 6000 });
        }
    }

    return extractedMessage;
};
