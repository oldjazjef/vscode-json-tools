/**
 * Trailing-edge debounce: each call resets the timer, and `fn` runs once
 * `delayMs` after the *last* call goes quiet. This deliberately never drops
 * the final invocation — important for search-as-you-type filters, where
 * losing the user's last keystroke would leave the UI showing a stale
 * partial filter.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delayMs);
  };
}
