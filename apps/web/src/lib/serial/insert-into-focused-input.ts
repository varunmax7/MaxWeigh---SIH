/**
 * Writes a parsed serial reading into "the active cell" (implementation.md
 * §10 P10) without threading a callback prop through every test form.
 * Every measurement `<Input>` this app renders is a controlled React input
 * marked `data-serial-target="true"` (`ObservationGrid`, `ZeroRefRow`, and
 * each form's own single-value inputs) — whichever one currently has focus
 * is the write target, matching how a bench officer would actually use
 * this: place the cursor in the field, then press the instrument's send
 * button (or the mock "Insert" button here).
 *
 * Setting `.value` directly wouldn't notify React (it owns the DOM node's
 * value via its own internal tracking, not a plain property write), so this
 * goes through the native `HTMLInputElement.prototype.value` setter and
 * dispatches a real `input` event — the standard workaround for
 * programmatically driving a controlled input from outside React.
 */
export function insertIntoFocusedInput(value: string): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || active.dataset.serialTarget !== 'true') {
    return false;
  }
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!nativeInputValueSetter) return false;

  nativeInputValueSetter.call(active, value);
  active.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}
