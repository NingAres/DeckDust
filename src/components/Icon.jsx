const paths = {
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-7-3h6v3"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.2"/><path d="M7.5 3.5v4M16.5 3.5v4"/><path d="M4 10h16"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeWidth="2.8"/></>,
  collection: <><rect x="3" y="5" width="13" height="15" rx="2"/><path d="m8 5 2-3 11 4-4 14-2-1M7 9h5M7 13h5M7 17h3"/></>,
  deck: <><path d="M4 7h16v13H4zM7 4h10M10 1h4M8 11h8M8 15h8"/></>,
  pack: <><path d="M5 3h14v18H5zM5 7h14M5 17h14m-7-8 3 3-3 3-3-3z"/></>,
  chart: <><path d="M3 3v18h18M7 17v-5m5 5V6m5 11V9"/></>,
  pie: <><path d="M11 3.05A9 9 0 1 0 20.95 13H11z"/><path d="M13 3.05V11h7.95A9 9 0 0 0 13 3.05Z"/></>,
  compare: <><path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4"/></>,
  settings: <><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.21.6.78 1 1.41 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08Z"/><circle cx="12" cy="12" r="3"/></>,
  search: <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>,
  left: <path d="m15 5-7 7 7 7"/>, right: <path d="m9 5 7 7-7 7"/>,
  close: <path d="m5 5 14 14M19 5 5 19"/>,
  sync: <><path d="M20 8a8 8 0 0 0-14-3L3 8m0-6v6h6M4 16a8 8 0 0 0 14 3l3-3m0 6v-6h-6"/></>,
  refresh: <><path d="M20 10a8 8 0 1 0 1 5"/><path d="M21 4v6h-6"/></>,
  check: <path d="m5 12 4.5 4.5L19 7" strokeWidth="2.2"/>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  alert: <><path d="M10.3 4.2 2.8 17.1A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18"/></>,
  filter: <><path d="M3 5h18M6 12h12M9 19h6"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/></>,
  build: <><path d="m14.5 6.5 3-3a5 5 0 0 1-6.8 6.8L5 16l3 3 5.7-5.7a5 5 0 0 1 6.8-6.8l-3 3z"/><path d="m4 17-1 1 3 3 1-1"/></>,
  export: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v4h14v-4"/></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></>,
};
export default function Icon({ name, ...props }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.collection}</svg>;
}

