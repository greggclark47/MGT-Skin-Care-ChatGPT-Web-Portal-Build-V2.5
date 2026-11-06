const VENDOR_PATTERN=/gemini|sonnet|ollama|openai|deepseek|langchain|supabase|revenuecat|stripe|gpt-[0-9]|anthropic|claude/i;

// The static operator demo intentionally discloses these exact, non-secret launch proposals.
// Keep the exception copy-bound and file-bound: any changed, duplicated, or additional vendor
// reference remains visible to the scanner and blocks the release evidence.
const REVIEWED_PUBLIC_DISCLOSURES={
 'dist/index.html':[
  '<strong>DeepSeek</strong>',
  '<small>Local via Ollama · qualification pending</small>',
  'Stripe setup, tier entitlements, terms and signed event verification remain in preparation.',
  'Stripe is the planned payment gateway.'
 ]
};

function scanPublicArtifact(relativePath,source){
 let sanitized=String(source),invalidDisclosure=false;
 const normalized=String(relativePath).replaceAll('\\','/');
 for(const disclosure of REVIEWED_PUBLIC_DISCLOSURES[normalized]||[]){
  const first=sanitized.indexOf(disclosure);
  if(first<0)continue;
  if(sanitized.indexOf(disclosure,first+disclosure.length)>=0)invalidDisclosure=true;
  sanitized=sanitized.slice(0,first)+sanitized.slice(first+disclosure.length);
 }
 return{blocked:invalidDisclosure||VENDOR_PATTERN.test(sanitized),invalidDisclosure};
}

module.exports={scanPublicArtifact};
