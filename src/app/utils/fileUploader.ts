import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
import ApiError from '../errors/AppError';
import httpStatus from 'http-status';

dotenv.config();

// Configure DigitalOcean Spaces
const s3Client = new S3Client({
  region: 'atl1',
  endpoint: process.env.DO_SPACE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.DO_SPACE_ACCESS_KEY || '',
    secretAccessKey: process.env.DO_SPACE_SECRET_KEY || '',
  },
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration using memoryStorage (for DigitalOcean & Cloudinary)
const storage = multer.memoryStorage();
// File filter for validation
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 50MB max
  },
});

// Upload single image
const uploadSingle = upload.single('image');
const uploadFile = upload.single('file');

// Upload multiple images
const uploadMultipleImage = upload.fields([{ name: 'images', maxCount: 15 }]);

const uploadToCloudinary = async (
  file: Express.Multer.File,
): Promise<{ Location: string; public_id: string }> => {
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'uploads',
        resource_type: 'auto', // Supports images, videos, etc.
        use_filename: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error) {
          console.error('Error uploading file to Cloudinary:', error);
          return reject(error);
        }

        // ✅ Explicitly return `Location` and `public_id`
        resolve({
          Location: result?.secure_url || '', // Cloudinary URL
          public_id: result?.public_id || '',
        });
      },
    );

    // Convert buffer to stream and upload
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

// ✅ Unchanged: DigitalOcean Upload
const uploadToDigitalOcean = async (file: Express.Multer.File) => {
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  try {
    const Key = `nathancloud/${Date.now()}_${uuidv4()}_${file.originalname}`;
    const uploadParams = {
      Bucket: process.env.DO_SPACE_BUCKET || '',
      Key,
      Body: file.buffer, // ✅ Use buffer instead of file path
      ACL: 'public-read' as ObjectCannedACL,
      ContentType: file.mimetype,
    };

    // Upload file to DigitalOcean Spaces
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Format the URL
    const fileURL = `${process.env.DO_SPACE_ENDPOINT}/${process.env.DO_SPACE_BUCKET}/${Key}`;
    return {
      Location: fileURL,
      Bucket: process.env.DO_SPACE_BUCKET || '',
      Key,
    };
  } catch (error) {
    console.error('Error uploading file to DigitalOcean:', error);
    throw error;
  }
};

//* upload with type
const FILE_LIMITS = {
  image: {
    size: 20 * 1024 * 1024,
    formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  }, // 5MB
  video: { size: 200 * 1024 * 1024, formats: ['mp4', 'mov', 'avi', 'webm'] }, // 50MB
  pdf: { size: 50 * 1024 * 1024, formats: ['pdf'] }, // 10MB
  voice: {
    size: 25 * 1024 * 1024,
    formats: ['webm', 'mp3', 'm4a', 'wav', 'ogg', 'opus'],
  },
};

const validateFile = (
  file: Express.Multer.File,
  fileType: 'image' | 'video' | 'pdf' | 'voice',
) => {
  const limit = FILE_LIMITS[fileType];
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (file.size > limit.size) {
    throw new Error(
      `${fileType} size exceeds ${limit.size / (1024 * 1024)}MB limit`,
    );
  }

  if (ext && !limit.formats.includes(ext)) {
    throw new Error(
      `Invalid ${fileType} format. Allowed: ${limit.formats.join(', ')}`,
    );
  }
};

