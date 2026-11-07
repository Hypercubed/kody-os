/**
 * Built-in shell pages that used to ship as catalog apps (help-about-built-in).
 *
 * The About content is the retired about bundle's markup, moved into shell
 * code: the about-wrap description, the GitHub Sponsors / Ko-fi / Buy Me a
 * Coffee links, and their QR codes, plus a Kody referral note at the bottom.
 * Help needs no content here: it renders
 * the shared block from renderEmptyHelp (apps/client.ts).
 *
 * ES2019 ceiling: this is static markup, no script.
 */
var ABOUT_CONTENT = `
<style>
.about-wrap { padding: 16px; }
.about-wrap h2 { font-size: 28px; line-height: 1.2; margin: 0 0 12px 0; }
.about-wrap p { font-size: 18px; line-height: 1.4; margin: 0 0 16px 0; }
.about-item { border: 2px solid #111; padding: 16px; margin: 0 0 16px 0; overflow: hidden; }
.about-link { display: block; min-height: 48px; padding: 12px 0; font-size: 20px; font-weight: bold; color: #111; text-decoration: underline; }
.about-link span { display: block; font-size: 16px; font-weight: normal; margin-top: 4px; text-decoration: none; }
.about-qr { float: right; margin: 0 0 12px 16px; background: #fff; }
.about-qr svg { display: block; width: 150px; height: 150px; background: #fff; }
.about-note { font-size: 16px; }
.about-referral { margin-top: 16px; padding-top: 12px; border-top: 2px solid #111; }
.about-referral code { font-family: monospace; font-weight: bold; }
</style>
<div class="about-wrap">
<h2>About kody-os</h2>
<p>kody-os is a minimal, private OS shell for the browser. It is free to use, fork, and adapt.</p>
<p>If it is useful to you, supporting its author helps keep it going. Supporting is optional. Nothing in kody-os is locked behind a donation.</p>
<p>On a Kindle Scribe, scan a code below with your phone. The donation sites may not work well in the Scribe browser itself, so the links are also kept for other browsers.</p>
<div class="about-item"><div class="about-qr" role="img" aria-label="QR code for GitHub Sponsors"><svg viewBox="0 0 37 37" class="segno"><path class="qrline" stroke="#000" d="M4 4.5h7m3 0h3m1 0h2m1 0h3m2 0h7m-29 1h1m5 0h1m3 0h1m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m3 0h2m2 0h7m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m5 0h1m1 0h2m2 0h1m3 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m6 0h4m5 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m1 0h6m1 0h3m1 0h2m1 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-20 1h2m1 0h1m2 0h1m1 0h2m-19 1h1m2 0h1m1 0h2m1 0h3m9 0h2m1 0h1m-22 1h4m1 0h1m1 0h1m3 0h1m2 0h1m3 0h1m1 0h1m2 0h1m2 0h1m-29 1h3m3 0h1m3 0h2m1 0h2m1 0h2m1 0h1m1 0h1m2 0h4m-28 1h2m1 0h1m1 0h1m3 0h2m2 0h2m3 0h1m1 0h1m3 0h1m1 0h2m-25 1h4m3 0h3m1 0h1m1 0h2m3 0h2m2 0h1m1 0h2m-28 1h1m5 0h2m2 0h1m1 0h1m3 0h5m-20 1h1m3 0h1m1 0h3m2 0h2m1 0h1m1 0h1m1 0h1m1 0h7m-29 1h1m4 0h1m1 0h3m2 0h1m4 0h1m2 0h3m2 0h1m1 0h1m-28 1h1m1 0h1m3 0h3m2 0h1m1 0h1m2 0h2m2 0h1m2 0h1m3 0h1m-27 1h3m1 0h1m3 0h6m1 0h1m1 0h1m1 0h4m1 0h1m2 0h1m-29 1h1m3 0h4m1 0h2m1 0h1m1 0h1m2 0h2m2 0h1m1 0h2m2 0h2m-26 1h1m1 0h1m1 0h1m1 0h1m4 0h2m1 0h2m1 0h2m1 0h2m2 0h2m-29 1h1m1 0h2m2 0h1m1 0h5m3 0h1m1 0h7m1 0h1m-19 1h2m1 0h2m1 0h1m1 0h1m2 0h2m3 0h1m1 0h3m-29 1h7m3 0h2m5 0h1m2 0h1m1 0h1m1 0h1m2 0h1m-28 1h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h1m3 0h5m-29 1h1m1 0h3m1 0h1m2 0h2m1 0h1m7 0h5m2 0h2m-29 1h1m1 0h3m1 0h1m1 0h1m1 0h1m8 0h2m1 0h6m-28 1h1m1 0h3m1 0h1m5 0h2m3 0h4m3 0h3m1 0h1m-29 1h1m5 0h1m2 0h1m1 0h1m1 0h3m1 0h1m1 0h3m2 0h1m2 0h1m-28 1h7m1 0h1m1 0h1m1 0h1m1 0h4m2 0h6m1 0h1"/></svg></div><a class="about-link" href="https://github.com/sponsors/Hypercubed" target="_blank" rel="noopener">GitHub Sponsors<span>Recurring sponsorship on GitHub.</span></a></div>
<div class="about-item"><div class="about-qr" role="img" aria-label="QR code for Ko-fi"><svg viewBox="0 0 37 37" class="segno"><path class="qrline" stroke="#000" d="M4 4.5h7m1 0h3m3 0h6m2 0h7m-29 1h1m5 0h1m2 0h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h2m1 0h3m2 0h1m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h2m2 0h2m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m8 0h1m2 0h1m1 0h1m1 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m1 0h4m3 0h2m1 0h2m2 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-21 1h2m2 0h1m1 0h1m1 0h2m1 0h2m-20 1h1m1 0h1m1 0h4m3 0h2m1 0h1m1 0h3m1 0h3m1 0h2m1 0h1m-28 1h5m3 0h3m2 0h2m1 0h1m2 0h1m1 0h1m3 0h1m1 0h1m-29 1h2m4 0h5m2 0h2m1 0h2m1 0h2m1 0h3m2 0h1m-21 1h2m1 0h1m4 0h1m4 0h4m2 0h2m-28 1h1m1 0h1m3 0h3m2 0h2m1 0h4m2 0h1m1 0h2m-17 1h2m1 0h2m3 0h1m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m-27 1h1m2 0h1m1 0h8m3 0h2m1 0h1m1 0h1m5 0h1m-22 1h4m5 0h2m3 0h3m-24 1h2m2 0h1m1 0h1m3 0h1m1 0h1m5 0h1m1 0h2m5 0h2m-28 1h1m1 0h2m3 0h2m3 0h1m1 0h3m3 0h3m1 0h1m1 0h2m-29 1h1m3 0h1m1 0h1m1 0h2m1 0h1m1 0h4m1 0h1m2 0h1m2 0h1m1 0h3m-27 1h1m2 0h1m1 0h3m2 0h3m2 0h2m1 0h1m2 0h1m1 0h1m1 0h2m-29 1h1m1 0h1m2 0h2m3 0h3m1 0h3m1 0h1m1 0h8m-20 1h2m1 0h1m1 0h2m1 0h1m2 0h2m3 0h1m2 0h2m-29 1h7m1 0h1m5 0h1m1 0h2m2 0h1m1 0h1m1 0h4m-28 1h1m5 0h1m1 0h2m1 0h2m4 0h1m2 0h1m3 0h1m1 0h1m1 0h1m-29 1h1m1 0h3m1 0h1m3 0h1m2 0h1m6 0h6m1 0h1m-28 1h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h4m2 0h4m1 0h1m1 0h1m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h2m1 0h2m5 0h2m3 0h2m2 0h1m-29 1h1m5 0h1m1 0h5m2 0h1m1 0h1m2 0h2m1 0h1m3 0h1m-28 1h7m2 0h1m1 0h3m3 0h1m2 0h3m1 0h1m2 0h1"/></svg></div><a class="about-link" href="https://ko-fi.com/hypercubed" target="_blank" rel="noopener">Ko-fi<span>One-time tip.</span></a></div>
<div class="about-item"><div class="about-qr" role="img" aria-label="QR code for Buy Me a Coffee"><svg viewBox="0 0 37 37" class="segno"><path class="qrline" stroke="#000" d="M4 4.5h7m4 0h1m1 0h2m2 0h2m3 0h7m-29 1h1m5 0h1m1 0h1m1 0h1m2 0h1m2 0h1m5 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m3 0h1m2 0h2m2 0h2m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m4 0h1m3 0h1m2 0h1m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h1m1 0h1m4 0h1m1 0h3m1 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m3 0h2m2 0h1m1 0h1m5 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-21 1h1m1 0h2m2 0h2m3 0h2m-21 1h1m5 0h1m1 0h1m1 0h2m1 0h3m1 0h2m2 0h2m2 0h3m-28 1h1m2 0h1m3 0h1m6 0h2m1 0h3m3 0h2m1 0h2m-28 1h1m1 0h1m3 0h1m1 0h1m5 0h2m1 0h1m2 0h2m-19 1h3m2 0h1m3 0h1m2 0h1m2 0h3m1 0h2m1 0h1m-23 1h2m1 0h2m1 0h1m1 0h1m1 0h3m4 0h1m1 0h2m4 0h1m-28 1h2m1 0h1m3 0h2m2 0h1m2 0h2m1 0h5m1 0h1m2 0h2m-29 1h1m1 0h1m3 0h4m5 0h4m1 0h1m2 0h1m1 0h2m-25 1h1m7 0h1m3 0h1m4 0h6m1 0h1m1 0h1m-29 1h5m1 0h2m2 0h3m2 0h1m1 0h1m5 0h1m1 0h2m-27 1h1m2 0h2m3 0h3m1 0h2m1 0h10m1 0h3m-29 1h4m1 0h2m1 0h2m2 0h1m2 0h2m2 0h1m1 0h1m3 0h1m2 0h1m-29 1h1m2 0h1m1 0h1m1 0h1m2 0h4m7 0h1m1 0h2m-25 1h1m2 0h1m1 0h3m2 0h2m2 0h4m2 0h5m1 0h3m-21 1h1m2 0h2m1 0h2m1 0h2m1 0h1m3 0h2m-26 1h7m2 0h1m5 0h2m2 0h2m1 0h1m1 0h3m-27 1h1m5 0h1m2 0h3m2 0h1m4 0h2m3 0h1m2 0h2m-29 1h1m1 0h3m1 0h1m3 0h5m3 0h8m2 0h1m-29 1h1m1 0h3m1 0h1m3 0h2m1 0h7m1 0h1m1 0h1m1 0h2m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h1m1 0h5m1 0h1m1 0h1m1 0h7m-28 1h1m5 0h1m2 0h1m1 0h3m2 0h1m4 0h1m1 0h1m1 0h2m1 0h1m-29 1h7m1 0h1m1 0h1m1 0h3m2 0h1m1 0h1m3 0h4"/></svg></div><a class="about-link" href="https://www.buymeacoffee.com/hypercubed" target="_blank" rel="noopener">Buy Me a Coffee<span>One-time or monthly support.</span></a></div>
<p class="about-note">Each link opens the donation site in a new tab. No payment is taken inside kody-os, and no donation tracking is added.</p>
<p class="about-note about-referral">If you signup for a Kody Pro account please use my referal code <code>hypercubed</code></p>
</div>
`

export function renderAboutContent(): string {
	return ABOUT_CONTENT
}
