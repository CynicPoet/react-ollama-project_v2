import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DocumentForm = () => {
  const [document, setDocument] = useState('');
  const [headings, setHeadings] = useState('');
  const [output, setOutput] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      formData.append('headings', headings);

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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Document Information Extractor</CardTitle>
        <CardDescription>
          Upload a document or paste text to extract information based on your specified headings
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload File (PDF or DOCX)
              </Label>
              <div className="mt-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <Label htmlFor="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Or Paste Text
              </Label>
              <Textarea
                id="text"
                value={document}
                onChange={handleTextChange}
                disabled={!!file}
                className="mt-2 min-h-[150px]"
                placeholder="Paste your document or paragraph here"
              />
            </div>

            <div>
              <Label htmlFor="headings">Headings (comma-separated)</Label>
              <Input
                id="headings"
                type="text"
                value={headings}
                onChange={(e) => setHeadings(e.target.value)}
                className="mt-2"
                placeholder="E.g., Introduction, Methods, Results"
                required
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (!document && !file) || !headings}
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
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Extracted Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-sm">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default DocumentForm;