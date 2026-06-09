const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('app_secrets')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Error fetching secret:', error.message);
  } else {
    console.log('Found secret:', data);
  }
}
run();
