$ErrorActionPreference = "Stop"
$env:NODE_OPTIONS="--max-old-space-size=4096"

Write-Host "Running TSC..."
npx tsc --noEmit

Write-Host "Running Lint..."
npm run lint

Write-Host "Running Unit Tests..."
npm run test -- --pool=forks --no-file-parallelism --maxWorkers=1

Write-Host "Running Build..."
npm run build

Write-Host "Checking Prisma Migrations..."
npx prisma migrate status

Write-Host "Seeding DB..."
npx prisma db seed

Write-Host "Running Playwright..."
npx playwright test --workers=1

Write-Host "ALL VERIFICATION STEPS COMPLETED SUCCESSFULLY."
