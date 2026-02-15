"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type FeedTrailer = {
  source: string;
  video_id: string;
  kind: string;
  is_official: boolean;
};

type FeedItem = {
  title_id: string;
  title: string;
  year: number | null;
  countries: string[];
  genres: string[];
  overview_short: string;
  poster_url: string | null;
  trailer: FeedTrailer | null;
};

type FeedResponse = {
  items: FeedItem[];
  next_cursor: string | null;
};

type CollectionResponse = {
  collections: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    items: FeedItem[];
  }[];
};

type AnalyticsEvent = {
  name: string;
  timestamp?: string;
  session_id?: string;
  user_id?: string;
  guest_id?: string;
  title_id?: string;
  trailer_id?: string;
  position_in_feed?: number;
  active_filters?: unknown;
  metadata?: unknown;
};

const typeOptions = [
  { label: "Peliculas", value: "movie" },
  { label: "Series", value: "tv" },
];

const genreOptions = [
  { label: "Thriller", value: "thriller" },
  { label: "Noir", value: "noir" },
  { label: "Drama", value: "drama" },
  { label: "Horror", value: "horror" },
  { label: "Misterio", value: "mystery" },
];

const countryOptions = [
  { label: "ES", value: "ES" },
  { label: "US", value: "US" },
  { label: "FR", value: "FR" },
  { label: "IT", value: "IT" },
];

const languageOptions = [
  { label: "ES", value: "es" },
  { label: "EN", value: "en" },
  { label: "FR", value: "fr" },
  { label: "IT", value: "it" },
];

const yearOptions = [
  { label: "1980-1999", min: 1980, max: 1999, value: "1980-1999" },
  { label: "2000-2010", min: 2000, max: 2010, value: "2000-2010" },
  { label: "2011-2020", min: 2011, max: 2020, value: "2011-2020" },
  { label: "2021-2025", min: 2021, max: 2025, value: "2021-2025" },
];

const moods = [
  "Tension",
  "Misterio",
  "Noir",
  "Cult",
  "Grindhouse",
  "Melancolia",
];

type FilterState = {
  type: "all" | "movie" | "tv";
  genres: string[];
  countries: string[];
  languages: string[];
  year: { label: string; min: number; max: number; value: string } | null;
};

const initialFilters: FilterState = {
  type: "all",
  genres: [],
  countries: [],
  languages: [],
  year: null,
};

const labelFor = (options: { label: string; value: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

const guestIdStorageKey = "reelio_guest_id";
const sessionIdStorageKey = "reelio_session_id";
const teaserStorageKey = "reelio_teaser_mode";
const teaserSeconds = 30;

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
};

const getOrCreateId = (storage: Storage, key: string) => {
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }
  const fresh = createId();
  storage.setItem(key, fresh);
  return fresh;
};

