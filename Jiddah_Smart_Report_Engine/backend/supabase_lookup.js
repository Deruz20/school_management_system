const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}
const supabase = createClient(url, key);
(async () => {
  const enrollmentId = '0cfd140e-b125-453f-bd3e-1cbad04fa906';
  const termId = '57e25e2c-ebd5-4bf2-9622-5ec4ec1d40bf';
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id,academic_year,theology_class_id,students(id,name,admission_number),circular_classes(id,class_name,section)')
    .eq('id', enrollmentId)
    .limit(1);
  console.log('enrollments', JSON.stringify(enrollments, null, 2));
  console.log('enrollError', JSON.stringify(enrollError, null, 2));
  const { data: terms, error: termError } = await supabase
    .from('academic_terms')
    .select('id,term,year')
    .eq('id', termId)
    .limit(1);
  console.log('terms', JSON.stringify(terms, null, 2));
  console.log('termError', JSON.stringify(termError, null, 2));
})();
