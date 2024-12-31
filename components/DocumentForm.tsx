import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, Copy, CheckCircle2, Terminal, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface JsonError {
  line: number;
  message: string;
  position: number;
}

const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg,.jpeg',
  'image/png': '.png',
  'image/tiff': '.tiff',
  'application/msword': '.doc',
  'application/rtf': '.rtf',
  'text/markdown': '.md',
  'application/json': '.json'
};

const DocumentForm = () => {
  const [document, setDocument] = useState('');
  const [headings, setHeadings] = useState('');
  const [jsonStructure, setJsonStructure] = useState('{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "content": { "type": "string" }\n  }\n}');
  const [output, setOutput] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('headings');
  const [jsonError, setJsonError] = useState<JsonError | null>(null);
  const [copied, setCopied] = useState({ output: false, json: false });
  const [jsonValid, setJsonValid] = useState(true);

  useEffect(() => {
    validateJsonStructure(jsonStructure);
  }, [jsonStructure]);

  const handleFileChange = (event) => {
    const uploadedFile = event.target.files?.[0] || null;
    if (uploadedFile && uploadedFile.size > 25 * 1024 * 1024) {
      setError('File size must be less than 25MB');
      return;
    }
    setFile(uploadedFile);
    setDocument('');
    setError('');
  };

  const validateJsonStructure = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.type || !parsed.properties) {
        throw new Error('JSON must include "type" and "properties" fields');
      }
      setJsonError(null);
      setJsonValid(true);
      return true;
    } catch (e) {
      const error = e as SyntaxError;
      const match = error.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      const lines = jsonString.slice(0, position).split('\n');
      setJsonError({
        line: lines.length,
        message: error.message,
        position: position - jsonString.slice(0, position).lastIndexOf('\n')
      });
      setJsonValid(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOutput(null);
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'json' && !validateJsonStructure(jsonStructure)) {
        throw new Error('Invalid JSON structure');
      }

      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('text', document);
      }
      
      formData.append(activeTab === 'headings' ? 'headings' : 'jsonStructure', 
                     activeTab === 'headings' ? headings : jsonStructure);
      formData.append('mode', activeTab);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
      }

      setOutput(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (type: 'output' | 'json') => {
    const text = type === 'output' ? JSON.stringify(output, null, 2) : jsonStructure;
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [type]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [type]: false })), 2000);
  };

  const syntaxHighlight = (json: string) => {
    if (!json) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],])/g, 
      function (match) {
        if (/^[{}\[\],]$/.test(match)) {
          return `<span class="text-white">${match}</span>`;
        }
        const cls = /^"/.test(match) 
          ? (/:$/.test(match) ? 'text-pink-400' : 'text-amber-400')
          : /true|false/.test(match) 
            ? 'text-purple-400' 
            : /null/.test(match)
              ? 'text-gray-400'
              : 'text-emerald-400';
        return `<span class="${cls}">${match}</span>`;
      });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-zinc-50">
      <CardHeader className="bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Document Information Extractor</CardTitle>
            <CardDescription className="mt-1.5">
              Upload a document or paste text and choose your preferred extraction method
            </CardDescription>
          </div>
          <Terminal className="h-6 w-6 text-zinc-500" />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2">
                <Label htmlFor="file" className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="h-4 w-4" />
                  Upload File
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-zinc-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Supports PDF, DOCX, TXT, CSV, XLS, XLSX, Images (JPG, PNG, TIFF), DOC, RTF, MD, JSON</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="mt-2">
                <Input
                  id="file"
                  type="file"
                  accept={Object.values(SUPPORTED_FILE_TYPES).join(',')}
                  onChange={handleFileChange}
                  className="cursor-pointer file:bg-zinc-100 file:text-zinc-700 file:border-0 file:rounded"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <Label htmlFor="text" className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Or Paste Text
              </Label>
              <Textarea
                id="text"
                value={document}
                onChange={(e) => {
                  setDocument(e.target.value);
                  setFile(null);
                  setError('');
                }}
                disabled={!!file}
                className="mt-2 min-h-[150px] font-mono text-sm"
                placeholder="Paste your document or paragraph here"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-100">
                <TabsTrigger value="headings" className="data-[state=active]:bg-white">
                  Simple Headings
                </TabsTrigger>
                <TabsTrigger value="json" className="data-[state=active]:bg-white">
                  JSON Structure
                </TabsTrigger>
              </TabsList>

              <TabsContent value="headings" className="mt-4">
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <Label htmlFor="headings">Headings (comma-separated)</Label>
                  <Input
                    id="headings"
                    value={headings}
                    onChange={(e) => setHeadings(e.target.value)}
                    className="mt-2 font-mono"
                    placeholder="E.g., Introduction, Methods, Results"
                  />
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-4">
                <div className="bg-white p-4 rounded-lg border shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="json">Custom JSON Structure</Label>
                      {jsonValid ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Valid JSON
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Invalid JSON
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy('json')}
                    >
                      {copied.json ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="relative">
                    <Textarea
                      id="json"
                      value={jsonStructure}
                      onChange={(e) => setJsonStructure(e.target.value)}
                      className="mt-2 min-h-[200px] font-mono text-sm bg-zinc-950 text-zinc-100 border-zinc-800"
                      spellCheck={false}
                    />
                    {jsonError && (
                      <div className="absolute bottom-2 left-2 right-2 bg-red-100 text-red-800 p-2 rounded text-sm">
                        Error on line {jsonError.line}, position {jsonError.position}: {jsonError.message}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full bg-zinc-900 hover:bg-zinc-800"
            disabled={loading || (!document && !file) || (activeTab === 'headings' ? !headings : !jsonValid)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Extract Information'
            )}
          </Button>

          {output && (
            <div className="mt-6 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-100">Output</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                  onClick={() => handleCopy('output')}
                >
                  {copied.output ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px]">
                <pre 
                  className="p-4 text-sm font-mono whitespace-pre-wrap text-zinc-100"
                  dangerouslySetInnerHTML={{
                    __html: syntaxHighlight(JSON.stringify(output, null, 2))
                  }}
                />
              </ScrollArea>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default DocumentForm;