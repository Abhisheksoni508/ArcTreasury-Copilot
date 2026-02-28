import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string | number;
  duration?: number;
}

export default function AnimatedNumber({ value, duration = 600 }: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // If the value is a string that starts with '$', animate the numeric part
    const raw = String(value);
    const prefix = raw.match(/^[^0-9.]*/)?.[0] ?? '';
    const suffix = raw.match(/[^0-9.,]*$/)?.[0] ?? '';
    const numStr = raw.replace(prefix, '').replace(suffix, '').replace(/,/g, '');
    const target = parseFloat(numStr);

    if (isNaN(target)) {
      setDisplay(value);
      return;
    }

    const startVal = typeof display === 'number' ? display : (() => {
      const d = String(display).replace(/^[^0-9.]*/, '').replace(/[^0-9.,]*$/, '').replace(/,/g, '');
      return parseFloat(d) || 0;
    })();

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (target - startVal) * eased;

      if (Number.isInteger(target)) {
        setDisplay(`${prefix}${Math.round(current).toLocaleString()}${suffix}`);
      } else {
        setDisplay(`${prefix}${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display}</>;
}
