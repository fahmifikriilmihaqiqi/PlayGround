#!/usr/bin/env bash
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR for screenshot output}"
case "$CAPTURE_URL" in http://*|https://*) ;; *) echo 'CAPTURE_URL must be an absolute HTTP(S) URL.' >&2; exit 1 ;; esac
[[ "$CAPTURE_DIR" = /* ]] || { echo 'CAPTURE_DIR must be absolute.' >&2; exit 1; }
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node --input-type=module - "$CAPTURE_URL" "$CAPTURE_DIR" <<'NODE'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const [url, output] = process.argv.slice(2)
const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'))
if (process.platform === 'linux') process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
const transient = error => Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: 75 })
const started = Date.now()
let browser
let exitCode = 0
try {
  console.log(`Launching capture browser (${Date.now() - started}ms elapsed)`)
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => { throw transient(error) })
  for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const phase = Date.now()
    const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile }).catch(error => { throw transient(error) })
    page.setDefaultTimeout(30000)
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    let response
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
    } catch (error) {
      await page.close().catch(() => {})
      throw transient(error)
    }
    if (!response) throw transient(new Error(`No response navigating to ${url}`))
    if (!response.ok()) {
      const status = response.status()
      await page.close().catch(() => {})
      throw Object.assign(new Error(`Preview returned HTTP ${status}: ${url}`), { exitCode: [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1 })
    }
    await page.locator('body').waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.readyState === 'complete' && document.body && document.body.innerText.trim().length > 0)
    const canvas = page.locator('canvas#c')
    if (await canvas.count() !== 1) throw new Error('Rendered game canvas #c is missing.')
    const begin = page.getByRole('button', { name: /begin infiltration/i })
    if (await begin.count()) await begin.click({ timeout: 3000 })
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas#c')
      if (!c || !c.width || !c.height) return false
      try {
        const context = c.getContext('2d')
        if (!context) return false
        // The game paints its terrain below the palace; (5, 5) is intentionally transparent.
        const x = Math.floor(c.width * 0.1)
        const y = Math.floor(c.height * 0.4)
        const pixel = context.getImageData(x, y, 1, 1).data
        return pixel[3] > 0 && (pixel[0] !== 0 || pixel[1] !== 0 || pixel[2] !== 0)
      } catch { return false }
    }, null, { timeout: 10000 }).catch(error => { throw new Error(`Game canvas did not render: ${error.message}`) })
    if (pageErrors.length) throw new Error(`Page rendering error: ${pageErrors.join('; ')}`)
    await page.waitForTimeout(500)
    if (pageErrors.length) throw new Error(`Page rendering error: ${pageErrors.join('; ')}`)
    await page.screenshot({ path: join(output, `final-${name}.png`), fullPage: false, timeout: 30000 }).catch(error => { throw transient(error) })
    console.log(`Captured ${name} (${Date.now() - phase}ms)`)
    await page.close()
  }
} catch (error) {
  console.error(error)
  exitCode = error.exitCode || 1
} finally {
  if (browser) await browser.close().catch(error => { console.error(`Browser cleanup failed: ${error.message}`); exitCode ||= 75 })
}
process.exitCode = exitCode
NODE
