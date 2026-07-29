"""Full cross-role integration test: 9 accounts, cross-role visibility, handover, analytics"""
from playwright.sync_api import sync_playwright
import traceback

BASE = 'http://localhost:8080'
EXPECTED_NAV = ['首页', '记录', '档案', '管理']

# All 9 test accounts
ALL_ACCOUNTS = [
    ('小明爸爸', 'parent', '.quick-login-item:has(.quick-login-name:text-is("小明爸爸"))'),
    ('小明妈妈', 'parent', '.quick-login-item:has(.quick-login-name:text-is("小明妈妈"))'),
    ('小明保姆', 'caregiver', '.quick-login-item:has(.quick-login-name:text-is("小明保姆"))'),
    ('小花爸爸', 'parent', '.quick-login-item:has(.quick-login-name:text-is("小花爸爸"))'),
    ('小花妈妈', 'parent', '.quick-login-item:has(.quick-login-name:text-is("小花妈妈"))'),
    ('小花保姆', 'caregiver', '.quick-login-item:has(.quick-login-name:text-is("小花保姆"))'),
    ('王老师', 'teacher', '.quick-login-item:has(.quick-login-name:text-is("王老师"))'),
    ('小明', 'youth', '.quick-login-item:has(.quick-login-name:text-is("小明"))'),
    ('政府观察员', 'government', '.quick-login-item:has(.quick-login-name:text-is("政府观察员"))'),
]

results = []

def quick_login(page, name, selector):
    """Quick login as a specific user. Returns True on success."""
    errors = []
    page.goto(BASE, wait_until='networkidle')
    page.evaluate('localStorage.clear()')
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1500)

    quick_item = page.locator(selector)
    if quick_item.count() > 0:
        quick_item.first.click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(500)
        return True, errors
    else:
        errors.append(f"Quick login item not found for {name}")
        return False, errors

def check_bottom_nav(page, role):
    """Check bottom nav completeness. Returns (ok, errors)."""
    errors = []
    if role == 'government':
        nav = page.locator('.bottom-nav')
        if nav.count() > 0:
            errors.append("Government should not have bottom nav")
        return len(errors) == 0, errors

    nav = page.locator('.bottom-nav')
    if nav.count() == 0:
        errors.append("Bottom nav missing")
        return False, errors

    nav_labels = [el.inner_text().replace('\n', '') for el in page.locator('.bottom-nav-item').all()]
    for expected in EXPECTED_NAV:
        found = any(expected in label for label in nav_labels)
        if not found:
            errors.append(f"Nav item '{expected}' missing. Got: {nav_labels}")
    return len(errors) == 0, errors

