// Icons are drawn here as inline SVG so the app needs no icon font or network request.
const PATHS = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.4.6 4 2.3 4 5.2" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="2.5" />
      <path d="M4 12h16M8 18v2.5M16 18v2.5M8 15h.01M16 15h.01" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2zM13 9h5l3 3.5V16h-8z" />
      <circle cx="6.5" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  warehouse: <path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10" />,
  park: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M10 17V8h3a3 3 0 0 1 0 6h-3" />
    </>
  ),
  office: <path d="M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3" />,
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  news: <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h3.5" />,
  gift: <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10 3 6 4 7 7M12 7c2-4 6-3 5 0" />,
  star: <path d="M12 3l2.8 5.8 6.2.8-4.5 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  edit: <path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-9" />,
  settings: (
    <>
      <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </>
  ),
  logout: <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />,
  phone: <path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 16.5V7.5h2.5a2.75 2.75 0 0 1 0 5.5H10" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  box: <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </>
  ),
  alert: <path d="M12 3l10 17H2zM12 10v4M12 17h.01" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M6 15.5V10a4 4 0 0 1 4-4h5.5" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 14.5V21M3.5 10.5h6.2M14.3 10.5h6.2" />
    </>
  ),
  door: <path d="M6 21V4h10v17M4 21h16M13 12.5h.01" />,
  stairs: <path d="M4 20h4v-4h4v-4h4V8h4" />,
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
};

export default function Icon({ name, size = 20, filled = false, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
