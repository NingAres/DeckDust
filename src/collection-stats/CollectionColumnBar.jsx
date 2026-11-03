import { useLayoutEffect, useRef, useState } from 'react';
import Changing from './Changing.jsx';
import { completion, number } from './model.js';

export default function CollectionColumnBar({ owned, total, golden, quality }) {
  const plot = useRef(null);
  const [plotHeight, setPlotHeight] = useState(0);
  useLayoutEffect(() => {
    const node = plot.current;
    const measure = () => setPlotHeight(node.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const rate = completion(owned, total), goldRate = completion(golden, total);
  const split = quality === 'mixed';
  const remainingHeight = total ? plotHeight * (owned - golden) / total : 0;
  // Gold always sits above its boundary. Raise the total when the two
  // boundaries are too close, including equal values and zero-height bars.
  const stacked = split && remainingHeight < 22;
  return <span className="cs-column-plot" ref={plot} data-label-layout={stacked ? 'stacked' : 'above'}>
    <Changing as="span" valueKey={`${quality}-${rate}-${goldRate}`} className={`cs-column-fill ${quality === 'golden' ? 'is-gold' : ''}`}
      style={{ height: `${rate}%`, '--cs-total-label-top': stacked ? '-40px' : '-21px' }}>
      <b className="cs-column-total">{rate}%</b>
      {split ? <i className="cs-column-premium" style={{ height: `${completion(golden, owned)}%` }}>
        <span className="cs-column-gold-value"
          title={`金色收藏 ${number(golden)} / ${number(total)} 种，完成度 ${goldRate}%`}>{goldRate}%</span>
      </i> : null}
    </Changing>
  </span>;
}
