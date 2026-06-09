ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS analyzed_max_age_days integer NOT NULL DEFAULT 7;

COMMENT ON COLUMN user_preferences.analyzed_max_age_days IS 'Max age (days) for analyzed news cards to appear in the visible stack: 3, 7, 14, or 30';
