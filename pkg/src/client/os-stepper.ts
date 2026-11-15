/**
 * `os-stepper` — the shared number-stepper custom element.
 *
 * One file per custom element (fe-be-separation prep, user direction
 * 2026-11-13): each `os-*` LitElement definition lives in its own
 * file under pkg/src/client/, and pkg/src/client/os-elements.ts is
 * the registry that defines them all once.
 *
 * Light-DOM only (createRenderRoot returns `this`), theme via the
 * shell's shared CSS, no-JS content (the server renders the current
 * value as text inside the tag), bridge-only state (the element
 * displays the value it is given and emits `os-change` on user
 * action; it NEVER reads the bridge store).
 *
 * Attributes/properties: `value` (number, default 0), `min`
 * (number, optional, clamps the decrement), `max` (number, optional,
 * clamps the increment), `step` (number, default 1), `label`
 * (string, optional, aria-label base).
 *
 * On a button press the element updates its displayed value and
 * emits an `os-change` CustomEvent (bubbles, composed) with
 * `detail: { value: newValue }`. The owning app listens for
 * `os-change` and dispatches `act()`; the element itself never
 * dispatches and never reads the bridge store. The app passes the
 * authoritative value back down as the `value` property when the
 * bridge store changes, so the element always shows bridge-owned
 * state.
 *
 * ES2019 ceiling: no ?. and no ?? in this file. LitElement class
 * syntax is ES2015 and within the ceiling. Property declarations
 * use `declare` (type-only, no runtime emit) with values set in
 * the constructor, so no class-field runtime code is generated.
 *
 * Mount-point discipline (same as the Counter port): lit-html's
 * `render()` does NOT clear the element's existing children on
 * first render, so the server-rendered no-JS text would stay
 * alongside the Lit template and show the value twice. The element
 * clears its own children once in `connectedCallback`, before
 * Lit's first update; the `value` attribute survives (attributes
 * are untouched by innerHTML), so the property still initializes
 * from it.
 */

type KodyLitGlobal = {
	LitElement: any
	html: any
	css: any
}

/** Define the `os-stepper` tag once. Safe to call repeatedly; a tag
 * that is already defined is left alone. */
export function defineOsStepper(KodyLit: KodyLitGlobal): void {
	var LitElement = KodyLit.LitElement
	var html = KodyLit.html
	class OsStepper extends LitElement {
		static get properties(): Record<string, unknown> {
			return {
				value: { type: Number },
				min: { type: Number },
				max: { type: Number },
				step: { type: Number },
				label: { type: String },
			}
		}
		declare value: number
		declare min: number | undefined
		declare max: number | undefined
		declare step: number
		declare label: string
		declare _cleared: boolean
		constructor() {
			super()
			this.value = 0
			this.min = undefined
			this.max = undefined
			this.step = 1
			this.label = ''
			this._cleared = false
		}
		connectedCallback(): void {
			super.connectedCallback()
			if (!this._cleared) {
				this._cleared = true
				this.innerHTML = ''
			}
		}
		createRenderRoot(): HTMLElement {
			// OsStepper extends the vendored LitElement (typed any via
			// KodyLit), so `this` is not statically an HTMLElement.
			return this as unknown as HTMLElement
		}
		clamp(v: number): number {
			var out = v
			if (typeof this.min === 'number' && out < this.min) out = this.min
			if (typeof this.max === 'number' && out > this.max) out = this.max
			return out
		}
		stepBy(delta: number): void {
			var next = this.clamp(this.value + delta * this.step)
			if (next === this.value) return
			this.value = next
			this.dispatchEvent(
				new CustomEvent('os-change', {
					bubbles: true,
					composed: true,
					detail: { value: next },
				}),
			)
		}
		render(): unknown {
			var base = this.label !== '' ? this.label + ' ' : ''
			return html`
				<span class="os-stepper">
					<span class="os-stepper-value">${this.value}</span>
					<span class="os-stepper-buttons">
						<button type="button" class="os-stepper-dec" aria-label="${base}decrease" @click=${(): void => {
							this.stepBy(-1)
						}}>−</button>
						<button type="button" class="os-stepper-inc" aria-label="${base}increase" @click=${(): void => {
							this.stepBy(1)
						}}>+</button>
					</span>
				</span>
			`
		}
	}
	try {
		window.customElements.define('os-stepper', OsStepper as unknown as CustomElementConstructor)
	} catch (err) {
		// Already defined (the shell defines once; a second definition
		// throws). Leave the single definition in place.
	}
}
