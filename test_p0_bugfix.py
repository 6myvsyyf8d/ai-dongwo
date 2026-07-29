"""Task 1: Debug handover status toggle + Task 3: Verify C4 latest record on youth card"""
from playwright.sync_api import sync_playwright
import time, json, random

BASE = 'http://localhost:8080'

def login(page, name):
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_timeout(1200)
    sel = f'.quick-login-item:has(.quick-login-name:text-is("{name}"))'
    if page.locator(sel).count() > 0:
        page.locator(sel).first.click()
        page.wait_for_timeout(1800)
    else:
        return False
    # Select first youth
    page.evaluate('''() => {
        const youths = Permissions.getAccessibleYouths();
        if (youths.length > 0) AppState.selectYouth(youths[0].id);
    }''')
    return True

def test_handover_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 430, 'height': 932})
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        login(page, '小明保姆')
        time.sleep(0.5)

        # Navigate dashboard explicitly
        page.evaluate("location.hash = 'dashboard'")
        page.wait_for_timeout(1500)

        # Debug 1: count status buttons and their data
        info = page.evaluate('''() => {
            const btns = Array.from(document.querySelectorAll('.handover-status-btn'));
            return btns.slice(0, 3).map(b => ({
                text: b.innerText.trim(),
                taskId: b.getAttribute('data-task-id'),
                youthId: b.getAttribute('data-youth-id'),
                status: b.getAttribute('data-status'),
                classes: b.className
            }));
        }''')
        print('[DEBUG] T1 - handover buttons:', json.dumps(info, ensure_ascii=False, indent=2))

        if len(info) == 0:
            print('[FAIL] No handover buttons on dashboard for 小明保姆')
            # Check if handover section is empty
            sections = page.evaluate('''() => {
                return Array.from(document.querySelectorAll('.handover-section, .handover-empty, .handover-tasks, .handover-body')).map(s => ({
                    tag: s.tagName,
                    id: s.id,
                    class: s.className,
                    text: s.innerText.substring(0, 80)
                }));
            }''')
            print('[DEBUG] Handover sections:', json.dumps(sections[:10], ensure_ascii=False, indent=2))
        else:
            # Pick first pending button
            btn_info = next((b for b in info if b['status'] == 'pending'), info[0])
            print(f'[DEBUG] Picking button: status={btn_info["status"]}, youthId={btn_info["youthId"]}, taskId={btn_info["taskId"][:8]}...')

            # Debug 2: check if task exists in storage BEFORE click
            pre = page.evaluate('''(args) => {
                const {youthId, taskId} = args;
                const list = Storage.getHandoverTasks(youthId);
                const found = list.find(t => t.id === taskId);
                return {
                    totalTasks: list.length,
                    found: !!found,
                    statusBefore: found ? found.status : 'NOT_FOUND',
                    idsSample: list.slice(0, 3).map(t => t.id.substring(0, 8))
                };
            }''', {'youthId': btn_info['youthId'], 'taskId': btn_info['taskId']})
            print('[DEBUG] Before click:', json.dumps(pre, ensure_ascii=False))

            if not pre['found']:
                print('[BUG] Task not found in storage! ids=', pre['idsSample'])

            # Click the button
            all_btns = page.locator('.handover-status-btn')
            clicked = False
            for i in range(all_btns.count()):
                b = all_btns.nth(i)
                if b.get_attribute('data-status') == btn_info['status'] and \
                   b.get_attribute('data-task-id') == btn_info['taskId']:
                    b.click()
                    clicked = True
                    break
            if not clicked:
                all_btns.first.click()
            page.wait_for_timeout(2200)

            # Debug 3: after click - storage status + DOM status
            post = page.evaluate('''(args) => {
                const {youthId, taskId} = args;
                const list = Storage.getHandoverTasks(youthId);
                const found = list.find(t => t.id === taskId);
                // Also try update directly
                const updated = Storage.updateHandoverTask(youthId, taskId, {status: 'done'});
                return {
                    found: !!found,
                    statusAfter: found ? found.status : 'NOT_FOUND',
                    directUpdateReturn: updated
                };
            }''', {'youthId': btn_info['youthId'], 'taskId': btn_info['taskId']})
            print('[DEBUG] After click (and direct update):', json.dumps(post, ensure_ascii=False))

            # Debug 4: check if DOM changed
            new_info = page.evaluate('''(args) => {
                const btns = Array.from(document.querySelectorAll('.handover-status-btn'));
                const b = btns.find(x => x.getAttribute('data-task-id') === args.taskId);
                return b ? {text: b.innerText.trim(), status: b.getAttribute('data-status')} : null;
            }''', {'taskId': btn_info['taskId']})
            print('[DEBUG] DOM after click:', json.dumps(new_info, ensure_ascii=False))

        print('[DEBUG] JS errors:', errors)
        page.screenshot(path='/tmp/handover_debug.png', full_page=True)
        browser.close()

