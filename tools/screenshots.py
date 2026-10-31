"""README screenshots from the web demo, with made-up demo data only.

Start the web demo first (`make web`), then: `make screenshots`.
Onboards a fake user ("Sam"), loads demo data from the dev menu and saves
phone-sized PNGs to docs/screenshots/. Needs Google Chrome installed.
"""

import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screenshots"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
VIEWPORT = {"width": 390, "height": 844}

# Scroll every view back to the top and hide the dev-only warning toasts.
CLEAN = """
for (const el of document.querySelectorAll('div')) {
  if (el.scrollTop > 0) el.scrollTop = 0;
}
const toast = document.getElementById('error-toast');
if (toast) toast.style.display = 'none';
"""


def tap(page: Page, test_id: str) -> None:
    page.locator(f'[data-testid="{test_id}"]').first.click()
    page.wait_for_timeout(900)


def shot(page: Page, name: str) -> None:
    page.wait_for_timeout(1800)
    page.evaluate(CLEAN)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print(f"saved docs/screenshots/{name}.png")


def onboard_with_demo_data(page: Page) -> None:
    page.goto(BASE, wait_until="networkidle", timeout=180_000)
    page.wait_for_timeout(3000)
    tap(page, "onboarding-next")
    tap(page, "disclaimer-agree")
    page.locator('[data-testid="nickname-input"]').fill("Sam")
    tap(page, "onboarding-next")
    page.locator('[data-testid="pin-new"]').fill("482913")
    page.locator('[data-testid="pin-confirm"]').fill("482913")
    tap(page, "onboarding-finish")
    page.wait_for_timeout(2000)
    tap(page, "open-settings")
    tap(page, "dev-load-demo")
    page.wait_for_timeout(2500)
    # Back, not reload: the web stand-in keeps data in memory only.
    page.go_back()
    page.wait_for_timeout(1500)


def visit(page: Page, test_id: str, name: str) -> None:
    tap(page, test_id)
    shot(page, name)
    page.go_back()
    page.wait_for_timeout(1200)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for scheme in ("light", "dark"):
            context = browser.new_context(viewport=VIEWPORT, color_scheme=scheme)
            page = context.new_page()
            onboard_with_demo_data(page)
            shot(page, f"home-{scheme}")
            if scheme == "light":
                visit(page, "open-checkin", "checkin")
                visit(page, "open-triggers", "triggers")
                visit(page, "help-button", "help")
                tap(page, "sos-button")
                shot(page, "sos")
            context.close()
        browser.close()


if __name__ == "__main__":
    main()
