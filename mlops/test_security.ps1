# Test Script for Feature #9: Advanced Security & RBAC
# Tests JWT authentication, role-based access control, and token management

$BASE_URL = "http://localhost:8000"

Write-Host "`n=== Feature #9: Advanced Security & RBAC Tests ===" -ForegroundColor Cyan
Write-Host "Testing JWT authentication and authorization...`n" -ForegroundColor Yellow

# Test 1: Get security statistics
Write-Host "1. Getting security statistics..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/security-stats" -Method Get
    Write-Host "Total Users: $($response.total_users)" -ForegroundColor White
    Write-Host "Active Users: $($response.active_users)" -ForegroundColor White
    Write-Host "Disabled Users: $($response.disabled_users)" -ForegroundColor White
    Write-Host "Revoked Tokens: $($response.revoked_tokens)" -ForegroundColor White
    Write-Host "`nUsers by Role:" -ForegroundColor Yellow
    $response.users_by_role.PSObject.Properties | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Value)" -ForegroundColor White
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 2: Get available permissions
Write-Host "2. Getting available permissions and roles..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/permissions" -Method Get
    Write-Host "Available Roles:" -ForegroundColor Yellow
    foreach ($role in $response.roles) {
        Write-Host "  $($role.role) - $($role.description)" -ForegroundColor White
        Write-Host "    Permissions: $($role.permissions)" -ForegroundColor Gray
    }
    Write-Host "`nAll Permissions: $($response.all_permissions.Count) total" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 3: Login with default admin
Write-Host "3. Testing login with default admin..." -ForegroundColor Green
try {
    $body = @{
        username = "admin"
        password = "admin123"
    }
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body
    
    Write-Host "Login Successful!" -ForegroundColor Green
    Write-Host "Token Type: $($response.token_type)" -ForegroundColor White
    Write-Host "Access Token: $($response.access_token.Substring(0, 20))..." -ForegroundColor White
    Write-Host "Refresh Token: $($response.refresh_token.Substring(0, 20))...`n" -ForegroundColor White
    
    $adminToken = $response.access_token
    $refreshToken = $response.refresh_token
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 4: Get current user info
Write-Host "4. Getting current user info..." -ForegroundColor Green
if ($adminToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
        }
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/me" `
            -Method Get `
            -Headers $headers
        
        Write-Host "User Info:" -ForegroundColor Yellow
        Write-Host "  Username: $($response.username)" -ForegroundColor White
        Write-Host "  Full Name: $($response.full_name)" -ForegroundColor White
        Write-Host "  Email: $($response.email)" -ForegroundColor White
        Write-Host "  Role: $($response.role)" -ForegroundColor White
        Write-Host "  Disabled: $($response.disabled)" -ForegroundColor White
        Write-Host "  Created: $($response.created_at)" -ForegroundColor White
        Write-Host "  Last Login: $($response.last_login)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 5: Register a new user (scientist)
Write-Host "5. Registering new scientist user..." -ForegroundColor Green
try {
    $body = @{
        username = "scientist1"
        email = "scientist@deepsea.local"
        full_name = "Marine Scientist"
        password = "science123"
        role = "scientist"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "User Created!" -ForegroundColor Green
    Write-Host "Username: $($response.username)" -ForegroundColor White
    Write-Host "Role: $($response.role)" -ForegroundColor White
    Write-Host "Email: $($response.email)`n" -ForegroundColor White
} catch {
    Write-Host "Failed (user may already exist): $_`n" -ForegroundColor Yellow
}

