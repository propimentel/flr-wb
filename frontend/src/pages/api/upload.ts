import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Parse the incoming form data
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const uid = Array.isArray(fields.uid) ? fields.uid[0] : fields.uid;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const originalName = file.originalFilename || 'unknown';
    const extension = path.extname(originalName);
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${uid}-${originalName}`;
    const newPath = path.join(uploadsDir, uniqueFilename);

    // Move file to final destination
    fs.renameSync(file.filepath, newPath);

    // Return file metadata
    const fileUrl = `/uploads/${uniqueFilename}`;
    const response = {
      id: `file_${timestamp}`,
      url: fileUrl,
      name: originalName,
      size: file.size,
      type: file.mimetype || 'application/octet-stream',
      success: true
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
}