const uploadToCloudinaryWithType = async (
  file: Express.Multer.File,
  fileType: 'image' | 'video' | 'pdf' | 'voice',
): Promise<{ Location: string; public_id: string; resource_type: string }> => {
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  // Validate file before upload
  validateFile(file, fileType);

  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder: `documents/${fileType}s`,
      use_filename: true,
      unique_filename: true,
      access_mode: 'public',
      overwrite: false,
    };

    // Type-specific configurations
    if (fileType === 'image') {
      uploadOptions.resource_type = 'image';
      uploadOptions.transformation = [
        { quality: 'auto', fetch_format: 'auto' }, // Auto optimization
      ];
    } else if (fileType === 'video') {
      uploadOptions.resource_type = 'video';
      uploadOptions.eager = [
        { quality: 'auto', format: 'mp4' }, // Convert to MP4
      ];
      uploadOptions.eager_async = true;
    } else if (fileType === 'pdf') {
      uploadOptions.resource_type = 'raw'; // PDFs are 'raw' type
      uploadOptions.format = 'pdf';
      uploadOptions.type = 'upload';
    } else if (fileType === 'voice') {
      uploadOptions.resource_type = 'video';
      uploadOptions.folder = 'documents/voices';
      uploadOptions.format = 'mp3';
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          if (error) {
            console.error(`Error uploading ${fileType} to Cloudinary:`, error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            return reject(error);
          }
          return reject(error);
        }

        resolve({
          Location: result?.secure_url || '',
          public_id: result?.public_id || '',
          resource_type: result?.resource_type || fileType || 'video',
        });
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const uploadToDigitalOceanWithType = async (
  file: Express.Multer.File,
  fileType: 'image' | 'video' | 'pdf',
): Promise<{
  Location: string;
  Bucket: string;
  Key: string;
  resource_type: string;
}> => {
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  validateFile(file, fileType);

  try {
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const sanitizedFileName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );

    // ✅ Just use filename without folder
    const Key = `${timestamp}_${uniqueId}_${sanitizedFileName}`;

    let contentType = file.mimetype;
    let contentDisposition = 'inline';

    if (fileType === 'pdf') {
      contentType = 'application/pdf';
      contentDisposition =
        'inline; filename="' + encodeURIComponent(file.originalname) + '"';
    } else if (fileType === 'video') {
      if (!contentType.startsWith('video/')) {
        contentType = 'video/mp4';
      }
    } else if (fileType === 'image') {
      if (!contentType.startsWith('image/')) {
        contentType = 'image/jpeg';
      }
    }

    const bucket = process.env.DO_SPACE_BUCKET || '';
    const region = process.env.DO_SPACE_REGION || 'atl1';

    const uploadParams = {
      Bucket: bucket,
      Key,
      Body: file.buffer,
      ACL: 'public-read' as ObjectCannedACL,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: 'max-age=31536000',
      Metadata: {
        originalname: file.originalname,
        filetype: fileType,
        uploadedAt: new Date().toISOString(),
      },
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const cdnEndpoint = process.env.DO_SPACE_CDN_ENDPOINT;
    const fileURL = cdnEndpoint
      ? `${cdnEndpoint}/${Key}`
      : `https://${bucket}.${region}.digitaloceanspaces.com/${Key}`;

    return {
      Location: fileURL,
      Bucket: bucket,
      Key,
      resource_type: fileType,
    };
  } catch (error: any) {
    console.error(`Error uploading ${fileType} to DigitalOcean:`, error);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Failed to upload ${fileType}: ${error.message || 'Upload failed'}`,
    );
  }
};

const uploadToZenexCloudWithType = async (
  file: Express.Multer.File,
  fileType: 'image' | 'video' | 'pdf',
): Promise<{ Location: string; Key: string; Bucket: string }> => {
  if (!file) {
    throw new Error('File is required for uploading.');
  }

  // Validate file before upload
  validateFile(file, fileType);

  // ZenexCloud S3 Configuration
  const endpoint = (
    process.env.ZENEX_ENDPOINT || 'http://vault.zenexcloud.com:9000'
  ).replace(/\/$/, '');
  const accessKeyId = process.env.ZENEX_ACCESS_KEY || '7SnO9zrkvWEacOSREMXI';
  const secretAccessKey =
    process.env.ZENEX_SECRET_KEY || '3SoY01MKsJqyGwlIuYVcPuMQrkMc3OjGco46Bkx9';
  const bucket = process.env.ZENEX_BUCKET;

  if (!bucket) {
    throw new Error('ZENEX_BUCKET is required and must be an existing bucket.');
  }

  const client = new S3Client({
    region: process.env.ZENEX_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    // Create organized folder structure based on file type
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const sanitizedFilename = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    const Key = `child-documents/${fileType}s/${timestamp}_${uniqueId}_${sanitizedFilename}`;

    // Upload parameters
    const uploadParams = {
      Bucket: bucket,
      Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Optional: Add metadata for better organization
      Metadata: {
        'original-name': file.originalname,
        'file-type': fileType,
        'upload-date': new Date().toISOString(),
      },
    };

    // Upload to ZenexCloud
    await client.send(new PutObjectCommand(uploadParams));

    // Generate public URL
    const publicEndpoint = (
      process.env.ZENEX_PUBLIC_ENDPOINT || endpoint
    ).replace(/\/$/, '');
    const fileURL = `${publicEndpoint}/${bucket}/${Key}`;

    console.log(`✅ Successfully uploaded ${fileType} to ZenexCloud:`, fileURL);

    return {
      Location: fileURL,
      Key,
      Bucket: bucket,
    };
  } catch (error) {
    console.error(`❌ Error uploading ${fileType} to ZenexCloud:`, error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
};

export const fileUploader = {
  upload,
  uploadSingle,
  uploadMultipleImage,
  uploadFile,
  uploadToCloudinary,
  uploadToDigitalOcean,
  uploadToCloudinaryWithType,
  uploadToDigitalOceanWithType,
  uploadToZenexCloudWithType,
};
