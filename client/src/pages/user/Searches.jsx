import { useEffect, useState } from 'react';
import { FeatureGate } from '../../components/Gate.jsx';
import Icon from '../../components/Icon.jsx';
import { Async, Stars, Status } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { query } from '../../lib/api.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';

/*
 * Search box with the user's earlier searches below it. The search runs when the
 * form is sent (not on every letter), because every search is saved to the history.
 */
function SearchBox({ kind, label, placeholder, onSearch, results }) {
  const [text, setText] = useState('');
  const history = useFetch(`/user/search-history?kind=${kind}`);
  const reloadHistory = history.reload;

  // The server stores a search while answering it, so the history is read again when results arrive.
  useEffect(() => {
    if (results) reloadHistory();
  }, [results, reloadHistory]);

  const go = (value) => {
    setText(value);
    onSearch(value);
  };

  return (
    <div className="stack-sm">
      <form
        className="row"
        style={{ alignItems: 'flex-end' }}
        onSubmit={(event) => {
          event.preventDefault();
          go(text.trim());
        }}
      >
        <label className="field grow">
          <span>{label}</span>
          <input className="input" type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} />
        </label>
        <button type="submit" className="btn btn-primary">
          <Icon name="search" size={18} />
          Search
        </button>
      </form>
      {history.data?.length > 0 && (
        <div className="row" style={{ gap: '0.4rem' }}>
          <span className="muted small row" style={{ gap: '0.3rem' }}>
            <Icon name="history" size={15} />
            History:
          </span>
          {history.data.map((item) => (
            <button key={item.query} type="button" className="chip" onClick={() => go(item.query)}>
              {item.query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GuardLine({ bus }) {
  return (
    <div className="row" style={{ gap: '0.5rem 1rem' }}>
      <span className="row" style={{ gap: '0.35rem' }}>
        <Icon name="shield" size={16} />
        {bus.guard_name}
      </span>
      <a className="link row" style={{ gap: '0.35rem' }} href={`tel:${bus.guard_phone}`}>
        <Icon name="phone" size={16} />
        {bus.guard_phone}
      </a>
      <span className="row" style={{ gap: '0.35rem' }}>
        <Stars value={bus.rating} size={16} />
        <span className="muted small">{bus.ratings > 0 ? `${Number(bus.rating).toFixed(1)} (${bus.ratings})` : 'No rating yet'}</span>
      </span>
    </div>
  );
}

function BusFacts({ bus, children }) {
  const { settings } = useAuth();
  return (
    <dl className="facts">
      <div>
        <dt>Route</dt>
        <dd>{bus.route ?? '-'}</dd>
      </div>
      <div>
        <dt>Fare</dt>
        <dd>{formatMoney(bus.fare, settings.currency)}</dd>
      </div>
      <div>
        <dt>Seats</dt>
        <dd>{bus.seat_count}</dd>
      </div>
      <div>
        <dt>Usual departure</dt>
        <dd>{bus.departure_time || '-'}</dd>
      </div>
      {children}
      {bus.note && (
        <div>
          <dt>Note</dt>
          <dd>{bus.note}</dd>
        </div>
      )}
    </dl>
  );
}

function BusHeading({ bus }) {
  return (
    <div className="row between">
      <h3 className="row" style={{ gap: '0.5rem' }}>
        <Icon name="bus" />
        {bus.bus_number}
        {bus.model && <span className="muted small">{bus.model}</span>}
      </h3>
      <Status value={bus.status} />
    </div>
  );
}

// Route search: buses on matching routes, the bus with the best-rated guard first.
export function RouteSearch() {
  const [search, setSearch] = useState(null);
  // `n` only makes the address change, so searching the same words again asks the server again.
  const state = useFetch(search === null ? null : `/user/route-search${query({ q: search.text, n: search.n })}`);

  return (
    <>
      <h2>Route Search</h2>
      <FeatureGate feature="route_search">
        <SearchBox kind="route" label="Route name" placeholder="For example Central" results={state.data} onSearch={(text) => setSearch((prev) => ({ text, n: (prev?.n ?? 0) + 1 }))} />
        {search === null ? (
          <p className="muted">Search a route to see its buses. The bus whose guard has the best rating comes first.</p>
        ) : (
          <Async state={state} empty="No bus runs on a route with that name." emptyIcon="route">
            {(buses) => (
              <div className="cards">
                {buses.map((bus) => (
                  <article key={bus.id} className="card stack">
                    <BusHeading bus={bus} />
                    <GuardLine bus={bus} />
                    <BusFacts bus={bus}>
                      <div>
                        <dt>Parks</dt>
                        <dd>
                          {bus.park_a} ↔ {bus.park_b}
                        </dd>
                      </div>
                    </BusFacts>
                  </article>
                ))}
              </div>
            )}
          </Async>
        )}
      </FeatureGate>
    </>
  );
}

// Bus search: one bus by its number, with where it is now and when it should arrive.
export function BusSearch() {
  const [search, setSearch] = useState(null);
  const state = useFetch(search?.text ? `/user/bus-search${query({ number: search.text, n: search.n })}` : null);

  return (
    <>
      <h2>Bus Search</h2>
      <FeatureGate feature="bus_search">
        <SearchBox kind="bus" label="Bus number" placeholder="For example B-1001" results={state.data} onSearch={(text) => setSearch((prev) => ({ text, n: (prev?.n ?? 0) + 1 }))} />
        {!search?.text ? (
          <p className="muted">Enter a bus number to see its guard, its status and its current trip.</p>
        ) : (
          <Async state={state} empty="No bus has that number." emptyIcon="bus">
            {(buses) => (
              <div className="cards">
                {buses.map((bus) => (
                  <article key={bus.id} className="card stack">
                    <BusHeading bus={bus} />
                    <GuardLine bus={bus} />
                    <BusFacts bus={bus}>
                      <div>
                        <dt>Departure park</dt>
                        <dd>{bus.trip?.departure_park ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>Arrival park</dt>
                        <dd>{bus.trip?.arrival_park ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>Departure time</dt>
                        <dd>{bus.trip ? formatDateTime(bus.trip.departed_at ?? bus.trip.departure_at) : '-'}</dd>
                      </div>
                      <div>
                        <dt>{bus.trip?.arrived_at ? 'Arrived' : 'Forecast arrival time'}</dt>
                        <dd>{bus.trip ? formatDateTime(bus.trip.arrived_at ?? bus.trip.eta) : '-'}</dd>
                      </div>
                    </BusFacts>
                  </article>
                ))}
              </div>
            )}
          </Async>
        )}
      </FeatureGate>
    </>
  );
}
