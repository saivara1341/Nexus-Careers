
-- Migration: Add is_whitelisted to student_registry
ALTER TABLE student_registry ADD COLUMN IF NOT EXISTS is_whitelisted BOOLEAN DEFAULT FALSE;

-- Update RLS if necessary (usually inherited, but good to be explicit for security audits)
COMMENT ON COLUMN student_registry.is_whitelisted IS 'Flag to mark students as academically verified for elite placement drives.';
