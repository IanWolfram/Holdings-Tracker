ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS default_timescale VARCHAR(4) DEFAULT '6M';

COMMENT ON COLUMN user_preferences.default_timescale IS 'Default graph timescale: 1M, 2M, 3M, 4M, 5M, 6M, 1Y, or 2Y';
