import Icon from './Icon.jsx';

export default function UnavailableState({ title, message, onRetry }) {
  return <div className="empty-state" role="alert">
    <Icon name="alert" />
    <h2>{title}</h2>
    <p>{message}</p>
    {onRetry ? <button className="gold-button" onClick={onRetry}>重新加载</button> : null}
  </div>;
}
