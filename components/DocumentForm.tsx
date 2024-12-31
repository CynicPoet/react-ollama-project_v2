import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, Copy, CheckCircle2, Terminal, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Common style classes
const commonClasses = {
  section: "bg-white p-5 rounded-lg border shadow-sm",
  label: "text-sm font-medium text-zinc-800",
  input: "bg-zinc-50 border-zinc-200 text-zinc-800 font-mono hover:border-zinc-300 focus:border-zinc-300 focus:ring-zinc-200",
  button: "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700",
  icon: "h-4 w-4 text-zinc-500",
  terminal: "bg-zinc-900 text-zinc-100"
};

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
  const [jsonError, setJsonError] = useState(null);
  const [copied, setCopied] = useState({ output: false, json: false });
  const [jsonValid, setJsonValid] = useState(true);

  useEffect(() => {
    validateJsonStructure(jsonStructure);
  }, [jsonStructure]);

  const validateJsonStructure = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.type || !parsed.properties) throw new Error('Missing required fields');
      setJsonError(null);
      setJsonValid(true);
      return true;
    } catch (e) {
      const match = e.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      const lines = jsonString.slice(0, position).split('\n');
      setJsonError({ line: lines.length, message: e.message, position });
      setJsonValid(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || (!document && !file) || (activeTab === 'headings' ? !headings : !jsonValid)) return;
    
    setOutput(null);
    setError('');
    setLoading(true);

    try {
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

      const data = await response.json();
      setOutput(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (type) => {
    const text = type === 'output' ? JSON.stringify(output, null, 2) : jsonStructure;
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [type]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [type]: false })), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file?.size > 25 * 1024 * 1024) {
      setError('File size must be less than 25MB');
      return;
    }
    setFile(file);
    setDocument('');
    setError('');
  };

  const handleTextChange = (e) => {
    setDocument(e.target.value);
    setFile(null);
    setError('');
  };

  const syntaxHighlight = (json) => {
    if (!json) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],])/g, 
      match => {
        const cls = /^[{}\[\],]$/.test(match) ? 'text-blue-300' :
                   /^"/.test(match) ? (/:$/.test(match) ? 'text-pink-300' : 'text-amber-300') :
                   /true|false/.test(match) ? 'text-purple-300' :
                   /null/.test(match) ? 'text-gray-400' : 'text-emerald-300';
        return `<span class="${cls}">${match}</span>`;
      });
  };

  return (
    <div className="flex justify-center items-start min-h-screen">
      <Card className="w-full max-w-2xl mx-4 my-8 border shadow-sm bg-white">
        <CardHeader className="border-b bg-zinc-50/50 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-grow">
              <CardTitle className="text-lg text-zinc-800">Document Extractor</CardTitle>
              <CardDescription className="mt-1 text-sm text-zinc-500">
                Extract structured information from your documents
              </CardDescription>
            </div>
            <div className="p-2 rounded-lg bg-white border shadow-sm">
              <Terminal className="h-5 w-5 text-zinc-600" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload Section */}
            <div className={`${commonClasses.section} space-y-2`}>
              <div className="flex items-center justify-between">
                <Label htmlFor="file" className={`flex items-center gap-2 ${commonClasses.label}`}>
                  <Upload className={commonClasses.icon} />Upload Document
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-zinc-400 hover:text-zinc-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-white p-2 text-sm max-w-xs">
                      <p>Supports PDF, DOCX, TXT, CSV, XLS, XLSX, Images, DOC, RTF, MD, JSON</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="file"
                type="file"
                accept={Object.values(SUPPORTED_FILE_TYPES).join(',')}
                onChange={handleFileChange}
                className={`${commonClasses.input} cursor-pointer file:bg-zinc-100 file:text-zinc-700
                         file:border-0 file:rounded hover:file:bg-zinc-200`}
              />
            </div>

            {/* Text Input Section */}
            <div className={`${commonClasses.section} space-y-2`}>
              <Label className={`flex items-center gap-2 ${commonClasses.label}`}>
                <FileText className={commonClasses.icon} />Or Paste Text
              </Label>
              <Textarea
                value={document}
                onChange={handleTextChange}
                disabled={!!file}
                className={`${commonClasses.input} min-h-[120px] resize-none`}
                placeholder="Paste your document content here..."
              />
            </div>

            {/* Extraction Method Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
              <TabsList className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-lg">
                <TabsTrigger 
                  value="headings"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
                >
                  Simple Headings
                </TabsTrigger>
                <TabsTrigger 
                  value="json"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
                >
                  JSON Structure
                </TabsTrigger>
              </TabsList>

              <TabsContent value="headings">
                <div className={`${commonClasses.section} space-y-2`}>
                  <Label className={commonClasses.label}>Headings</Label>
                  <Input
                    value={headings}
                    onChange={e => setHeadings(e.target.value)}
                    className={commonClasses.input}
                    placeholder="Introduction, Methods, Results"
                  />
                </div>
              </TabsContent>

              <TabsContent value="json">
                <div className={`${commonClasses.section} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className={commonClasses.label}>JSON Structure</Label>
                      <Badge variant={jsonValid ? "success" : "destructive"} className="text-xs">
                        {jsonValid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy('json')}
                      className={commonClasses.button}
                    >
                      {copied.json ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                        <Copy className={commonClasses.icon} />}
                    </Button>
                  </div>
                  <div className="relative">
                    <Textarea
                      value={jsonStructure}
                      onChange={e => setJsonStructure(e.target.value)}
                      className={`${commonClasses.terminal} min-h-[180px] font-mono text-sm`}
                      spellCheck={false}
                    />
                    {jsonError && (
                      <div className="absolute bottom-2 left-2 right-2 bg-red-50 
                                  border border-red-200 text-red-600 p-2 rounded text-sm">
                        Line {jsonError.line}: {jsonError.message}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                disabled={loading || (!document && !file) || (activeTab === 'headings' ? !headings : !jsonValid)}
                className="px-8 bg-zinc-900 hover:bg-zinc-800 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : 'Extract Information'}
              </Button>
            </div>

            {/* Output Section */}
            {output && (
              <div className={`${commonClasses.terminal} rounded-lg overflow-hidden mt-6`}>
                <div className="flex items-center justify-between p-2 bg-zinc-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-medium">Output</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy('output')}
                    className="h-7 bg-transparent border-zinc-700 hover:bg-zinc-800"
                  >
                    {copied.output ? 
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : 
                      <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <ScrollArea className="h-[250px]">
                  <pre 
                    className="p-4 text-sm font-mono whitespace-pre-wrap"
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
    </div>
  );
};

export default DocumentForm;