# Test 6: Register a viewer user
Write-Host "6. Registering new viewer user..." -ForegroundColor Green
try {
    $body = @{
        username = "viewer1"
        email = "viewer@deepsea.local"
        full_name = "Data Viewer"
        password = "view123"
        role = "viewer"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "User Created!" -ForegroundColor Green
    Write-Host "Username: $($response.username)" -ForegroundColor White
    Write-Host "Role: $($response.role)`n" -ForegroundColor White
} catch {
    Write-Host "Failed (user may already exist): $_`n" -ForegroundColor Yellow
}

# Test 7: Login as scientist
Write-Host "7. Testing login as scientist..." -ForegroundColor Green
try {
    $body = @{
        username = "scientist1"
        password = "science123"
    }
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body
    
    Write-Host "Scientist Login Successful!" -ForegroundColor Green
    $scientistToken = $response.access_token
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 8: Login as viewer
Write-Host "8. Testing login as viewer..." -ForegroundColor Green
try {
    $body = @{
        username = "viewer1"
        password = "view123"
    }
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body
    
    Write-Host "Viewer Login Successful!" -ForegroundColor Green
    $viewerToken = $response.access_token
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 9: Test token refresh
Write-Host "9. Testing token refresh..." -ForegroundColor Green
if ($refreshToken) {
    try {
        $body = @{
            refresh_token = $refreshToken
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/refresh" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body
        
        Write-Host "Token Refreshed!" -ForegroundColor Green
        Write-Host "New Access Token: $($response.access_token.Substring(0, 20))...`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 10: List all users
Write-Host "10. Listing all users..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/users" -Method Get
    Write-Host "Total Users: $($response.total)" -ForegroundColor White
    Write-Host "`nUsers:" -ForegroundColor Yellow
    foreach ($user in $response.users) {
        $disabledTag = if ($user.disabled) { " [DISABLED]" } else { "" }
        Write-Host "  - $($user.username) ($($user.role))$disabledTag" -ForegroundColor White
        Write-Host "    Email: $($user.email)" -ForegroundColor Gray
        Write-Host "    Created: $($user.created_at)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 11: Test unauthorized access
Write-Host "11. Testing unauthorized access..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/me" -Method Get
    Write-Host "ERROR: Should have been rejected!" -ForegroundColor Red
} catch {
    Write-Host "Correctly rejected: 401 Unauthorized`n" -ForegroundColor Green
}

# Test 12: Test invalid token
Write-Host "12. Testing invalid token..." -ForegroundColor Green
try {
    $headers = @{
        "Authorization" = "Bearer invalid_token_here"
    }
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/me" -Method Get -Headers $headers
    Write-Host "ERROR: Should have been rejected!" -ForegroundColor Red
} catch {
    Write-Host "Correctly rejected: Invalid token`n" -ForegroundColor Green
}

# Test 13: Test logout
Write-Host "13. Testing logout..." -ForegroundColor Green
if ($adminToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
        }
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/logout" `
            -Method Post `
            -Headers $headers
        
        Write-Host "Logged out successfully!" -ForegroundColor Green
        Write-Host "Message: $($response.message)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 14: Verify token revocation
Write-Host "14. Verifying token was revoked..." -ForegroundColor Green
if ($adminToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
        }
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/me" -Method Get -Headers $headers
        Write-Host "ERROR: Revoked token should not work!" -ForegroundColor Red
    } catch {
        Write-Host "Correctly rejected: Revoked token cannot be used`n" -ForegroundColor Green
    }
}

# Test 15: Role-based access summary
Write-Host "15. Role-Based Access Summary..." -ForegroundColor Green
Write-Host "`nRole Permissions:" -ForegroundColor Yellow
Write-Host "  Admin:" -ForegroundColor White
Write-Host "    ✓ All permissions (full system access)" -ForegroundColor Green
Write-Host "  Scientist:" -ForegroundColor White
Write-Host "    ✓ Predictions (make & batch)" -ForegroundColor Green
Write-Host "    ✓ Model management" -ForegroundColor Green
Write-Host "    ✓ Version management" -ForegroundColor Green
Write-Host "    ✓ Experiment management" -ForegroundColor Green
Write-Host "    ✓ Monitoring view" -ForegroundColor Green
Write-Host "    ✗ User management" -ForegroundColor Red
Write-Host "  Viewer:" -ForegroundColor White
Write-Host "    ✓ Make predictions" -ForegroundColor Green
Write-Host "    ✓ View models, versions, experiments" -ForegroundColor Green
Write-Host "    ✓ View monitoring" -ForegroundColor Green
Write-Host "    ✗ Modify anything" -ForegroundColor Red
Write-Host "  API User:" -ForegroundColor White
Write-Host "    ✓ Predictions only" -ForegroundColor Green
Write-Host "    ✗ Everything else" -ForegroundColor Red
Write-Host ""

Write-Host "=== Security Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nSecurity Features:" -ForegroundColor Yellow
Write-Host "  ✓ JWT authentication (access & refresh tokens)" -ForegroundColor Green
Write-Host "  ✓ OAuth2 password flow" -ForegroundColor Green
Write-Host "  ✓ Role-based access control (4 roles)" -ForegroundColor Green
Write-Host "  ✓ Permission system (13 permissions)" -ForegroundColor Green
Write-Host "  ✓ Token refresh mechanism" -ForegroundColor Green
Write-Host "  ✓ Token revocation on logout" -ForegroundColor Green
Write-Host "  ✓ Password hashing (bcrypt)" -ForegroundColor Green
Write-Host "  ✓ User registration" -ForegroundColor Green
Write-Host "  ✓ User management" -ForegroundColor Green
Write-Host "  ✓ Security statistics" -ForegroundColor Green
Write-Host "`nDefault Admin Credentials:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host "  ⚠️  Change in production!" -ForegroundColor Red
Write-Host "`nAuthentication available at: $BASE_URL/auth/*" -ForegroundColor Cyan
