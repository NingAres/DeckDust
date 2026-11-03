import { useLayoutEffect, useRef } from 'react';

// Animate only the value or chart that changed; headers and controls stay still.
export default function Changing({ valueKey, children, as: Tag = 'span', ...props }) {
  const ref = useRef(null), previous = useRef(valueKey), animation = useRef(null);
  useLayoutEffect(() => {
    if (previous.current === valueKey) return;
    previous.current = valueKey;
    const node = ref.current;
    animation.current?.cancel();
    animation.current = node.animate([{ opacity: .35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' });
  }, [valueKey]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return <Tag ref={ref} {...props}>{children}</Tag>;
}
