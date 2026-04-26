const { uploadThumbnailBuffer } = require("../services/cloudinary.service");

const uploadThumbnail = async (req, res, next) => {
  try {
    const result = await uploadThumbnailBuffer(req.file.buffer, req.file.originalname);

    res.status(201).json({
      success: true,
      message: "Thumbnail uploaded successfully.",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadThumbnail
};
