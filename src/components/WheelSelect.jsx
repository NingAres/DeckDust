import { useEffect, useRef } from 'react';

export default function WheelSelect({ onValueChange, children, ...props }) {
  const selectRef = useRef(null);
  const changeRef = useRef(onValueChange);
  changeRef.current = onValueChange;
  useEffect(() => {
    const select = selectRef.current;
    let lastChange = -Infinity;
    function changeWithWheel(event) {
      if (select.disabled || event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      if (event.timeStamp - lastChange < 160) return;
      const options = Array.from(select.options).filter(option => !option.disabled);
      const index = options.findIndex(option => option.value === select.value);
      const nextIndex = Math.max(0, Math.min(options.length - 1, index + Math.sign(event.deltaY)));
      if (options[nextIndex] && nextIndex !== index) {
        lastChange = event.timeStamp;
        changeRef.current(options[nextIndex].value);
      }
    }
    select.addEventListener('wheel', changeWithWheel, { passive: false });
    return () => select.removeEventListener('wheel', changeWithWheel);
  }, []);
  return <select {...props} ref={selectRef} onChange={event => onValueChange(event.target.value)}>{children}</select>;
}
