import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import formidable from 'formidable';
import path from 'path';

const { default: ollama } = require('ollama');

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ExtractedData {
  [key: string]: any;
}

const parseFile = async (filePath: string, mimeType: string): Promise<string> => {
  try {
    const fileBuffer = await fs.promises.readFile(filePath);

    if (mimeType === 'application/pdf') {
      const data = await pdfParse(fileBuffer);
      return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      return value;
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    throw new Error(`Error parsing file: ${error.message}`);
  }
};

const validateSchema = (schema: any): boolean => {
  const requiredFields = ['type', 'properties'];
  
  if (!schema || typeof schema !== 'object') {
    throw new Error('Schema must be a valid JSON object');
  }

  if (!requiredFields.every(field => field in schema)) {
    throw new Error('Schema must contain "type" and "properties" fields');
  }

  if (schema.type !== 'object') {
    throw new Error('Schema type must be "object"');
  }

  if (typeof schema.properties !== 'object') {
    throw new Error('Properties must be an object');
  }

  return true;
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

const ensureTempDir = async (): Promise<void> => {
  const tempDir = './tmp';
  if (!fs.existsSync(tempDir)) {
    await fs.promises.mkdir(tempDir, { recursive: true });
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
    await ensureTempDir();

    const form = formidable({
      uploadDir: './tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      filter: (part) => {
        return part.name === 'file' && 
          (part.mimetype?.includes('pdf') || 
           part.mimetype?.includes('document'));
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

    // Handle file upload
    if (files.file && Array.isArray(files.file)) {
      const file = files.file[0];
      uploadedFilePath = file.filepath;

      if (!file.mimetype) {
        throw new Error('File type not recognized');
      }

      documentText = await parseFile(file.filepath, file.mimetype);
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

    // Generate prompts based on schema structure
    const generatePrompt = (schema: any, documentText: string): string => {
      const extractionInstructions = Object.entries(schema.properties)
        .map(([key, value]: [string, any]) => {
          const type = value.type || 'string';
          return `- ${key} (${type}): Extract the most relevant ${type} value from the document.`;
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
`;
    };

    const prompt = generatePrompt(schema, documentText);

    const response = await ollama.chat({
      model: 'llama3',
      messages: [{ role: 'user', content: prompt }],
      format: schema,
    });

    let parsedContent: ExtractedData;
    try {
      parsedContent = JSON.parse(response.message?.content || '{}');

      // Validate the response matches the schema
      Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
        if (!(key in parsedContent)) {
          throw new Error(`Missing required field: ${key}`);
        }

        const expectedType = value.type;
        const actualValue = parsedContent[key];
        
        if (expectedType === 'array' && !Array.isArray(actualValue)) {
          throw new Error(`Field ${key} should be an array`);
        } else if (expectedType !== 'array' && typeof actualValue !== expectedType) {
          throw new Error(`Field ${key} should be of type ${expectedType}`);
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