import { supabase } from './supabase';
import keksPostojeci from './keks.json';
import { useEffect, useMemo, useState } from 'react';
import trgovci from './trgovci.json';
import './App.css';

type Trgovac = {
  Naziv: string;
  OIB: string;
  MB: string;
  Adresa: string;
  'Vrsta subjekta': string;
};

type LeadStatus =
  | 'Nije kontaktiran'
  | 'Kontaktiran'
  | 'U tijeku'
  | 'Ugovoren'
  | 'Odbijen';

type Prioritet = 'Visok' | 'Srednji' | 'Nizak';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [vrstaFilter, setVrstaFilter] = useState('');
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({});
  const [priorities, setPriorities] = useState<Record<string, Prioritet>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [data, setData] = useState<Trgovac[]>([]);

  const postojeciOIBSet = useMemo(() => {
    const arr = (keksPostojeci as { OIB: string }[])
      .map((item) => String(item.OIB).trim())
      .filter((oib) => /^\d{11}$/.test(oib));

    return new Set(arr);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadTrgovci();
    }
  }, [session]);

  useEffect(() => {
    const savedStatuses = localStorage.getItem('keks-statuses');
    const savedPriorities = localStorage.getItem('keks-priorities');
    const savedNotes = localStorage.getItem('keks-notes');

    if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
    if (savedPriorities) setPriorities(JSON.parse(savedPriorities));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  useEffect(() => {
    localStorage.setItem('keks-statuses', JSON.stringify(statuses));
  }, [statuses]);

  useEffect(() => {
    localStorage.setItem('keks-priorities', JSON.stringify(priorities));
  }, [priorities]);

  useEffect(() => {
    localStorage.setItem('keks-notes', JSON.stringify(notes));
  }, [notes]);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Neispravan email ili lozinka.');
      console.error(error);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setData([]);
  };

  const loadTrgovci = async () => {
    const { data, error } = await supabase.from('trgovci').select('*');

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setData(
        data.map((item: any) => ({
          Naziv: item.naziv || '',
          OIB: item.oib || '',
          MB: item.mb || '',
          Adresa: item.adresa || '',
          'Vrsta subjekta': item.vrsta_subjekta || '',
        }))
      );
    }
  };

  const extractCity = (adresa: string) => {
    const parts = adresa.split(',');
    return parts[parts.length - 1]?.trim() || '';
  };

  const cities = useMemo(() => {
    const unique = new Set<string>();
    data.forEach((item) => unique.add(extractCity(item.Adresa)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'hr'));
  }, [data]);

  const vrste = useMemo(() => {
    const unique = new Set<string>();
    data.forEach((item) => unique.add(item['Vrsta subjekta']));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'hr'));
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const itemOib = String(item.OIB).trim();
      const isExistingKeksMerchant = postojeciOIBSet.has(itemOib);

      const haystack =
        `${item.Naziv} ${item.OIB} ${item.MB} ${item.Adresa} ${item['Vrsta subjekta']}`.toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesCity =
        !cityFilter || extractCity(item.Adresa) === cityFilter;
      const matchesVrsta =
        !vrstaFilter || item['Vrsta subjekta'] === vrstaFilter;

      return (
        matchesSearch && matchesCity && matchesVrsta && !isExistingKeksMerchant
      );
    });
  }, [data, search, cityFilter, vrstaFilter, postojeciOIBSet]);

  const dashboard = useMemo(() => {
    return {
      total: filtered.length,
      nijeKontaktiran: filtered.filter(
        (item) =>
          (statuses[item.OIB] || 'Nije kontaktiran') === 'Nije kontaktiran'
      ).length,
      kontaktiran: filtered.filter(
        (item) => (statuses[item.OIB] || 'Nije kontaktiran') === 'Kontaktiran'
      ).length,
      uTijeku: filtered.filter(
        (item) => (statuses[item.OIB] || 'Nije kontaktiran') === 'U tijeku'
      ).length,
      ugovoren: filtered.filter(
        (item) => (statuses[item.OIB] || 'Nije kontaktiran') === 'Ugovoren'
      ).length,
      visokPrioritet: filtered.filter(
        (item) => (priorities[item.OIB] || 'Srednji') === 'Visok'
      ).length,
    };
  }, [filtered, statuses, priorities]);

  const cityStats = useMemo(() => {
    const counts: Record<string, number> = {};

    filtered.forEach((item) => {
      const city = extractCity(item.Adresa) || 'Nepoznato';
      counts[city] = (counts[city] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const setStatus = (oib: string, value: LeadStatus) => {
    setStatuses((prev) => ({ ...prev, [oib]: value }));
  };

  const setPriority = (oib: string, value: Prioritet) => {
    setPriorities((prev) => ({ ...prev, [oib]: value }));
  };

  const setNote = (oib: string, value: string) => {
    setNotes((prev) => ({ ...prev, [oib]: value }));
  };

  if (authLoading) {
    return <div style={{ padding: 40 }}>Učitavanje...</div>;
  }

  if (!session) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #e8f5e9 0%, #ffffff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: 380,
            background: '#fff',
            padding: 28,
            borderRadius: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            border: '1px solid #dfeee3',
          }}
        >
          <h1 style={{ marginTop: 0, color: '#0b5d2a' }}>KEKS Pay</h1>
          <p style={{ color: '#4f6b57' }}>Prijava u aplikaciju za prodaju</p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 15,
            }}
          />

          <input
            type="password"
            placeholder="Lozinka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 16,
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 15,
            }}
          />

          <button
            onClick={login}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(90deg, #009624 0%, #00c853 100%)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            Prijavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #e8f5e9 0%, #ffffff 100%)',
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#111',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(90deg, #003d1f 0%, #00c853 100%)',
            color: '#fff',
            padding: '18px 24px',
            borderRadius: 16,
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 10px 24px rgba(0,200,83,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#7dffb1',
                boxShadow: '0 0 0 6px rgba(125,255,177,0.22)',
              }}
            />
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              KEKS Pay aplikacija za prodaju
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Odjava
          </button>
        </div>

        <h1 style={{ marginBottom: 6, fontSize: 34, color: '#0b5d2a' }}>
          KEKS Pay
        </h1>

        <p
          style={{
            marginTop: 0,
            color: '#4f6b57',
            marginBottom: 24,
            fontSize: 17,
          }}
        >
          Pregled leadova - godišnji promet veći od 900.000 €
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <DashboardCard title="Ukupno" value={dashboard.total} />
          <DashboardCard
            title="Nije kontaktiran"
            value={dashboard.nijeKontaktiran}
          />
          <DashboardCard title="Kontaktiran" value={dashboard.kontaktiran} />
          <DashboardCard title="U tijeku" value={dashboard.uTijeku} />
          <DashboardCard title="Ugovoren" value={dashboard.ugovoren} />
          <DashboardCard
            title="Visok prioritet"
            value={dashboard.visokPrioritet}
          />
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: 16,
            border: '1px solid #ddd',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            marginBottom: 24,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Top gradovi po broju leadova</h3>

          <div style={{ display: 'grid', gap: 8 }}>
            {cityStats.map((item) => (
              <button
                key={item.city}
                onClick={() => setCityFilter(item.city)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#f8f9fb',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: 14,
                }}
              >
                <span>{item.city}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <input
            type="text"
            placeholder="Pretraži po nazivu, OIB-u, adresi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
            }}
          />

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              background: '#fff',
            }}
          >
            <option value="">Svi gradovi</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            value={vrstaFilter}
            onChange={(e) => setVrstaFilter(e.target.value)}
            style={{
              padding: '12px',
              borderRadius: 10,
              border: '1px solid #ccc',
              fontSize: 16,
              background: '#fff',
            }}
          >
            <option value="">Sve vrste subjekta</option>
            {vrste.map((vrsta) => (
              <option key={vrsta} value={vrsta}>
                {vrsta}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => {
              setSearch('');
              setCityFilter('');
              setVrstaFilter('');
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(90deg, #009624 0%, #00c853 100%)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Reset filtera
          </button>
        </div>

        <div style={{ marginBottom: 16, fontWeight: 700 }}>
          Broj rezultata: {filtered.length}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.slice(0, 200).map((item, index) => {
            const currentStatus = statuses[item.OIB] || 'Nije kontaktiran';
            const currentPriority = priorities[item.OIB] || 'Srednji';
            const currentNote = notes[item.OIB] || '';

            return (
              <div
                key={`${item.OIB}-${index}`}
                style={{
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: '0.2s',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>
                  {item.Naziv}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 24,
                    marginTop: 12,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>OIB:</strong> {item.OIB}
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <strong>MB:</strong> {item.MB}
                    </div>

                    <div>
                      <strong>Vrsta subjekta:</strong> {item['Vrsta subjekta']}
                    </div>
                  </div>

                  <div style={{ justifySelf: 'end', minWidth: 420 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Adresa:</strong>{' '}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          item.Adresa + ' Croatia'
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#009624',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {item.Adresa}
                      </a>
                    </div>

                    <div>
                      <strong style={{ display: 'inline-block', width: 67 }}>
                        Grad:
                      </strong>
                      <span>{extractCity(item.Adresa)}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    alignItems: 'start',
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Status lead-a
                    </label>
                    <select
                      value={currentStatus}
                      onChange={(e) =>
                        setStatus(item.OIB, e.target.value as LeadStatus)
                      }
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                      }}
                    >
                      <option>Nije kontaktiran</option>
                      <option>Kontaktiran</option>
                      <option>U tijeku</option>
                      <option>Ugovoren</option>
                      <option>Odbijen</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Prioritet
                    </label>
                    <select
                      value={currentPriority}
                      onChange={(e) =>
                        setPriority(item.OIB, e.target.value as Prioritet)
                      }
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                      }}
                    >
                      <option>Visok</option>
                      <option>Srednji</option>
                      <option>Nizak</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Bilješke prodaje
                  </label>
                  <textarea
                    value={currentNote}
                    onChange={(e) => setNote(item.OIB, e.target.value)}
                    placeholder="Upiši bilješku..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      resize: 'vertical',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: number }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRadius: 14,
        border: 'none',
        background:
          'linear-gradient(135deg, #009624 0%, #00c853 60%, #00e676 100%)',
        color: '#fff',
        boxShadow: '0 8px 20px rgba(0,200,83,0.22)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.9)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

