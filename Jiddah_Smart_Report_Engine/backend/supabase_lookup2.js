const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key);
(async () => {
  const termId = '57e25e2c-ebd5-4bf2-9622-5ec4ec1d40bf';
  const { data: termsA, error: errorA } = await supabase.from('academic_terms').select('*').eq('id', termId).limit(1);
  const { data: termsB, error: errorB } = await supabase.from('terms').select('*').eq('id', termId).limit(1);
  console.log('academic_terms', JSON.stringify(termsA, null, 2));
  console.log('errorA', JSON.stringify(errorA, null, 2));
  console.log('terms', JSON.stringify(termsB, null, 2));
  console.log('errorB', JSON.stringify(errorB, null, 2));
})();
