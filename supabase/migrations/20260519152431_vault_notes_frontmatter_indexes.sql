CREATE INDEX IF NOT EXISTS vault_notes_user_url_idx
  ON public.vault_notes (user_id, ((frontmatter->>'url')));

CREATE INDEX IF NOT EXISTS vault_notes_user_ticker_date_idx
  ON public.vault_notes (
    user_id,
    ((frontmatter->>'ticker')),
    ((frontmatter->>'date')) DESC
  );
