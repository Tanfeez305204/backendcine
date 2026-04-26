const { normalizeSupabaseError, supabase } = require("../config/db");

const SORTABLE_COLUMNS = {
  title: "title",
  year: "year",
  created_at: "created_at"
};

const MOVIE_SELECT_COLUMNS = [
  "id",
  "title",
  "slug",
  "description",
  "language",
  "year",
  "rating",
  "genre",
  "thumbnail_url",
  "watch_url",
  "is_published",
  "view_count",
  "created_at",
  "updated_at"
].join(", ");

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const normalizeGenres = (genre) => {
  if (Array.isArray(genre)) {
    return genre
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(genre || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildMoviesQuery = ({ language, year, includeUnpublished, isPublished }) => {
  let queryBuilder = supabase.from("movies").select(MOVIE_SELECT_COLUMNS);

  if (!includeUnpublished) {
    queryBuilder = queryBuilder.eq("is_published", true);
  } else if (typeof isPublished === "boolean") {
    queryBuilder = queryBuilder.eq("is_published", isPublished);
  }

  if (language) {
    queryBuilder = queryBuilder.eq("language", language);
  }

  if (year) {
    queryBuilder = queryBuilder.eq("year", Number(year));
  }

  return queryBuilder;
};

const matchesSearch = (movie, search) => {
  if (!search) {
    return true;
  }

  const normalizedSearch = String(search).trim().toLowerCase();
  const searchableValues = [
    movie.title,
    movie.description,
    ...(Array.isArray(movie.genre) ? movie.genre : [])
  ];

  return searchableValues.some((value) =>
    String(value || "").toLowerCase().includes(normalizedSearch)
  );
};

const sortMovies = (movies, sortBy, sortOrder) => {
  const sortField = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS.created_at;
  const sortDirection = String(sortOrder || "desc").toUpperCase() === "ASC" ? 1 : -1;

  return [...movies].sort((left, right) => {
    const leftValue = left[sortField];
    const rightValue = right[sortField];

    if (leftValue < rightValue) {
      return -1 * sortDirection;
    }

    if (leftValue > rightValue) {
      return 1 * sortDirection;
    }

    return Number(right.id) - Number(left.id);
  });
};

const ensureUniqueSlug = async (title, year, excludeId = null) => {
  const baseSlug = `${slugify(title)}-${year}`;
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    let queryBuilder = supabase.from("movies").select("id").eq("slug", candidate).limit(1);

    if (excludeId) {
      queryBuilder = queryBuilder.neq("id", Number(excludeId));
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw normalizeSupabaseError(error, "Failed to generate a unique slug.");
    }

    if (!data?.length) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const listMovies = async ({
  page = 1,
  limit = 20,
  search,
  language,
  year,
  includeUnpublished = false,
  sortBy = "created_at",
  sortOrder = "desc",
  isPublished
}) => {
  try {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 20;
    const offset = (currentPage - 1) * currentLimit;
    const { data, error } = await buildMoviesQuery({
      language,
      year,
      includeUnpublished,
      isPublished
    });

    if (error) {
      throw normalizeSupabaseError(error, "Failed to fetch movies.");
    }

    const filteredMovies = (data || []).filter((movie) => matchesSearch(movie, search));
    const sortedMovies = sortMovies(filteredMovies, sortBy, sortOrder);
    const total = sortedMovies.length;
    const totalPages = total ? Math.ceil(total / currentLimit) : 0;
    const languageCounts = filteredMovies.reduce((accumulator, row) => {
      accumulator[row.language] = (accumulator[row.language] || 0) + 1;
      return accumulator;
    }, {});

    return {
      data: sortedMovies.slice(offset, offset + currentLimit),
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages,
      languageCounts
    };
  } catch (error) {
    throw error;
  }
};

const getMovieById = async (id, includeUnpublished = false) => {
  try {
    let queryBuilder = supabase
      .from("movies")
      .select(MOVIE_SELECT_COLUMNS)
      .eq("id", Number(id));

    if (!includeUnpublished) {
      queryBuilder = queryBuilder.eq("is_published", true);
    }

    const { data, error } = await queryBuilder.maybeSingle();

    if (error) {
      throw normalizeSupabaseError(error, "Failed to fetch movie.");
    }

    return data || null;
  } catch (error) {
    throw error;
  }
};

const getCategories = async () => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, color_hex")
      .order("name", { ascending: true });

    if (error) {
      throw normalizeSupabaseError(error, "Failed to fetch categories.");
    }

    return data || [];
  } catch (error) {
    throw error;
  }
};

const createMovie = async (payload) => {
  try {
    const slug = await ensureUniqueSlug(payload.title, payload.year);
    const genres = normalizeGenres(payload.genre);
    const { data, error } = await supabase
      .from("movies")
      .insert({
        title: payload.title.trim(),
        slug,
        description: payload.description.trim(),
        language: payload.language,
        year: Number(payload.year),
        rating: Number(payload.rating),
        genre: genres,
        thumbnail_url: payload.thumbnail_url || null,
        watch_url: payload.watch_url.trim(),
        is_published: Boolean(payload.is_published)
      })
      .select(MOVIE_SELECT_COLUMNS)
      .single();

    if (error) {
      throw normalizeSupabaseError(error, "Failed to create movie.");
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const updateMovie = async (id, payload) => {
  try {
    const { data: currentMovie, error: existingMovieError } = await supabase
      .from("movies")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();

    if (existingMovieError) {
      throw normalizeSupabaseError(existingMovieError, "Failed to fetch movie.");
    }

    if (!currentMovie) {
      const error = new Error("Movie not found.");
      error.statusCode = 404;
      error.errors = [{ field: "id", message: "Movie not found." }];
      throw error;
    }

    const nextTitle = payload.title ?? currentMovie.title;
    const nextYear = payload.year ?? currentMovie.year;
    const shouldRegenerateSlug =
      payload.title !== undefined || payload.year !== undefined;

    const slug = shouldRegenerateSlug
      ? await ensureUniqueSlug(nextTitle, nextYear, id)
      : currentMovie.slug;

    const { data, error } = await supabase
      .from("movies")
      .update({
        title: nextTitle.trim(),
        slug,
        description: (payload.description ?? currentMovie.description).trim(),
        language: payload.language ?? currentMovie.language,
        year: Number(payload.year ?? currentMovie.year),
        rating: Number(payload.rating ?? currentMovie.rating),
        genre: normalizeGenres(payload.genre ?? currentMovie.genre),
        thumbnail_url: payload.thumbnail_url ?? currentMovie.thumbnail_url,
        watch_url: (payload.watch_url ?? currentMovie.watch_url).trim(),
        is_published: payload.is_published ?? currentMovie.is_published,
        updated_at: new Date().toISOString()
      })
      .eq("id", Number(id))
      .select(MOVIE_SELECT_COLUMNS)
      .single();

    if (error) {
      throw normalizeSupabaseError(error, "Failed to update movie.");
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const deleteMovie = async (id) => {
  try {
    const { data, error } = await supabase
      .from("movies")
      .delete()
      .eq("id", Number(id))
      .select("id, title, slug")
      .maybeSingle();

    if (error) {
      throw normalizeSupabaseError(error, "Failed to delete movie.");
    }

    return data || null;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  listMovies,
  getMovieById,
  getCategories,
  createMovie,
  updateMovie,
  deleteMovie
};