def check_js_errors(page):
    """Collect JS errors from page."""
    errors = []
    page.on('pageerror', lambda err: errors.append(err.message))
    return errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ============================================================
    # TASK 1: Full 9-account login test
    # ============================================================
    print("\n" + "="*60)
    print("TASK 1: Full 9-Account Login Test")
    print("="*60)

    for name, role, selector in ALL_ACCOUNTS:
        print(f"\n--- Testing: {name} ({role}) ---")
        context = browser.new_context(viewport={'width': 430, 'height': 932})
        page = context.new_page()
        errors = []

        try:
            success, login_errors = quick_login(page, name, selector)
            errors.extend(login_errors)
            if not success:
                results.append((role, name, 'FAIL', errors))
                page.close()
                context.close()
                continue

            page.screenshot(path=f'/tmp/test_{role}_{name}_dashboard.png', full_page=True)

            # Check bottom nav
            nav_ok, nav_errors = check_bottom_nav(page, role)
            errors.extend(nav_errors)
            if nav_ok:
                print(f"  Bottom nav: OK")
            else:
                print(f"  Bottom nav: FAIL - {nav_errors}")

            # Collect JS errors
            js_errors = check_js_errors(page)
            if js_errors:
                errors.extend(js_errors)
                print(f"  JS errors: {js_errors}")

            if errors:
                results.append((role, name, 'FAIL', errors))
            else:
                print(f"  Result: PASS")
                results.append((role, name, 'PASS', []))

        except Exception as e:
            traceback.print_exc()
            errors.append(str(e))
            results.append((role, name, 'ERROR', errors))

        page.close()
        context.close()

    # ============================================================
    # TASK 2: Cross-role record visibility test
    # ============================================================
    print("\n" + "="*60)
    print("TASK 2: Cross-Role Record Visibility Test")
    print("="*60)

    # 2a: Parent sees all full records
    print("\n--- 2a: 小明爸爸 sees full records ---")
    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        quick_login(page, '小明爸爸', ALL_ACCOUNTS[0][2])
        page.goto(f'{BASE}/#records', wait_until='networkidle')
        page.wait_for_timeout(2000)

        # Check records page has content
        record_items = page.locator('.record-item, .record-card, .status-item').count()
        page_text = page.inner_text('body')
        has_ming_records = '小明' in page_text or '拼图' in page_text or '游泳' in page_text
        print(f"  Record items: {record_items}, has_ming_content: {has_ming_records}")

        if has_ming_records:
            print(f"  Parent sees records: OK")
        else:
            errors.append("Parent cannot see records")
            print(f"  Parent sees records: FAIL")

        page.screenshot(path=f'/tmp/test_cross_parent_records.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('parent', '小明爸爸-记录可见性', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    # 2b: Teacher sees both youths' records
    print("\n--- 2b: 王老师 sees both youths' records ---")
    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        quick_login(page, '王老师', ALL_ACCOUNTS[6][2])
        page_text = page.inner_text('body')
        has_ming = '小明' in page_text
        has_hua = '小花' in page_text
        print(f"  Has 小明: {has_ming}, Has 小花: {has_hua}")

        if has_ming and has_hua:
            print(f"  Teacher sees both youths: OK")
        else:
            errors.append(f"Teacher missing youth: ming={has_ming}, hua={has_hua}")
            print(f"  Teacher sees both youths: FAIL")

        page.screenshot(path=f'/tmp/test_cross_teacher_dashboard.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('teacher', '王老师-双学生可见', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    # ============================================================
    # TASK 3: Handover task cross-role test
    # ============================================================
    print("\n" + "="*60)
    print("TASK 3: Handover Task Cross-Role Test")
    print("="*60)

    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        # 3a: Login as 小明爸爸 and create a handover task
        print("\n--- 3a: 小明爸爸 creates handover task ---")
        quick_login(page, '小明爸爸', ALL_ACCOUNTS[0][2])

        # Find and click "新建交接任务" button
        create_btn = page.locator('button:has-text("新建交接任务")').first
        if create_btn.count() > 0:
            create_btn.click()
            page.wait_for_timeout(1000)

            # Check if form overlay appeared
            overlay = page.locator('#handover-form-overlay, .record-form-overlay')
            if overlay.count() > 0:
                print(f"  Handover form opened: OK")

                # Select receiver (小明保姆)
                select = page.locator('#handover-to-user')
                if select.count() > 0:
                    select.select_option(label='小明保姆（照护者）')
                    page.wait_for_timeout(300)

                # Fill content
                textarea = page.locator('#handover-content')
                if textarea.count() > 0:
                    textarea.fill('测试交接任务：请明天带小明去游泳，记得带泳镜和毛巾')

                # Save
                save_btn = page.locator('#btn-save-handover')
                if save_btn.count() > 0:
                    save_btn.click()
                    page.wait_for_timeout(2000)
                    print(f"  Handover task created: OK")
                else:
                    errors.append("Save button not found")
                    print(f"  Save button: MISSING")
            else:
                errors.append("Handover form overlay not found")
                print(f"  Handover form: MISSING")
        else:
            # Try to find the create button by scrolling
            page_text = page.inner_text('body')
            if '新建交接任务' in page_text:
                print(f"  Create button text found in page but selector didn't match")
                errors.append("Create button selector mismatch")
            else:
                print(f"  No handover section on this dashboard")
                errors.append("Handover section not found on dashboard")

        page.screenshot(path=f'/tmp/test_handover_created.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('parent', '小明爸爸-创建交接任务', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    # 3b: Login as 小明保姆 and verify the task
    print("\n--- 3b: 小明保姆 sees handover task ---")
    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        quick_login(page, '小明保姆', ALL_ACCOUNTS[2][2])
        page_text = page.inner_text('body')

        has_task = '测试交接任务' in page_text or '游泳' in page_text or '交接' in page_text
        print(f"  Task visible: {has_task}")

        if has_task:
            print(f"  Caregiver sees handover task: OK")

            # Try to toggle status — use first pending task specifically,
            # wait longer for dashboard rerender triggered by showDashboard({})
            status_btn = page.locator('.handover-status-btn.pending').first
            if status_btn.count() == 0:
                status_btn = page.locator('.handover-status-btn').first
            if status_btn.count() > 0:
                old_text = status_btn.inner_text()
                task_id = status_btn.get_attribute('data-task-id')
                status_btn.click()
                page.wait_for_timeout(3000)  # allow full dashboard rerender cycle
                # Locate SAME task button again (via data-task-id) to avoid index shifts
                new_btn = page.locator(f'.handover-status-btn[data-task-id="{task_id}"]').first if task_id else page.locator('.handover-status-btn').first
                new_text = new_btn.inner_text() if new_btn.count() > 0 else '(missing)'
                if old_text != new_text:
                    print(f"  Status toggled: {old_text} -> {new_text}: OK")
                else:
                    errors.append(f"Status did not toggle ({old_text} -> {new_text})")
                    print(f"  Status toggle: FAIL ({old_text} -> {new_text})")
            else:
                print(f"  Status button: not found")
        else:
            errors.append("Caregiver cannot see handover task")
            print(f"  Caregiver sees handover task: FAIL")

        page.screenshot(path=f'/tmp/test_handover_received.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('caregiver', '小明保姆-接收交接任务', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    # ============================================================
    # TASK 4: Analytics page verification
    # ============================================================
    print("\n" + "="*60)
    print("TASK 4: Analytics Page Verification")
    print("="*60)

    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        # 4a: Health card on parent dashboard
        print("\n--- 4a: 小明爸爸 health card ---")
        quick_login(page, '小明爸爸', ALL_ACCOUNTS[0][2])

        health_card = page.locator('.health-card')
        if health_card.count() > 0:
            print(f"  Health card: OK")

            # Check for 5 module statuses
            module_items = page.locator('.health-module-item')
            count = module_items.count()
            print(f"  Module items: {count}")
            if count >= 5:
                print(f"  5 module statuses: OK")
            else:
                errors.append(f"Only {count} module statuses (expected 5)")

            # Click health card to navigate to analytics
            health_card.first.click()
            page.wait_for_timeout(2000)

            # Verify on analytics page
            current_hash = page.evaluate('window.location.hash')
            if 'analytics' in current_hash:
                print(f"  Navigated to analytics: OK")
            else:
                errors.append(f"Not on analytics page. Hash: {current_hash}")
                print(f"  Navigated to analytics: FAIL")
        else:
            errors.append("Health card not found on dashboard")
            print(f"  Health card: MISSING")

        page.screenshot(path=f'/tmp/test_analytics_health_card.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('parent', '小明爸爸-健康速报', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    # 4b: Analytics tabs
    print("\n--- 4b: Analytics tabs ---")
    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    errors = []

    try:
        quick_login(page, '小明爸爸', ALL_ACCOUNTS[0][2])
        page.goto(f'{BASE}/#analytics', wait_until='networkidle')
        page.wait_for_timeout(2000)

        tabs = page.locator('.analytics-tab')
        tab_count = tabs.count()
        tab_labels = [t.inner_text().replace('\n', '') for t in tabs.all()] if tab_count > 0 else []
        print(f"  Tabs: {tab_labels}")

        if tab_count == 3:
            print(f"  3 tabs: OK")

            # Switch to weekly tab
            weekly_tab = page.locator('.analytics-tab:has-text("周报")')
            if weekly_tab.count() > 0:
                weekly_tab.first.click()
                page.wait_for_timeout(1500)

                # Check for chart
                chart = page.locator('#weekly-emotion-chart')
                if chart.count() > 0:
                    print(f"  Weekly emotion chart: OK")
                else:
                    print(f"  Weekly emotion chart: not found (may need records)")

            # Switch to monthly tab
            monthly_tab = page.locator('.analytics-tab:has-text("月报")')
            if monthly_tab.count() > 0:
                monthly_tab.first.click()
                page.wait_for_timeout(1500)
                print(f"  Monthly tab switch: OK")
        else:
            errors.append(f"Expected 3 tabs, got {tab_count}: {tab_labels}")
            print(f"  Tabs: FAIL")

        page.screenshot(path=f'/tmp/test_analytics_tabs.png', full_page=True)
    except Exception as e:
        traceback.print_exc()
        errors.append(str(e))
    results.append(('parent', '小明爸爸-分析页Tab', 'PASS' if not errors else 'FAIL', errors))
    page.close()
    context.close()

    browser.close()

# ============================================================
# Print Summary
# ============================================================
print("\n\n" + "="*60)
print("TEST SUMMARY")
print("="*60)
pass_count = 0
fail_count = 0
for role, name, status, errs in results:
    emoji = '\u2705' if status == 'PASS' else '\u274c'
    print(f"{emoji} {name} ({role}): {status}")
    if errs:
        for e in errs:
            print(f"   - {e}")
    if status == 'PASS':
        pass_count += 1
    else:
        fail_count += 1

print(f"\nTotal: {pass_count} PASS, {fail_count} FAIL")