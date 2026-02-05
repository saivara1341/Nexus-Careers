
import React, { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import toast from 'react-hot-toast';
import type { AdminProfile, StudentProfile, CompanyProfile } from '../../types.ts';

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: AdminProfile | StudentProfile | CompanyProfile;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose, user }) => {
    const supabase = useSupabase();
    const [description, setDescription] = useState('');
    const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            toast.error("Please describe the issue.");
            return;
        }

        setIsSubmitting(true);
        try {
            let screenshotUrl = null;

            // 1. Upload Screenshot if exists
            if (screenshotFile) {
                const fileName = `${user.id}/${Date.now()}_${screenshotFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('support-attachments')
                    .upload(fileName, screenshotFile);

                if (uploadError) throw uploadError;
                
                const { data: urlData } = supabase.storage
                    .from('support-attachments')
                    .getPublicUrl(fileName);
                
                screenshotUrl = urlData.publicUrl;
            }

            // 2. Insert Record
            const { error: insertError } = await supabase.from('platform_issues').insert({
                reporter_id: user.id,
                reporter_name: user.name,
                reporter_role: user.role,
                description: description,
                occurred_at: new Date(occurredAt).toISOString(),
                screenshot_url: screenshotUrl,
                status: 'Open'
            });

            if (insertError) throw insertError;

            toast.success("Issue reported successfully. Thank you for your feedback!");
            setDescription('');
            setScreenshotFile(null);
            onClose();

        } catch (error: any) {
            console.error("Report Error:", error);
            toast.error(`Failed to submit report: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Report an Issue">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                    <p className="text-sm text-text-muted">
                        Encountered a bug or issue? Let us know. Your feedback helps us improve Nexus.
                    </p>
                </div>

                <div>
                    <label className="block text-primary font-display text-sm mb-2">Description</label>
                    <textarea 
                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 h-32 focus:outline-none focus:ring-2 focus:ring-primary text-text-base resize-none"
                        placeholder="Describe the issue in detail. What were you trying to do?"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label="When did it happen?" 
                        type="datetime-local" 
                        value={occurredAt} 
                        onChange={e => setOccurredAt(e.target.value)} 
                        required 
                    />
                    <Input 
                        label="Screenshot (Optional)" 
                        type="file" 
                        accept="image/*" 
                        onChange={e => setScreenshotFile(e.target.files?.[0] || null)} 
                    />
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Spinner /> : 'Submit Report'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
