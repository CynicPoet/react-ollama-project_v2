import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import formidable from 'formidable';
import { createWorker } from 'tesseract.js';
import xlsx from 'xlsx';
import csvParse from 'csv-parse/sync';
import sharp from 'sharp';

const { default: ollama } = require('ollama');

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ExtractedData {
  [key: string]: any;
}

interface FileProcessor {
  mimeType: string[];
  process: (buffer: Buffer) => Promise<string>;
}

// File processors for different file types
const fileProcessors: Record<string, FileProcessor> = {
  pdf: {
    mimeType: ['application/pdf'],
    process: async (buffer) => {
      const data = await pdfParse(buffer);
      return data.text;
    }
  },
  word: {
    mimeType: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ],
    process: async (buffer) => {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
  },
  image: {
    mimeType: ['image/jpeg', 'image/png', 'image/tiff'],
    process: async (buffer) => {
      // Convert image to PNG format for better OCR
      const pngBuffer = await sharp(buffer)
        .toFormat('png')
        .toBuffer();

      // Perform OCR
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(pngBuffer);
      await worker.terminate();
      return text;
    }
  },
  excel: {
    mimeType: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    process: async (buffer) => {
      const workbook = xlsx.read(buffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      return xlsx.utils.sheet_to_csv(firstSheet);
    }
  },
  text: {
    mimeType: ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/rtf'],
    process: async (buffer) => buffer.toString('utf-8')
  }
};

const processFile = async (buffer: Buffer, mimeType: string): Promise<string> => {
  const processor = Object.values(fileProcessors).find(p => 
    p.mimeType.includes(mimeType)
  );

  if (!processor) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  try {
    return await processor.process(buffer);
  } catch (error) {
    throw new Error(`Error processing file: ${error.message}`);
  }
};

const validateSchema = (schema: any): void => {
  if (!schema || typeof schema !== 'object') {
    throw new Error('Invalid schema: must be an object');
  }

  if (schema.type !== 'object') {
    throw new Error('Schema type must be "object"');
  }

  if (!schema.properties || typeof schema.properties !== 'object') {
    throw new Error('Schema must contain "properties" object');
  }

  // Validate property types
  Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
    if (!value.type) {
      throw new Error(`Property "${key}" must specify a type`);
    }
    
    if (!['string', 'number', 'boolean', 'array', 'object'].includes(value.type)) {
      throw new Error(`Property "${key}" has invalid type: ${value.type}`);
    }
  });
};

const generatePrompt = (schema: any, documentText: string): string => {
  const extractionInstructions = Object.entries(schema.properties)
    .map(([key, value]: [string, any]) => {
      const type = value.type;
      const description = value.description || `Extract the most relevant ${type} value`;
      return `- ${key} (${type}): ${description}`;
    })
    .join('\n');

  return `
Analyze the following document and extract information according to the specified structure.
Return the information in the EXACT format specified, maintaining the exact same property names.

Required information:
${extractionInstructions}

Schema structure for reference:
${JSON.stringify(schema, null, 2)}

Document text:
${documentText}

Important: 
1. Ensure the output matches the schema structure EXACTLY
2. Return ONLY valid JSON
3. Use the EXACT same property names as provided
4. Match the expected data types for each field
5. For non-obvious or uncertain values, make best estimates based on context
6. If a value is not found, use a reasonable default for the type
`;
};

const cleanupFile = async (filepath: string): Promise<void> => {
  try {
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  let uploadedFilePath: string | null = null;

  try {
    // Ensure temp directory exists
    const tempDir = './tmp';
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const form = formidable({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      filter: part => {
        return part.name === 'file' && 
          Object.values(fileProcessors).some(processor => 
            processor.mimeType.includes(part.mimetype || ''));
      },
    });

    const { fields, files }: any = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const mode = fields.mode?.[0];
    const text = fields.text?.[0] || '';
    let documentText = text;
    let schema: any;

    // Handle file processing
    if (files.file && Array.isArray(files.file)) {
      const file = files.file[0];
      uploadedFilePath = file.filepath;

      if (!file.mimetype) {
        throw new Error('File type not recognized');
      }

      const fileBuffer = await fs.promises.readFile(file.filepath);
      documentText = await processFile(fileBuffer, file.mimetype);
    }

    if (!documentText) {
      throw new Error('Document content is required');
    }

    // Process based on mode
    if (mode === 'headings') {
      const headings = fields.headings?.[0];
      if (!headings) {
        throw new Error('Headings are required in headings mode');
      }

      const headingList = headings.split(',').map((heading: string) => heading.trim());
      schema = {
        type: 'object',
        properties: headingList.reduce((acc: any, heading: string) => {
          acc[heading] = { type: 'string' };
          return acc;
        }, {}),
        required: headingList,
      };
    } else if (mode === 'json') {
      const jsonStructure = fields.jsonStructure?.[0];
      if (!jsonStructure) {
        throw new Error('JSON structure is required in JSON mode');
      }

      try {
        schema = JSON.parse(jsonStructure);
        validateSchema(schema);
      } catch (error) {
        throw new Error(`Invalid JSON structure: ${error.message}`);
      }
    } else {
      throw new Error('Invalid mode specified');
    }

    // Process with LLM
    const prompt = generatePrompt(schema, documentText);
    const response = await ollama.chat({
      model: 'llama3',
      messages: [{ role: 'user', content: prompt }],
      format: schema,
    });

    // Parse and validate response
    let parsedContent: ExtractedData;
    try {
      parsedContent = JSON.parse(response.message?.content || '{}');

      // Validate response against schema
      Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
        if (!(key in parsedContent)) {
          parsedContent[key] = value.type === 'array' ? [] : 
                             value.type === 'object' ? {} :
                             value.type === 'number' ? 0 :
                             value.type === 'boolean' ? false : '';
        }

        const actualValue = parsedContent[key];
        if (value.type === 'array' && !Array.isArray(actualValue)) {
          throw new Error(`Field ${key} should be an array`);
        } else if (value.type !== 'array' && typeof actualValue !== value.type) {
          throw new Error(`Field ${key} should be of type ${value.type}`);
        }
      });
    } catch (error) {
      throw new Error(`Error processing model response: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      data: parsedContent
    });
  } catch (error: any) {
    console.error('Error processing request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    });
  } finally {
    // Cleanup uploaded file
    if (uploadedFilePath) {
      await cleanupFile(uploadedFilePath);
    }
  }
}