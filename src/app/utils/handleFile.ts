import httpStatus from 'http-status';
import ApiError from '../errors/AppError';
import { fileUploader } from './fileUploader';

export type UploadedFiles = {
  image?: string;
  video?: string;
  pdf?: string;
  files?: string;
};

export const handleFileUploads = async (
  files: { [fieldname: string]: Express.Multer.File[] } | undefined,
): Promise<UploadedFiles> => {
  const uploadedFiles: UploadedFiles = {};

  try {
    if (files?.image?.[0]) {
      const upload = await fileUploader.uploadToCloudinaryWithType(
        files.image[0],
        'image',
      );
      uploadedFiles.image = upload.Location;
    }
    if (files?.video?.[0]) {
      const upload = await fileUploader.uploadToCloudinaryWithType(
        files.video[0],
        'video',
      );
      uploadedFiles.video = upload.Location;
    }
    if (files?.pdf?.[0]) {
      const upload = await fileUploader.uploadToCloudinaryWithType(
        files.pdf[0],
        'pdf',
      );
      uploadedFiles.pdf = upload.Location;
    }
    if (files?.files?.[0]) {
      const file = files.files[0];
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      let fileType: 'image' | 'video' | 'pdf' = 'pdf';
      if (['jpg', 'jpeg', 'png', 'webp','heic'].includes(ext || ''))
        fileType = 'image';
      else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || ''))
        fileType = 'video';
      const upload = await fileUploader.uploadToCloudinaryWithType(
        file,
        fileType,
      );
      uploadedFiles.files = upload.Location;
    }
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to upload file', error);
  }

  return uploadedFiles;
};
