import toast from 'react-hot-toast';

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

    // Handle API key specific error messages
    if (extractedMessage.includes("API Key Error") || extractedMessage.includes("Requested entity was not found.")) {
        extractedMessage = `AI Key Error: Your Google Gemini API key is invalid or not selected. Please re-select it using the selector.`;
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            window.aistudio.openSelectKey().catch(e => console.error("Failed to open selector", e));
        }
    }

    // Handle Edge Function connectivity issues
    if (extractedMessage.includes("Failed to send a request to the Edge Function")) {
        extractedMessage = "Edge Function Connectivity Error: The frontend could not reach the AI backend. Ensure you have deployed the 'ai-handler' function using 'supabase functions deploy ai-handler' or that your local 'supabase functions serve' is running and accessible.";
    }

    if (shouldToast) {
        toast.error(extractedMessage, { duration: 6000 });
    }

    return extractedMessage;
};