def test_c4_latest_record():
    """Verify youth card (rendered by _renderYouthCard in teacher/caregiver dashboard)
    shows latest record (records[0]) not oldest. Uses 王老师 login as teacher page
    renders student list via _renderYouthCard -> contains youth-card-summary."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 430, 'height': 932})
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        login(page, '王老师')  # teacher: dashboard renders _renderYouthCard list
        page.wait_for_timeout(1200)
        page.evaluate("location.hash = 'dashboard'")
        page.wait_for_timeout(1500)

        # Pick a youth from teacher's accessible youths
        youth_info = page.evaluate('''() => {
            const youths = Permissions.getAccessibleYouths();
            if (youths.length === 0) return null;
            // Pick 小明 (ming) if possible; else first
            const m = youths.find(y => y.name.indexOf('小明') >= 0);
            const y = m || youths[0];
            AppState.selectYouth(y.id);
            return { id: y.id, name: y.name };
        }''')
        print(f'[C4] Youth: {youth_info}')
        if not youth_info:
            print('[FAIL] No youths accessible for teacher')
            return

        # Add a unique latest record
        unique_text = f'[测试{random.randint(1000,9999)}] 这是最新的一条记录，应该显示在档案卡片摘要上'
        added = page.evaluate('''(args) => {
            const {youthId, text} = args;
            const record = {
                id: 'test-c4-' + Date.now(),
                recordedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: AppState.currentUser.id,
                createdByRole: AppState.currentUser.role,
                module: 'dailyRoutine',
                moduleName: '照护与医疗',
                content: {text: text},
                tags: ['测试'],
                safetyLevel: 0,
                mood: 3
            };
            const result = Storage.addRecord(youthId, record);
            const list = Storage.getRecords(youthId);
            return {
                addSuccess: result.success,
                recordsCount: list.length,
                firstText: list[0] ? list[0].content.text : null,
                firstMatches: list[0] ? list[0].content.text === text : false
            };
        }''', {'youthId': youth_info['id'], 'text': unique_text})
        print(f'[C4] addRecord: success={added["addSuccess"]}, count={added["recordsCount"]}, firstMatches={added["firstMatches"]}')

        assert added['firstMatches'] == True, 'FAIL: storage layer returns wrong order'
        print('[PASS] C4 storage layer: records[0] is newest')

        # Reload dashboard via nav
        page.evaluate("location.hash = '#profile'; setTimeout(() => location.hash='dashboard', 60)")
        page.wait_for_timeout(2500)

        # Look for youth-card-summary inside .youth-card[data-youth-id=...]
        summary_text = page.evaluate('''(youthId) => {
            const card = document.querySelector(`.youth-card[data-youth-id="${youthId}"]`);
            if (!card) return {found: false, cardHtml: null};
            const summary = card.querySelector('.youth-card-summary');
            const cardText = card.innerText;
            return {found: true, summary: summary ? summary.innerText : null, fullText: cardText};
        }''', youth_info['id'])

        if summary_text['found']:
            print(f'[C4] Found youth-card for {youth_info["name"]}')
            prefix = unique_text[:24]  # summary truncates at 30, use prefix match
            if summary_text['summary']:
                has = prefix in summary_text['summary']
                print(f'[C4] Summary contains prefix: {has}')
                print(f'[C4] Summary value: {summary_text["summary"]}')
                if has:
                    print('[PASS] C4 DOM layer: youth-card-summary contains latest record prefix')
                else:
                    print('[FAIL] C4 DOM layer: summary does NOT contain latest record')
            else:
                # Module icon prepended; match in full card text
                has = prefix in summary_text['fullText']
                print(f'[C4] Full card text contains prefix: {has}')
                if has:
                    print('[PASS] C4 DOM layer: card text contains latest record')
                else:
                    print(f'[FAIL] C4 DOM layer: card missing latest. FullText tail: ...{summary_text["fullText"][-200:]}')
        else:
            print(f'[FAIL] No youth-card with data-youth-id={youth_info["id"]} found on teacher dashboard')
            # Debug: find all cards
            debug = page.evaluate('''() => {
                return Array.from(document.querySelectorAll('.youth-card, .ios-card-row, .dashboard-section')).map(e => ({
                    class: e.className.substring(0, 60),
                    tag: e.tagName,
                    attr: e.getAttribute && e.getAttribute('data-youth-id'),
                    text: e.innerText.substring(0, 60)
                })).slice(0, 20);
            }''')
            print(f'[C4 DEBUG] Dashboard cards: {json.dumps(debug[:8], ensure_ascii=False, indent=2)}')

        print(f'[C4] JS errors: {errors}')
        page.screenshot(path='/tmp/c4_latest.png', full_page=True)
        browser.close()

if __name__ == '__main__':
    print('========== T1: Handover Status Toggle Debug ==========')
    test_handover_debug()
    print('\n========== C4: Youth Card Latest Record ==========')
    test_c4_latest_record()
