from playwright.sync_api import sync_playwright
import os

output_dir = '/Users/jinjun/Desktop/开发/参赛/ai-dongwo/screenshots'
os.makedirs(output_dir, exist_ok=True)

url = 'https://invert-hope-63033309.figma.site'
fullpage_path = os.path.join(output_dir, 'figma_fullpage.png')
viewport_path = os.path.join(output_dir, 'figma_viewport.png')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    page = context.new_page()
    
    print(f'正在访问: {url}')
    page.goto(url, wait_until='domcontentloaded', timeout=60000)
    
    print('等待 5 秒让页面完全渲染...')
    page.wait_for_timeout(5000)
    
    try:
        page.wait_for_load_state('networkidle', timeout=10000)
    except:
        pass
    
    title = page.title()
    print(f'页面标题: {title}')
    
    page.screenshot(path=viewport_path)
    print(f'视口截图已保存: {viewport_path}')
    
    page.screenshot(path=fullpage_path, full_page=True)
    print(f'全页截图已保存: {fullpage_path}')
    
    body_text = page.locator('body').inner_text()
    print(f'页面文本长度: {len(body_text)} 字符')
    print('---页面文本开始---')
    print(body_text[:5000])
    print('---页面文本结束---')
    
    browser.close()
    print('完成!')

