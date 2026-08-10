-- Disable shared public tryout code; prefer invite_emails / one-time codes.
UPDATE public.invite_codes
SET active = false,
    note = 'Disabled — prefer invite_emails / one-time codes'
WHERE upper(code) = 'TRY-PAPERVIEW';