export default function Home() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filterState, setFilterState] = useState<FilterState>(initialFilters);
  const [identity, setIdentity] = useState<{
    guestId: string;
    sessionId: string;
  } | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike">>(
    {}
  );
  const [collections, setCollections] = useState<CollectionResponse["collections"]>(
    []
  );
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [teaserMode, setTeaserMode] = useState(false);
  const previousFilterRef = useRef<string | null>(null);

  const sharedTitleId = useMemo(() => {
    const value = searchParams.get("t");
    return value && value.trim().length > 0 ? value.trim() : null;
  }, [searchParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (filterState.type !== "all") {
      params.set("type", filterState.type);
    }
    if (filterState.genres.length > 0) {
      params.set("genres", filterState.genres.join(","));
    }
    if (filterState.countries.length > 0) {
      params.set("countries", filterState.countries.join(","));
    }
    if (filterState.languages.length > 0) {
      params.set("lang", filterState.languages.join(","));
    }
    if (filterState.year) {
      params.set("year_min", String(filterState.year.min));
      params.set("year_max", String(filterState.year.max));
    }

    return params.toString();
  }, [filterState]);

  const fetchFeed = useCallback(
    async (nextCursor?: string | null) => {
      const url = new URL("/api/v1/feed", window.location.origin);
      if (queryString) {
        url.search = queryString;
      }
      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("No se pudo cargar el feed.");
      }

      return (await response.json()) as FeedResponse;
    },
    [queryString]
  );

  const fetchTitleById = useCallback(async (titleId: string) => {
    const response = await fetch(`/api/v1/titles/${titleId}`);
    if (!response.ok) {
      throw new Error("No se pudo cargar el titulo.");
    }
    return (await response.json()) as { item: FeedItem };
  }, []);

  const fetchCollections = useCallback(async () => {
    const response = await fetch("/api/v1/collections");
    if (!response.ok) {
      throw new Error("No se pudieron cargar las colecciones.");
    }
    return (await response.json()) as CollectionResponse;
  }, []);

  useEffect(() => {
    const guestId = getOrCreateId(localStorage, guestIdStorageKey);
    const sessionId = getOrCreateId(sessionStorage, sessionIdStorageKey);
    setIdentity({ guestId, sessionId });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(teaserStorageKey);
    setTeaserMode(stored === "true");
  }, []);

  useEffect(() => {
    let active = true;

    setCollectionsLoading(true);
    setCollectionsError(null);

    fetchCollections()
      .then((data) => {
        if (!active) {
          return;
        }
        setCollections(data.collections);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Error inesperado";
        setCollectionsError(message);
      })
      .finally(() => {
        if (active) {
          setCollectionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchCollections]);

  useEffect(() => {
    if (!identity) {
      return;
    }

    const controller = new AbortController();

    const loadWatchlist = async () => {
      try {
        const response = await fetch(
          `/api/v1/me/watchlist?user_id=${identity.guestId}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("No se pudo cargar la watchlist.");
        }

        const data = (await response.json()) as {
          items: { title_id: string }[];
        };

        setSavedIds(new Set(data.items.map((item) => item.title_id)));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      }
    };

    loadWatchlist();

    return () => {
      controller.abort();
    };
  }, [identity]);

  const sendEvents = useCallback(
    async (events: AnalyticsEvent[]) => {
      if (!identity || events.length === 0) {
        return;
      }

      const payload = {
        events: events.map((event) => ({
          ...event,
          session_id: event.session_id ?? identity.sessionId,
          guest_id: event.guest_id ?? identity.guestId,
          timestamp: event.timestamp ?? new Date().toISOString(),
          active_filters: event.active_filters ?? filterState
        }))
      };

      try {
        if ("sendBeacon" in navigator) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json"
          });
          navigator.sendBeacon("/api/v1/events", blob);
          return;
        }

        await fetch("/api/v1/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch (err) {
        console.warn("Failed to send analytics event", err);
      }
    },
    [filterState, identity]
  );

  useEffect(() => {
    if (!identity) {
      return;
    }

    sendEvents([{ name: "app_open" }]);
  }, [identity, sendEvents]);

  const filterSignature = useMemo(
    () => JSON.stringify(filterState),
    [filterState]
  );

  useEffect(() => {
    if (previousFilterRef.current && previousFilterRef.current !== filterSignature) {
      sendEvents([
        {
          name: "filter_change",
          active_filters: filterState,
          metadata: {
            previous: JSON.parse(previousFilterRef.current)
          }
        }
      ]);
    }

    previousFilterRef.current = filterSignature;
  }, [filterSignature, filterState, sendEvents]);


  useEffect(() => {
    if (sharedTitleId) {
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);
    setItems([]);

    fetchFeed()
      .then((data) => {
        if (!active) {
          return;
        }
        setItems(data.items);
        setCursor(data.next_cursor);
        setCurrentIndex(0);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchFeed, reloadKey, sharedTitleId]);

  useEffect(() => {
    if (!sharedTitleId) {
      return;
    }

    let active = true;

    setLoading(true);
    setError(null);
    setItems([]);

    fetchTitleById(sharedTitleId)
      .then((data) => {
        if (!active) {
          return;
        }
        setItems([data.item]);
        setCursor(null);
        setCurrentIndex(0);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchTitleById, reloadKey, sharedTitleId]);

  const handleRetry = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const data = await fetchFeed(cursor);
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.next_cursor);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const emptyState = !loading && items.length === 0 && !error;
  const currentItem = items[currentIndex] ?? null;
  const trailerUrl = currentItem?.trailer?.video_id
    ? `https://www.youtube.com/watch?v=${currentItem.trailer.video_id}`
    : null;
  const trailerLink = useMemo(() => {
    if (!trailerUrl) {
      return null;
    }
    if (!teaserMode) {
      return trailerUrl;
    }
    const url = new URL(trailerUrl);
    url.searchParams.set("start", "0");
    url.searchParams.set("end", String(teaserSeconds));
    return url.toString();
  }, [teaserMode, trailerUrl]);

  useEffect(() => {
    if (!identity || !currentItem) {
      return;
    }

    sendEvents([
      {
        name: "feed_impression",
        title_id: currentItem.title_id,
        position_in_feed: currentIndex + 1
      }
    ]);
  }, [currentItem, currentIndex, identity, sendEvents]);

  const handleSaveToggle = useCallback(async () => {
    if (!currentItem || !identity) {
      return;
    }

    const titleId = currentItem.title_id;
    const userId = identity.guestId;
    const isSaved = savedIds.has(titleId);

    try {
      if (isSaved) {
        const response = await fetch(
          `/api/v1/me/watchlist/${titleId}?user_id=${userId}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          throw new Error("No se pudo quitar de la lista.");
        }

        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(titleId);
          return next;
        });

        sendEvents([
          {
            name: "unsave_watchlist",
            title_id: titleId,
            position_in_feed: currentIndex + 1
          }
        ]);
      } else {
        const response = await fetch(
          `/api/v1/me/watchlist/${titleId}?user_id=${userId}`,
          { method: "POST" }
        );

        if (!response.ok) {
          throw new Error("No se pudo guardar en la lista.");
        }

        setSavedIds((prev) => new Set(prev).add(titleId));
        sendEvents([
          {
            name: "save_watchlist",
            title_id: titleId,
            position_in_feed: currentIndex + 1
          }
        ]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    }
  }, [currentItem, currentIndex, identity, savedIds, sendEvents]);

  const handleFeedback = useCallback(
    (type: "like" | "dislike") => {
      if (!currentItem) {
        return;
      }

      const titleId = currentItem.title_id;
      setFeedback((prev) => ({
        ...prev,
        [titleId]: prev[titleId] === type ? prev[titleId] : type
      }));

      sendEvents([
        {
          name:
            type === "like"
              ? "feedback_more_like_this"
              : "feedback_less_like_this",
          title_id: titleId,
          position_in_feed: currentIndex + 1
        }
      ]);
    },
    [currentItem, currentIndex, sendEvents]
  );

  const handleShare = useCallback(async () => {
    if (!currentItem) {
      return;
    }

    const shareUrl = currentItem
      ? `${window.location.origin}/?t=${encodeURIComponent(currentItem.title_id)}`
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentItem.title,
          url: shareUrl
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }

      sendEvents([
        {
          name: "share_click",
          title_id: currentItem.title_id,
          position_in_feed: currentIndex + 1
        }
      ]);
    } catch (err) {
      console.warn("Share failed", err);
    }
  }, [currentItem, currentIndex, sendEvents, trailerUrl]);

  const handleToggleTeaser = () => {
    setTeaserMode((prev) => {
      const next = !prev;
      localStorage.setItem(teaserStorageKey, String(next));
      return next;
    });
  };

  const activeFilters = useMemo(() => {
    const tags: string[] = [];

    if (filterState.type !== "all") {
      tags.push(labelFor(typeOptions, filterState.type));
    }
    tags.push(...filterState.genres.map((value) => labelFor(genreOptions, value)));
    tags.push(
      ...filterState.countries.map((value) => labelFor(countryOptions, value))
    );
    tags.push(
      ...filterState.languages.map((value) => labelFor(languageOptions, value))
    );
    if (filterState.year) {
      tags.push(filterState.year.label);
    }

    return tags;
  }, [filterState]);

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      const nextIndex = prev > 0 ? prev - 1 : prev;
      if (nextIndex !== prev) {
        const nextItem = items[nextIndex];
        sendEvents([
          {
            name: "swipe_prev",
            title_id: nextItem?.title_id,
            position_in_feed: nextIndex + 1
          }
        ]);
      }
      return nextIndex;
    });
  };

  const handleNext = () => {
    setCurrentIndex((prev) => {
      const nextIndex = prev < items.length - 1 ? prev + 1 : prev;
      if (nextIndex !== prev) {
        const nextItem = items[nextIndex];
        sendEvents([
          {
            name: "swipe_next",
            title_id: nextItem?.title_id,
            position_in_feed: nextIndex + 1
          }
        ]);
      }
      return nextIndex;
    });
  };

  const toggleMulti = (
    key: "genres" | "countries" | "languages",
    value: string
  ) => {
    setFilterState((prev) => {
      const current = prev[key];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists
          ? current.filter((entry) => entry !== value)
          : [...current, value],
      };
    });
  };

  const toggleType = (value: "movie" | "tv") => {
    setFilterState((prev) => ({
      ...prev,
      type: prev.type === value ? "all" : value,
    }));
  };

  const toggleYear = (value: {
    label: string;
    min: number;
    max: number;
    value: string;
  }) => {
    setFilterState((prev) => ({
      ...prev,
      year: prev.year?.value === value.value ? null : value,
    }));
  };

  const isSaved = currentItem ? savedIds.has(currentItem.title_id) : false;
  const currentFeedback = currentItem ? feedback[currentItem.title_id] : undefined;

  return (
    <div className={styles.page}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.brand}>Reelio</span>
          <button
            className={styles.menuButton}
            type="button"
            onClick={() => setMenuOpen(false)}
          >
            Cerrar
          </button>
        </div>
        <nav className={styles.sidebarNav}>
          <a href="#">Mi feed</a>
          <a href="#">Mis listas</a>
          <a href="#">Buscar</a>
          <a href="#">Colecciones</a>
          <a href="#">Ajustes</a>
        </nav>
        <div className={styles.sidebarFooter}>
          <p>Preview 10-20s · Sin spoilers</p>
        </div>
      </aside>

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            Menu
          </button>
          <div className={styles.topbarTitle}>
            <span>Feed curado</span>
            <p>Descubre trailers con filtros y moods.</p>
          </div>
          <div className={styles.topbarActions}>
            <button
              className={`${styles.toggleButton} ${
                teaserMode ? styles.toggleActive : ""
              }`}
              type="button"
              onClick={handleToggleTeaser}
            >
              Teaser {teaserSeconds}s: {teaserMode ? "On" : "Off"}
            </button>
            <button className={styles.ghost} type="button">
              Buscar
            </button>
          </div>
        </header>

        <section className={styles.filters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Tipo</span>
            <div className={styles.filterRow}>
              {typeOptions.map((option) => (
                <button
                  className={`${styles.filterChip} ${
                    filterState.type === option.value ? styles.filterActive : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => toggleType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Genero</span>
            <div className={styles.filterRow}>
              {genreOptions.map((option) => (
                <button
                  className={`${styles.filterChip} ${
                    filterState.genres.includes(option.value)
                      ? styles.filterActive
                      : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => toggleMulti("genres", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Pais</span>
            <div className={styles.filterRow}>
              {countryOptions.map((option) => (
                <button
                  className={`${styles.filterChip} ${
                    filterState.countries.includes(option.value)
                      ? styles.filterActive
                      : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => toggleMulti("countries", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Ano</span>
            <div className={styles.filterRow}>
              {yearOptions.map((option) => (
                <button
                  className={`${styles.filterChip} ${
                    filterState.year?.value === option.value
                      ? styles.filterActive
                      : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => toggleYear(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Idioma</span>
            <div className={styles.filterRow}>
              {languageOptions.map((option) => (
                <button
                  className={`${styles.filterChip} ${
                    filterState.languages.includes(option.value)
                      ? styles.filterActive
                      : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => toggleMulti("languages", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.content}>
          <main className={styles.viewer}>
            {loading && (
              <div className={styles.skeletonViewer}>
                <div className={styles.skeletonPoster} />
                <div className={styles.skeletonRow}>
                  <span className={styles.skeletonChip} />
                  <span className={styles.skeletonChip} />
                </div>
                <div className={styles.skeletonRow}>
                  <span className={styles.skeletonPill} />
                  <span className={styles.skeletonPill} />
                  <span className={styles.skeletonPill} />
                </div>
              </div>
            )}
            {!loading && error && (
              <div className={styles.stateBlock}>
                <p className={styles.stateError}>
                  No pudimos cargar el feed. Reintenta en unos segundos.
                </p>
                <button
                  className={styles.retryButton}
                  type="button"
                  onClick={handleRetry}
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loading && emptyState && (
              <p className={styles.state}>
                No hay resultados con estos filtros. Prueba a quitar algun filtro.
              </p>
            )}

            {!loading && currentItem && (
              <>
                <div className={styles.trailerFrame}>
                  {currentItem.poster_url ? (
                    <img src={currentItem.poster_url} alt={currentItem.title} />
                  ) : (
                    <div className={styles.mediaFallback}>Sin poster</div>
                  )}
                  <div className={styles.mediaTag}>
                    {teaserMode ? `Teaser ${teaserSeconds}s` : "Trailer"}
                  </div>
                </div>
                <div className={styles.viewerControls}>
                  <button
                    className={styles.secondarySmall}
                    type="button"
                    onClick={handlePrev}
                  >
                    Anterior
                  </button>
                  <button
                    className={styles.primarySmall}
                    type="button"
                    onClick={handleNext}
                  >
                    Siguiente
                  </button>
                  <div className={styles.viewerMeta}>
                    {currentIndex + 1} / {items.length}
                  </div>
                </div>
                <div className={styles.moods}>
                  {moods.map((mood) => (
                    <button className={styles.moodChip} key={mood} type="button">
                      {mood}
                    </button>
                  ))}
                </div>
              </>
            )}
          </main>

          <aside className={styles.details}>
            {loading ? (
              <div className={styles.skeletonDetails}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
                <div className={styles.skeletonRow}>
                  <span className={styles.skeletonChip} />
                  <span className={styles.skeletonChip} />
                </div>
                <div className={styles.skeletonRow}>
                  <span className={styles.skeletonPill} />
                  <span className={styles.skeletonPill} />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.detailsHeader}>
                  <h2>{currentItem?.title ?? "Selecciona un trailer"}</h2>
                  <p>{currentItem?.overview_short || "Sinopsis pendiente."}</p>
                </div>
                <div className={styles.detailsMeta}>
                  <span>{currentItem?.year ?? "-"}</span>
                  <span>{currentItem?.countries.join(" · ") ?? "-"}</span>
                  <span>{currentItem?.genres.slice(0, 2).join(" / ") ?? "-"}</span>
                </div>
                <div className={styles.detailsActions}>
                  <button
                    className={`${styles.primarySmall} ${
                      isSaved ? styles.actionActive : ""
                    }`}
                    type="button"
                    onClick={handleSaveToggle}
                    disabled={!currentItem}
                  >
                    {isSaved ? "En lista" : "Guardar en lista"}
                  </button>
                  <button
                    className={`${styles.secondarySmall} ${
                      currentFeedback === "like" ? styles.actionActive : ""
                    }`}
                    type="button"
                    onClick={() => handleFeedback("like")}
                    disabled={!currentItem}
                  >
                    Mas como esto
                  </button>
                  <button
                    className={`${styles.secondarySmall} ${
                      currentFeedback === "dislike" ? styles.actionActive : ""
                    }`}
                    type="button"
                    onClick={() => handleFeedback("dislike")}
                    disabled={!currentItem}
                  >
                    Menos como esto
                  </button>
                  <button
                    className={styles.secondarySmall}
                    type="button"
                    onClick={handleShare}
                    disabled={!currentItem}
                  >
                    Compartir
                  </button>
                  {trailerLink ? (
                    <a
                      className={styles.link}
                      href={trailerLink}
                      onClick={() =>
                        sendEvents([
                          {
                            name: "trailer_play",
                            title_id: currentItem?.title_id,
                            position_in_feed: currentIndex + 1,
                            metadata: {
                              teaser_mode: teaserMode,
                              teaser_seconds: teaserSeconds
                            }
                          }
                        ])
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {teaserMode ? `Ver trailer (${teaserSeconds}s)` : "Ver trailer completo"}
                    </a>
                  ) : (
                    <span className={styles.muted}>Sin trailer</span>
                  )}
                </div>
                <div className={styles.detailsFilters}>
                  <h3>Filtros activos</h3>
                  <div className={styles.detailsTags}>
                    {activeFilters.length > 0 ? (
                      activeFilters.map((filter) => (
                        <span key={filter}>{filter}</span>
                      ))
                    ) : (
                      <span>Sin filtros</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>

        <footer className={styles.footer}>
          <button
            className={styles.loadMore}
            type="button"
            onClick={handleLoadMore}
            disabled={!cursor || loadingMore}
          >
            {loadingMore ? "Cargando..." : cursor ? "Cargar mas" : "Fin del feed"}
          </button>
        </footer>

        <section className={styles.collections}>
          <div className={styles.collectionsHeader}>
            <h3>Colecciones editoriales</h3>
            <p>Selecciones curadas para descubrir rapido.</p>
          </div>
          {collectionsLoading && (
            <p className={styles.collectionsState}>Cargando colecciones...</p>
          )}
          {!collectionsLoading && collectionsError && (
            <p className={styles.collectionsState}>{collectionsError}</p>
          )}
          {!collectionsLoading && !collectionsError && (
            <div className={styles.collectionsList}>
              {collections.map((collection) => (
                <div className={styles.collectionCard} key={collection.id}>
                  <div className={styles.collectionHead}>
                    <h4>{collection.title}</h4>
                    <span>{collection.description ?? "Seleccion curada"}</span>
                  </div>
                  <div className={styles.collectionItems}>
                    {collection.items.map((item) => (
                      <a
                        key={item.title_id}
                        className={styles.collectionItem}
                        href={`/?t=${encodeURIComponent(item.title_id)}`}
                      >
                        <div className={styles.collectionPoster}>
                          {item.poster_url ? (
                            <img src={item.poster_url} alt={item.title} />
                          ) : (
                            <div className={styles.mediaFallback}>Sin poster</div>
                          )}
                        </div>
                        <span>{item.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
