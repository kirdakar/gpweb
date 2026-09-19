import { useEffect, useState } from 'react';

// Returns `value`, but updated only after it stops changing for `delayMs`.
// Used so search boxes query the API as the user types without firing a
// request on every keystroke.
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
