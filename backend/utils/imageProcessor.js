import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export const processImageWithSharp = async (file, options = {}) => {
  const {
    width = 800,
    height = 800,
    fit = 'inside',
    quality = 80,
    format = 'webp',
    outputDir = null
  } = options;

  try {
    // Generate new filename
    const originalExt = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const newFilename = `${path.parse(file.filename).name}_${uniqueSuffix}.${format}`;
    
    // Determine output path
    const outputPath = outputDir 
      ? path.join(outputDir, newFilename)
      : path.join(path.dirname(file.path), newFilename);
    
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Process image
    let sharpInstance = sharp(file.path);
    
    // Resize if dimensions provided
    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit,
        withoutEnlargement: true
      });
    }
    
    // Convert to desired format
    if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ 
        quality: Math.min(Math.max(quality, 1), 100),
        effort: 6 
      });
    } else if (format === 'jpeg' || format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ 
        quality: Math.min(Math.max(quality, 1), 100) 
      });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ 
        quality: Math.min(Math.max(quality, 1), 100)
      });
    } else {
      // Keep original format
      sharpInstance = sharpInstance;
    }
    
    // Save processed image
    await sharpInstance.toFile(outputPath);
    
    // Delete original file
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (unlinkError) {
      console.warn('Could not delete original file:', unlinkError.message);
    }
    
    // Get new file stats
    const stats = fs.statSync(outputPath);
    
    // Return new file info
    return {
      path: outputPath,
      filename: newFilename,
      originalname: path.parse(file.originalname).name + '.' + format,
      mimetype: format === 'webp' ? 'image/webp' : 
                format === 'jpeg' || format === 'jpg' ? 'image/jpeg' :
                format === 'png' ? 'image/png' : file.mimetype,
      size: stats.size,
      destination: path.dirname(outputPath)
    };
    
  } catch (error) {
    console.error('Image processing error:', error);
    // Don't throw if Sharp fails - keep original file
    return file;
  }
};