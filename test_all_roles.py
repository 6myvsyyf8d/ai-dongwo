"""Test all roles: parent, teacher, caregiver, volunteer, youth, government"""
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:9090'
ROLES = [
    ('小明爸爸', 'parent', '.quick-login-item:has(.quick-login-name:text-is("小明爸爸"))'),
    ('王老师', 'teacher', '.quick-login-item:has(.quick-login-name:text-is("王老师"))'),
    ('小明保姆', 'caregiver', '.quick-login-item:has(.quick-login-name:text-is("小明保姆"))'),
    ('志愿者小李', 'volunteer', '.quick-login-item:has(.quick-login-name:text-is("志愿者小李"))'),
    ('小明', 'youth', '.quick-login-item:has(.quick-login-name:text-is("小明"))'),
    ('政府观察员', 'government', '.quick-login-item:has(.quick-login-name:text-is("政府观察员"))'),
]

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    for name, role, selector in ROLES:
        print(f"\n=== Testing: {name} ({role}) ===")
        # Use fresh context for each role to isolate localStorage
        context = browser.new_context(viewport={'width': 430, 'height': 932})
        page = context.new_page()
        errors = []
        
        try:
            # Clear localStorage and go to login
            page.goto(BASE, wait_until='networkidle')
            page.evaluate('localStorage.clear()')
            page.goto(BASE, wait_until='networkidle')
            page.wait_for_timeout(1500)
            
            # 2. Use quick login
            quick_item = page.locator(selector)
            if quick_item.count() > 0:
                quick_item.first.click()
                page.wait_for_timeout(3000)
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(500)
            else:
                # Check if we're already logged in (redirected from login)
                current_url = page.url
                if 'login' not in current_url and '#' not in current_url.split('/')[-1]:
                    # Might be on dashboard already
                    pass
                else:
                    errors.append(f"Quick login item not found for {name}")
                    page.screenshot(path=f'/tmp/test_{role}_login_error.png')
                    results.append((role, name, 'FAIL', errors))
                    page.close()
                    context.close()
                    continue
            
            # 3. Take screenshot
            page.screenshot(path=f'/tmp/test_{role}_dashboard.png', full_page=True)
            print(f"  Dashboard screenshot saved")
            
            # 4. Check bottom nav (government page has no bottom nav by design)
            if role == 'government':
                # Government page should show stats, not bottom nav
                gov_content = page.locator('.gov-stats, .stats-grid, .stat-card').first
                if gov_content.count() > 0:
                    print(f"  Government stats: OK")
                else:
                    # Check for any government content
                    page_text = page.inner_text('body')
                    if '数据统计' in page_text or '心青年' in page_text:
                        print(f"  Government page content: OK")
                    else:
                        errors.append("Government page content missing")
                        print(f"  Government page: NO CONTENT")
            else:
                bottom_nav = page.locator('.bottom-nav')
                if bottom_nav.count() > 0:
                    print(f"  Bottom nav: OK")
                else:
                    errors.append("Bottom nav missing")
                    print(f"  Bottom nav: MISSING")
            
            # 5. Navigate to profile directly via URL (more reliable than clicking cards)
            if role != 'government':
                # Get youthId from any element with data-youth-id
                youth_id = page.locator('[data-youth-id]').first.get_attribute('data-youth-id')
                if not youth_id:
                    youth_id = page.evaluate('() => { var el = document.querySelector("[data-youth-id]"); return el ? el.getAttribute("data-youth-id") : null; }')
                
                if youth_id:
                    page.goto(f'{BASE}/#profile?youthId={youth_id}', wait_until='networkidle')
                else:
                    # Fallback: try clicking
                    youth_link = page.locator('.youth-card, .safety-card, .ios-card-row[data-youth-id], a[href*="profile"]').first
                    if youth_link.count() > 0:
                        youth_link.click()
                    else:
                        try:
                            page.locator('text=小明').first.click()
                        except:
                            pass
                
                page.wait_for_timeout(2000)
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(500)
                
                page.screenshot(path=f'/tmp/test_{role}_profile.png', full_page=True)
                print(f"  Profile screenshot saved")
                
                # 6. Check module tabs
                module_tabs = page.locator('.module-tab')
                tab_count = module_tabs.count()
                tab_labels = []
                if tab_count > 0:
                    for i in range(tab_count):
                        try:
                            label_el = module_tabs.nth(i).locator('.module-tab-label')
                            if label_el.count() > 0:
                                label = label_el.inner_text()
                                tab_labels.append(label)
                        except:
                            pass
                print(f"  Module tabs ({tab_count}): {tab_labels}")
                
                # 7. Check careMedical dailyRoutine
                care_tab = page.locator('.module-tab:has-text("医疗")')
                if care_tab.count() > 0:
                    care_tab.first.click()
                    page.wait_for_timeout(500)
                    try:
                        care_content = page.locator('.module-section.active').inner_text()
                        if '作息' in care_content or '起床' in care_content or '睡觉' in care_content:
                            print(f"  careMedical dailyRoutine: OK")
                        else:
                            print(f"  careMedical dailyRoutine: not found")
                    except:
                        print(f"  careMedical dailyRoutine: error reading")
                
                # 8. Check workSupport life preferences
                work_tab = page.locator('.module-tab:has-text("工作")')
                if work_tab.count() > 0:
                    work_tab.first.click()
                    page.wait_for_timeout(500)
                    try:
                        work_content = page.locator('.module-section.active').inner_text()
                        if '喜欢的活动' in work_content or '想去的地方' in work_content:
                            print(f"  workSupport lifePreferences: OK")
                        else:
                            print(f"  workSupport lifePreferences: not found")
                    except:
                        print(f"  workSupport lifePreferences: error reading")
            
            if errors:
                print(f"  ERRORS: {errors}")
                results.append((role, name, 'FAIL', errors))
            else:
                print(f"  Result: PASS")
                results.append((role, name, 'PASS', []))
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"  ERROR: {e}")
            try:
                page.screenshot(path=f'/tmp/test_{role}_error.png', full_page=True)
            except:
                pass
            results.append((role, name, 'ERROR', [str(e)]))
        
        page.close()
        context.close()
    
    browser.close()

print("\n\n=== SUMMARY ===")
for role, name, status, errors in results:
    emoji = '\u2705' if status == 'PASS' else '\u274c'
    print(f"{emoji} {name} ({role}): {status}")
    if errors:
        for e in errors:
            print(f"   - {e}")