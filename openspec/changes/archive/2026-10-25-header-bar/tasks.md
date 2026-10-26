## 1. Header layout

- [x] 1.1 Reorder the bar to brand + Home + Apps + Help with right-aligned server-rendered date + time and no Refresh link, and verify the order, clock text, and absent Refresh in a node render of `/`
- [x] 1.2 Add the right-aligned clock slot styling plus `shell-css.ts` regen, and verify one inline `<style>`, zero `<link>`, no flexbox gap

## 2. Help page

- [x] 2.1 Add the static `GET /help` route in full chrome (what the OS is, live installed-apps list with links, agent add flow), and verify 200 with apps listed plus header Help link active
- [x] 2.2 Add the optional client tick that updates the clock text where timers exist, and verify no-JS render is byte-identical with the script disabled

## 3. Verify

- [x] 3.1 Full pass: header order + clock on `/`, `/apps/:id`, `/help`, and 404 pages; unknown `/help-foo` still 404s; `openspec validate header-bar` green, and verify each observable in the responses
