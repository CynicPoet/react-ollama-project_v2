import React from 'react';
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Github, Terminal, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-16">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="h-6 w-6 text-zinc-700" />
              <div>
                <h1 className="text-lg font-medium bg-gradient-to-r from-zinc-700 to-zinc-900 bg-clip-text text-transparent">
                  React Ollama Integration
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex"
                onClick={() => window.open('https://github.com/CynicPoet/react-ollama-project_v2', '_blank')}
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex"
                onClick={() => window.open('https://github.com/CynicPoet', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Portfolio
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-8 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Terminal className="h-4 w-4" />
              <span>Built with React + Ollama</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-zinc-600">
              <span>
                By{" "}
                <a
                  href="https://github.com/CynicPoet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-900 hover:text-zinc-700 transition-colors"
                >
                  Shivam Pokharkar
                </a>
              </span>
              <span>•</span>
              <span>&copy; {new Date().getFullYear()} All rights reserved</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;