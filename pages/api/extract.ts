import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import formidable from 'formidable';

const { default: ollama } = require('ollama');

// Disable Next.js's default body parser to handle FormData
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to parse file content
const parseFile = async (filePath: string, mimeType: string): Promise<string> => {
  const fileBuffer = await fs.promises.readFile(filePath);

  if (mimeType === 'application/pdf') {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    return value;
  }

  throw new Error('Unsupported file type');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Configure formidable to store files in a temporary directory
    const form = formidable({
      uploadDir: './tmp', // Directory to store uploaded files
      keepExtensions: true, // Preserve file extensions
      allowEmptyFiles: false, // Disallow empty files
    });

    // Parse the incoming form data
    const { fields, files }: any = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    console.log('Files:', files); // Debugging: Log the structure of files
    console.log('Fields:', fields); // Debugging: Log the structure of fields

    const headings = fields.headings && fields.headings[0];
    const text = fields.text || ''; // Handle plain text input

    if (!headings) {
      return res.status(400).json({ message: 'Headings are required.' });
    }

    let documentText = text;

    // If a file is uploaded, extract its content
    if (files.file && Array.isArray(files.file)) {
      const file = files.file[0]; // Access the first file from the array
      const filePath = file.filepath || file.path;

      if (!filePath) {
        return res.status(400).json({ message: 'File path is missing or invalid.' });
      }

      documentText = await parseFile(filePath, file.mimetype);
    }

    if (!documentText) {
      return res.status(400).json({ message: 'Document content is required.' });
    }

    // Build the JSON schema for structured output
    const headingList = headings.split(',').map((heading: string) => heading.trim());
    const schema = {
      type: 'object',
      properties: headingList.reduce((acc: any, heading: string) => {
        acc[heading] = { type: 'string' };
        return acc;
      }, {}),
      required: headingList,
    };

    // Enhanced prompt with detailed instructions
    const prompt = `
      Please extract the following information from the document below and ensure it is exact and accurate:
      ${headingList.map((heading) => `- ${heading}: Provide a very accurate, to-the-point, exact answer.`).join('\n')}
      
      Document:
      ${documentText}
    `;

    // Use the ollama.chat function to query the model
    const response = await ollama.chat({
      model: 'llama3',
      messages: [{ role: 'user', content: prompt }],
      format: schema,
    });

    // Parse the response content into JSON
    const content = response.message?.content || '{}';
    const parsedContent = JSON.parse(content);

    res.status(200).json(parsedContent);
  } catch (error) {
    console.error('Error querying Ollama:', error);
    res.status(500).json({ message: 'Error querying Ollama', error });
  }
}
