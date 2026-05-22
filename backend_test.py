#!/usr/bin/env python3
"""
Quick smoke test for env-var refactor validation.
Tests only the 5 specific endpoints requested.
"""
import requests
import sys
import os

# Get backend URL from environment
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://job-builder-6.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@culinaryeditorial.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@culinaryeditorial.com"
DEMO_PASSWORD = "Demo123!"

def test_admin_auth():
    """Test 1: Admin login + /me endpoint"""
    print("\n[TEST 1] Admin Authentication")
    print(f"  POST {API_BASE}/auth/login (admin)")
    
    # Login
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"  ❌ FAILED: Login returned {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        return False
    
    print(f"  ✅ Login successful (200)")
    
    # Extract session cookie
    cookies = response.cookies
    
    # Test /me endpoint
    print(f"  GET {API_BASE}/auth/me")
    me_response = requests.get(
        f"{API_BASE}/auth/me",
        cookies=cookies,
        timeout=10
    )
    
    if me_response.status_code != 200:
        print(f"  ❌ FAILED: /me returned {me_response.status_code}")
        print(f"     Response: {me_response.text[:200]}")
        return False
    
    print(f"  ✅ /me successful (200)")
    return True

def test_demo_auth():
    """Test 2: Demo login + /me endpoint"""
    print("\n[TEST 2] Demo Authentication")
    print(f"  POST {API_BASE}/auth/login (demo)")
    
    # Login
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"  ❌ FAILED: Login returned {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        return False
    
    print(f"  ✅ Login successful (200)")
    
    # Extract session cookie
    cookies = response.cookies
    
    # Test /me endpoint
    print(f"  GET {API_BASE}/auth/me")
    me_response = requests.get(
        f"{API_BASE}/auth/me",
        cookies=cookies,
        timeout=10
    )
    
    if me_response.status_code != 200:
        print(f"  ❌ FAILED: /me returned {me_response.status_code}")
        print(f"     Response: {me_response.text[:200]}")
        return False
    
    print(f"  ✅ /me successful (200)")
    return True

def test_storefront_settings():
    """Test 3: GET /api/storefront/settings"""
    print("\n[TEST 3] Storefront Settings")
    print(f"  GET {API_BASE}/storefront/settings")
    
    response = requests.get(
        f"{API_BASE}/storefront/settings",
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"  ❌ FAILED: Returned {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        return False
    
    print(f"  ✅ Successful (200)")
    return True

def test_kds_board():
    """Test 4: GET /api/admin/kds/board with admin auth"""
    print("\n[TEST 4] KDS Board (Admin)")
    
    # Login as admin first
    login_response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    
    if login_response.status_code != 200:
        print(f"  ❌ FAILED: Admin login failed ({login_response.status_code})")
        return False
    
    cookies = login_response.cookies
    
    print(f"  GET {API_BASE}/admin/kds/board")
    response = requests.get(
        f"{API_BASE}/admin/kds/board",
        cookies=cookies,
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"  ❌ FAILED: Returned {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        return False
    
    print(f"  ✅ Successful (200)")
    return True

def test_analytics_summary():
    """Test 5: GET /api/admin/analytics/summary?days=7 with admin auth"""
    print("\n[TEST 5] Analytics Summary (Admin)")
    
    # Login as admin first
    login_response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10
    )
    
    if login_response.status_code != 200:
        print(f"  ❌ FAILED: Admin login failed ({login_response.status_code})")
        return False
    
    cookies = login_response.cookies
    
    print(f"  GET {API_BASE}/admin/analytics/summary?days=7")
    response = requests.get(
        f"{API_BASE}/admin/analytics/summary",
        params={"days": 7},
        cookies=cookies,
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"  ❌ FAILED: Returned {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        return False
    
    print(f"  ✅ Successful (200)")
    return True

def main():
    print("=" * 60)
    print("SMOKE TEST: Env-Var Refactor Validation")
    print("=" * 60)
    print(f"Backend: {API_BASE}")
    
    results = []
    
    # Run all 5 tests
    results.append(("Admin Auth", test_admin_auth()))
    results.append(("Demo Auth", test_demo_auth()))
    results.append(("Storefront Settings", test_storefront_settings()))
    results.append(("KDS Board", test_kds_board()))
    results.append(("Analytics Summary", test_analytics_summary()))
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ All smoke tests passed!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
