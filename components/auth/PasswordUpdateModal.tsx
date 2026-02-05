
import React, { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import toast from 'react-hot-toast';

interface PasswordUpdateModalProps {
    onClose: () => void;
}

export const PasswordUpdateModal: React.FC<PasswordUpdateModalProps> = ({ onClose }) => {
    const supabase = useSupabase();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast.success("Password updated successfully!");
            onClose();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Set New Password">
            <form onSubmit={handleUpdate} className="space-y-4">
                <p className="text-text-muted">Please enter your new password below.</p>
                <Input 
                    type="password" 
                    label="New Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                />
                <Input 
                    type="password" 
                    label="Confirm New Password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                />
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Spinner /> : 'Update Password'}
                </Button>
            </form>
        </Modal>
    );
};
