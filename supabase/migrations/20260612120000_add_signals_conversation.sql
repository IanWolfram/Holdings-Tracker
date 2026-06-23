-- Dedicated per-user conversation that holds agent-generated signal messages.
-- emitSignals() (lib/agent/signals.ts) finds-or-creates this conversation and
-- appends an assistant message for each strong directional signal, so the user
-- can read it in the normal chat thread on /agent. Nullable: populated lazily on
-- the first signal for a user.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS signals_conversation_id uuid;

COMMENT ON COLUMN public.user_preferences.signals_conversation_id IS
  'Conversation id holding agent signal messages (find-or-create target for emitSignals).';
