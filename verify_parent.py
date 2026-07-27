"""Quick verification test - navigate directly to profile pages"""
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:9090'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 430, 'height': 932})
    page = context.new_page()
    
    # Login as parent
    page.goto(BASE, wait_until='networkidle')
    page.evaluate('localStorage.clear()')
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1500)
    
    # Quick login as 小明爸爸
    quick_item = page.locator('.quick-login-item:has-text("小明爸爸")')
    quick_item.first.click()
    page.wait_for_timeout(3000)
    page.wait_for_load_state('networkidle')
    
    # Get current URL
    print(f"Dashboard URL: {page.url}")
    
    # Check page content
    page_content = page.content()
    has_youth_card = 'youth-card' in page_content
    print(f"Has youth-card: {has_youth_card}")
    
    # Try to navigate directly to profile
    # Get the youth ID from the DOM
    youth_card = page.locator('.youth-card').first
    if youth_card.count() > 0:
        youth_id = youth_card.get_attribute('data-youth-id')
        print(f"Youth ID: {youth_id}")
        if youth_id:
            page.goto(f'{BASE}/#profile?youthId={youth_id}', wait_until='networkidle')
            page.wait_for_timeout(2000)
            page.wait_for_load_state('networkidle')
            print(f"Profile URL: {page.url}")
            
            # Check module tabs
            module_tabs = page.locator('.module-tab')
            tab_count = module_tabs.count()
            tab_labels = []
            for i in range(tab_count):
                try:
                    label = module_tabs.nth(i).locator('.module-tab-label').inner_text()
                    tab_labels.append(label)
                except:
                    pass
            print(f"Module tabs ({tab_count}): {tab_labels}")
            
            page.screenshot(path='/tmp/parent_profile_verify.png', full_page=True)
            print("Profile screenshot saved")
    
    browser.close()
    print("\nDone!")