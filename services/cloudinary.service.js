const path = require("path");
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const sanitizePublicId = (filename) =>
  path
    .parse(filename || "thumbnail")
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "thumbnail";

const uploadThumbnailBuffer = async (buffer, filename) => {
  try {
    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER,
          resource_type: "image",
          public_id: `${sanitizePublicId(filename)}-${Date.now()}`,
          overwrite: false,
          format: "webp",
          transformation: [
            {
              width: 300,
              height: 450,
              crop: "fill",
              gravity: "auto"
            },
            {
              fetch_format: "webp",
              quality: "auto"
            }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  uploadThumbnailBuffer
};
