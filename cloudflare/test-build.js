// Simple test to check if the project builds
const fs = require('fs');
const path = require('path');

console.log('Testing Cloudflare Workers project structure...');

// Check if main files exist
const requiredFiles = [
  'src/index.ts',
  'wrangler.toml',
  'package.json',
  'tsconfig.json'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('🎉 All required files are present!');
  console.log('📝 Project structure looks good for Cloudflare Workers');
} else {
  console.log('⚠️  Some files are missing');
  process.exit(1);
}

// Check TypeScript compilation
console.log('\n🔍 Checking TypeScript compilation...');
try {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  process.exit(1);
}