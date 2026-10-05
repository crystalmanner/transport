import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/format.js';
import styles from './Charts.module.css';

export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

// The chart is drawn to the pixel width of its box, so it stays sharp on a phone and on a wide screen.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Axis from zero to a clean number just above the largest value: 0 / 5 / 10 / 15, 0 / 2,000 / 4,000...
function axis(max) {
  const rough = Math.max(max, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  // Counts of people and orders are whole numbers, so the step never goes below 1.
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough));
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

function compact(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${+(n / 1e3).toFixed(1)}K`;
  return formatNumber(n);
}

const PAD = { top: 16, right: 44, bottom: 24, left: 40 };

function Frame({ width, height, top, ticks, children }) {
  const plotH = height - PAD.top - PAD.bottom;
  const y = (value) => PAD.top + plotH - (value / top) * plotH;
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={tick === 0 ? styles.baseline : styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className={styles.tick} x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
            {compact(tick)}
          </text>
        </g>
      ))}
      {children(y)}
    </>
  );
}

// Labels along the bottom: as many as fit, always including the newest one on the right.
function XLabels({ labels, x, height, plotW }) {
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 64))));
  return labels.map((label, i) =>
    (labels.length - 1 - i) % every === 0 ? (
      <text key={i} className={styles.tick} x={x(i)} y={height - 6} textAnchor="middle">
        {label}
      </text>
    ) : null
  );
}

function Tooltip({ left, flip, title, rows }) {
  return (
    <div className={styles.tooltip} style={{ top: PAD.top, ...(flip ? { right: `calc(100% - ${left - 12}px)` } : { left: left + 12 }) }}>
      <span className={styles.tooltipTitle}>{title}</span>
      {rows.map((row) => (
        <span key={row.name} className={styles.tooltipRow}>
          <span className={styles.key} style={{ background: row.color }} />
          <strong>{row.value}</strong>
          <span>{row.name}</span>
        </span>
      ))}
    </div>
  );
}

// Arrow keys move the readout when the chart has keyboard focus; the same details as on hover.
function keyboard(count, active, setActive) {
  return {
    tabIndex: 0,
    onFocus: () => setActive((current) => current ?? count - 1),
    onBlur: () => setActive(null),
    onKeyDown: (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const move = event.key === 'ArrowLeft' ? -1 : 1;
      setActive(Math.min(count - 1, Math.max(0, (active ?? count - 1) + move)));
    },
  };
}

/*
 * Change over time. series: [{ name, values }] in a fixed order (the order gives the color).
 * One series gets a light area wash and no legend (the card title names it);
 * two or more get a legend. Pointing anywhere shows every series at that date.
 */
export function LineChart({ labels, series, height = 220, label }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);

  const { top, ticks } = axis(Math.max(0, ...series.flatMap((s) => s.values)));
  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const x = (i) => PAD.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const last = labels.length - 1;

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - PAD.left) / plotW;
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  return (
    <div className={styles.viz} ref={ref}>
      {series.length > 1 && (
        <ul className={styles.legend}>
          {series.map((s, index) => (
            <li key={s.name}>
              <span className={styles.key} style={{ background: SERIES_COLORS[index] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      {width > 0 && (
        <svg height={height} role="img" aria-label={label} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} {...keyboard(labels.length, active, setActive)}>
          <Frame width={width} height={height} top={top} ticks={ticks}>
            {(y) => {
              // End labels are skipped when two lines finish too close to each other to label cleanly.
              const ends = series.map((s) => y(s.values[last])).sort((a, b) => a - b);
              const roomy = ends.every((value, i) => i === 0 || value - ends[i - 1] >= 14);
              return (
                <>
                  {active !== null && <line className={styles.crosshair} x1={x(active)} x2={x(active)} y1={PAD.top} y2={height - PAD.bottom} />}
                  {series.map((s, index) => {
                    const points = s.values.map((value, i) => `${x(i)},${y(value)}`).join(' ');
                    return (
                      <g key={s.name}>
                        {series.length === 1 && <polygon points={`${x(0)},${y(0)} ${points} ${x(last)},${y(0)}`} fill={SERIES_COLORS[index]} opacity="0.1" />}
                        <polyline className={styles.line} points={points} stroke={SERIES_COLORS[index]} />
                        <circle className={styles.dot} cx={x(active ?? last)} cy={y(s.values[active ?? last])} r="5" fill={SERIES_COLORS[index]} />
                        {roomy && active === null && (
                          <text className={styles.valueLabel} x={x(last) + 10} y={y(s.values[last]) + 4}>
                            {compact(s.values[last])}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            }}
          </Frame>
          <XLabels labels={labels} x={x} height={height} plotW={plotW} />
        </svg>
      )}
      {active !== null && (
        <Tooltip
          left={x(active)}
          flip={x(active) > width / 2}
          title={labels[active]}
          rows={series.map((s, index) => ({ name: s.name, color: SERIES_COLORS[index], value: formatNumber(s.values[active], 2) }))}
        />
      )}
    </div>
  );
}

/*
 * Amounts per period as columns from one baseline: thin, rounded at the data end only.
 * Each column answers to hover, touch and the arrow keys with its exact value.
 */
export function ColumnChart({ labels, values, name, height = 220, label }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);

  const { top, ticks } = axis(Math.max(0, ...values));
  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const band = plotW / labels.length;
  const barW = Math.min(24, band * 0.6);
  const center = (i) => PAD.left + band * (i + 0.5);

  return (
    <div className={styles.viz} ref={ref}>
      {width > 0 && (
        <svg height={height} role="img" aria-label={label} onPointerLeave={() => setActive(null)} {...keyboard(labels.length, active, setActive)}>
          <Frame width={width} height={height} top={top} ticks={ticks}>
            {(y) =>
              values.map((value, i) => {
                const left = center(i) - barW / 2;
                const tip = y(value);
                const base = y(0);
                const r = Math.min(4, (base - tip) / 2);
                return (
                  <g key={i}>
                    {value > 0 && (
                      <path
                        className={`${styles.bar} ${active === i ? styles.barActive : ''}`}
                        fill={SERIES_COLORS[0]}
                        d={`M${left},${base} V${tip + r} Q${left},${tip} ${left + r},${tip} H${left + barW - r} Q${left + barW},${tip} ${left + barW},${tip + r} V${base} Z`}
                      />
                    )}
                    {band >= 44 && value > 0 && (
                      <text className={styles.valueLabel} x={center(i)} y={tip - 6} textAnchor="middle">
                        {compact(value)}
                      </text>
                    )}
                    {/* The whole band is the hover target, not just the painted column. */}
                    <rect x={PAD.left + band * i} y={PAD.top} width={band} height={height - PAD.top - PAD.bottom} fill="transparent" onPointerMove={() => setActive(i)} onPointerDown={() => setActive(i)} />
                  </g>
                );
              })
            }
          </Frame>
          <XLabels labels={labels} x={center} height={height} plotW={plotW} />
        </svg>
      )}
      {active !== null && (
        <Tooltip left={center(active)} flip={center(active) > width / 2} title={labels[active]} rows={[{ name, color: SERIES_COLORS[0], value: formatNumber(values[active], 2) }]} />
      )}
    </div>
  );
}

// Compare amounts across a few named groups. Every bar carries its value, so nothing depends on hover.
export function BarList({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="muted small">No data yet.</p>;
  return (
    <div className={styles.viz}>
      <ul className={styles.barList}>
        {rows.map((row) => (
          <li key={row.label}>
            <span className={styles.name} title={row.label}>
              {row.label}
            </span>
            <span className={styles.track}>
              <span className={styles.fill} style={{ width: `${(row.value / max) * 100}%` }} />
              <span className={styles.value}>{formatNumber(row.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The same numbers as a plain table, for screen readers and for anyone who wants exact values.
export function TableView({ columns, rows }) {
  return (
    <details className={styles.details}>
      <summary>Show as table</summary>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// A row of headline numbers. The first tile may be the `hero`: the one number the page leads with.
export function StatTiles({ tiles }) {
  return (
    <dl className={styles.tiles}>
      {tiles.map((tile) => (
        <div key={tile.label} className={`${styles.tile} ${tile.hero ? styles.hero : ''}`} style={tile.hero ? { gridColumn: 'span 2' } : undefined}>
          <dt>{tile.label}</dt>
          <dd>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
