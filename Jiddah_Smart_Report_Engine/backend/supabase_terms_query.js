const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key);
(async () => {
  const { data, error } = await supabase.from('terms').select('*').limit(20);
  console.log('error', JSON.stringify(error, null, 2));
  console.log('data', JSON.stringify(data, null, 2));
})();
