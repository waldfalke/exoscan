# PowerShell script to run tests and capture output
Write-Host "Clearing Jest cache..."
npx jest --clearCache 2>&1 | Out-File -FilePath "cache-clear.txt"

Write-Host "Running Scanner tests..."

try {
    # Run Jest tests for Scanner components
    npx jest --testPathPatterns=Scanner --verbose --no-cache 2>&1 | Tee-Object -FilePath "test-results.txt"
    
    Write-Host "Test execution completed. Check test-results.txt for details."
} catch {
    Write-Host "Error running tests: $_"
    $_ | Out-File -FilePath "test-error.txt"
}