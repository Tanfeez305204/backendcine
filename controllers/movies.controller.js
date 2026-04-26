const {
  getCache,
  getMoviesCacheKey,
  invalidateMovieListCache,
  setCache
} = require("../services/cache.service");
const {
  createMovie,
  deleteMovie,
  getCategories,
  getMovieById,
  listMovies,
  updateMovie
} = require("../services/movies.service");

const normalizeMovieListParams = (req) => ({
  page: Number(req.query.page || 1),
  limit: Number(req.query.limit || 20),
  search: req.query.search?.trim() || "",
  language: req.query.lang?.trim() || "",
  year: req.query.year ? Number(req.query.year) : undefined,
  sortBy: req.query.sortBy || "created_at",
  sortOrder: req.query.sortOrder || "desc",
  includeUnpublished: Boolean(req.admin),
  isPublished:
    req.query.isPublished === "true"
      ? true
      : req.query.isPublished === "false"
        ? false
        : undefined
});

const getMovies = async (req, res, next) => {
  try {
    const filters = normalizeMovieListParams(req);
    const cacheKey = await getMoviesCacheKey(filters);
    const cachedPayload = await getCache(cacheKey);

    if (cachedPayload) {
      return res.status(200).json({
        success: true,
        message: "Movies fetched successfully.",
        ...cachedPayload
      });
    }

    const movies = await listMovies(filters);

    await setCache(cacheKey, movies);

    return res.status(200).json({
      success: true,
      message: "Movies fetched successfully.",
      ...movies
    });
  } catch (error) {
    next(error);
  }
};

const getMovie = async (req, res, next) => {
  try {
    const movie = await getMovieById(req.params.id, Boolean(req.admin));

    if (!movie) {
      const error = new Error("Movie not found.");
      error.statusCode = 404;
      error.errors = [{ field: "id", message: "Movie not found." }];
      throw error;
    }

    res.status(200).json({
      success: true,
      message: "Movie fetched successfully.",
      data: movie
    });
  } catch (error) {
    next(error);
  }
};

const getMovieCategories = async (req, res, next) => {
  try {
    const categories = await getCategories();

    res.status(200).json({
      success: true,
      message: "Categories fetched successfully.",
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

const createMovieRecord = async (req, res, next) => {
  try {
    const movie = await createMovie(req.body);
    await invalidateMovieListCache();

    res.status(201).json({
      success: true,
      message: "Movie created successfully.",
      data: movie
    });
  } catch (error) {
    next(error);
  }
};

const updateMovieRecord = async (req, res, next) => {
  try {
    const movie = await updateMovie(req.params.id, req.body);
    await invalidateMovieListCache();

    res.status(200).json({
      success: true,
      message: "Movie updated successfully.",
      data: movie
    });
  } catch (error) {
    next(error);
  }
};

const deleteMovieRecord = async (req, res, next) => {
  try {
    const deletedMovie = await deleteMovie(req.params.id);

    if (!deletedMovie) {
      const error = new Error("Movie not found.");
      error.statusCode = 404;
      error.errors = [{ field: "id", message: "Movie not found." }];
      throw error;
    }

    await invalidateMovieListCache();

    res.status(200).json({
      success: true,
      message: "Movie deleted successfully.",
      data: deletedMovie
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMovies,
  getMovie,
  getMovieCategories,
  createMovieRecord,
  updateMovieRecord,
  deleteMovieRecord
};
