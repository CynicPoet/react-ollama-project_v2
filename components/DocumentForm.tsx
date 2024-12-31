import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, Copy, CheckCircle2, Terminal } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface JsonError {
  line: number;
  message: string;
  position: number;
}

const DocumentForm = () => {
  const [document, setDocument] = useState('');
  const [headings, setHeadings] = useState('');
  const [jsonStructure, setJsonStructure] = useState('{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "abstract": { "type": "string" }\n  }\n}');
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
    setFile(uploadedFile);
    setDocument('');
    setError('');
  };

  const handleTextChange = (event) => {
    setDocument(event.target.value);
    setFile(null);
    setError('');
  };

  const validateJsonStructure = (jsonString: string) => {
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      setJsonValid(true);
      return true;
    } catch (e) {
      const error = e as SyntaxError;
      const match = error.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      
      // Calculate line number and position
      const lines = jsonString.slice(0, position).split('\n');
      const line = lines.length;
      const positionInLine = position - jsonString.slice(0, position).lastIndexOf('\n');

      setJsonError({
        line,
        message: error.message,
        position: positionInLine
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

      if (activeTab === 'headings') {
        formData.append('headings', headings);
      } else {
        formData.append('jsonStructure', jsonStructure);
      }
      formData.append('mode', activeTab);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Something went wrong');
      }

      const data = await response.json();
      setOutput(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (type: 'output' | 'json') => {
    const text = type === 'output' 
      ? JSON.stringify(output, null, 2)
      : jsonStructure;
    
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setCopied(prev => ({ ...prev, [type]: false }));
    }, 2000);
  };

  const syntaxHighlight = (json: string) => {
    if (!json) return '';
    
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],])/g, 
      function (match) {
        if (/^[{}\[\],]$/.test(match)) {
          return `<span class="text-white">${match}</span>`;
        }
        
        let cls = 'text-emerald-400'; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-pink-400'; // key
          } else {
            cls = 'text-amber-400'; // string
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-purple-400'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-gray-400'; // null
        }
        return `<span class="${cls}">${match}</span>`;
      });
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (!document && !file) return true;
    if (activeTab === 'headings' && !headings) return true;
    if (activeTab === 'json' && (!jsonStructure || !jsonValid)) return true;
    return false;
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
              <Label htmlFor="file" className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4" />
                Upload File (PDF or DOCX)
              </Label>
              <div className="mt-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx"
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
                onChange={handleTextChange}
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
                    type="text"
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
                    <Label htmlFor="json" className="flex items-center gap-2">
                      Custom JSON Structure
                      {jsonValid ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Valid JSON
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Invalid JSON
                        </Badge>
                      )}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
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
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full bg-zinc-900 hover:bg-zinc-800"
            disabled={isSubmitDisabled()}
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