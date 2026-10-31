import { CLASSES } from '../collection/model.js';

export default function ClassEmblem({ cardClass }) {
  const slug = CLASSES.find(([key]) => key === cardClass)?.[2] || 'Neutral';
  return <span className="class-emblem">
    <img className={`class-symbol${slug === 'Neutral' ? ' class-symbol-neutral' : ''}`} alt="" draggable="false" src={`/assets/native-ui/class-emblems/${slug}.png`} />
  </span>;
}

