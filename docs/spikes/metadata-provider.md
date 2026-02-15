# Spike: metadata + trailers provider

## Objetivo
Definir de donde salen los trailers y la metadata (titulos, filtros) y proponer una clasificacion inicial de moods.

## Recomendacion (MVP)
- Fuente principal: TMDB (metadata + lista de videos por titulo).
- Reproduccion: YouTube usando el `key` devuelto por TMDB (embed oficial, sin alojar video).

TMDB expone videos para peliculas y series, con campos como `key`, `site`, `type` y `official`, utiles para seleccionar trailer oficial.
- Movie videos: https://developer.themoviedb.org/reference/movie-videos
- TV videos: https://developer.themoviedb.org/reference/tv-series-videos

## Mapping de datos (TMDB -> Reelio)
- `title`/`name` -> `title`
- `original_title`/`original_name` -> `original_title`
- `release_date`/`first_air_date` -> `year`
- `genre_ids` -> `genres[]` (mapear por catalogo de generos)
- `origin_country` + `production_countries` -> `countries[]`
- `original_language` + traducciones disponibles -> `languages[]`
- `overview` -> `overview`
- `poster_path`/`backdrop_path` -> `poster_url`/`backdrop_url`
- Videos (TMDB): filtrar por `site == YouTube`, priorizar `official == true` y `type` == Trailer > Teaser > Clip

## Clasificacion por filtros
Los filtros actuales se pueden derivar directamente de TMDB:
- Tipo: movie/tv por endpoint de origen (discover movie/tv).
- Genero: `genre_ids`.
- Pais: `origin_country` o `production_countries`.
- Ano: `release_date`/`first_air_date`.
- Idioma: `original_language` (y opcionalmente `spoken_languages`).

## Clasificacion por moods (heuristicas iniciales)
Propuesta: calcular moods con reglas simples sobre generos + keywords + overview.

Ejemplo de reglas (MVP):
- Noir: genero noir + keywords como "detective", "crime", "neo-noir".
- Tension: thriller + keywords "pursuit", "hostage", "survival".
- Misterio: mystery + keywords "whodunit", "clue", "investigation".
- Cult: keywords "cult", "midnight", "underground".
- Grindhouse: keywords "exploitation", "grindhouse", "splatter".
- Melancolia: drama + keywords "loss", "grief", "lonely".

Nota: mantener tabla interna editable para afinar sin cambiar proveedor.

## Alternativas (para evaluar)
- TheTVDB / Trakt / IMDb: pueden complementar metadata, pero requeriran validar licencias, costes y limites de uso.
- JustWatch: solo si se prioriza "donde verla" en una fase posterior.

## Riesgos
- Cobertura de trailers oficiales depende de la calidad del catalogo de TMDB.
- Ciertos titulos pueden no tener video en TMDB o no ser oficiales.
- Necesario validar limites de uso y atribucion del proveedor elegido.

## Next steps
1) Confirmar politicas de uso y atribucion de TMDB (y YouTube embed).
2) Implementar adaptador TMDB y un selector de trailer "best".
3) Definir tabla de moods interna y ajustar reglas con datos reales.
