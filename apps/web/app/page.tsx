"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const filters = [
  "Peliculas",
  "Series",
  "Thriller",
  "Noir",
  "Cine ES",
  "1980-1999",
];

export default function Home() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async (nextCursor?: string | null) => {
    const url = new URL("/api/v1/feed", window.location.origin);
    if (nextCursor) {
      url.searchParams.set("cursor", nextCursor);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error("No se pudo cargar el feed.");
    }

    return (await response.json()) as FeedResponse;
  }, []);

  useEffect(() => {
    let active = true;

    fetchFeed()
      .then((data) => {
        if (!active) {
          return;
        }
        setItems(data.items);
        setCursor(data.next_cursor);
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
  }, [fetchFeed]);

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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Reelio</p>
          <h1>Un feed de trailers con criterio.</h1>
          <p className={styles.subtitle}>
            Descubre en segundos, filtra con intencion y guarda lo que quieres
            ver hoy.
          </p>
        </div>
        <div className={styles.heroCard}>
          <span className={styles.heroBadge}>Preview 10-20s</span>
          <p className={styles.heroTitle}>Sin spoilers, solo el gancho.</p>
          <p className={styles.heroCopy}>
            Personaliza el feed con "Mas como esto" y "Menos como esto".
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primary}>Explorar ahora</button>
            <button className={styles.ghost}>Ver colecciones</button>
          </div>
        </div>
      </header>

      <section className={styles.filters}>
        {filters.map((filter) => (
          <button className={styles.filterChip} key={filter} type="button">
            {filter}
          </button>
        ))}
      </section>

      <main className={styles.feed}>
        {loading && <p className={styles.state}>Cargando feed...</p>}
        {error && <p className={styles.stateError}>{error}</p>}
        {emptyState && (
          <p className={styles.state}>No hay resultados con estos filtros.</p>
        )}

        {items.map((item, index) => {
          const trailerUrl = item.trailer?.video_id
            ? `https://www.youtube.com/watch?v=${item.trailer.video_id}`
            : null;

          return (
            <article className={styles.card} key={item.title_id}>
              <div className={styles.cardMedia}>
                {item.poster_url ? (
                  <img
                    src={item.poster_url}
                    alt={item.title}
                    loading={index < 2 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className={styles.mediaFallback}>Sin poster</div>
                )}
                <div className={styles.mediaTag}>Trailer</div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <span>{item.year ?? "-"}</span>
                  <span>{item.countries.join(" · ")}</span>
                  <span>{item.genres.slice(0, 2).join(" / ")}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.overview_short || "Sinopsis pendiente."}</p>
                <div className={styles.cardActions}>
                  <button className={styles.primarySmall} type="button">
                    Guardar
                  </button>
                  <button className={styles.secondarySmall} type="button">
                    Mas como esto
                  </button>
                  <button className={styles.secondarySmall} type="button">
                    Menos como esto
                  </button>
                  {trailerUrl ? (
                    <a className={styles.link} href={trailerUrl}>
                      Ver trailer
                    </a>
                  ) : (
                    <span className={styles.muted}>Sin trailer</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </main>

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
    </div>
  );
}
