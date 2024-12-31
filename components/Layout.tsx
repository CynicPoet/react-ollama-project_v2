import React from 'react';
import { cn } from "@/lib/utils"; // Utility function for conditional class names
import { Separator } from "@/components/ui/separator";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold">React Ollama Integration</h1>
        </div>
      </header>

      <Separator />

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-6">
        {children}
      </main>

      <Separator />

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-4">
        <div className="text-center text-sm">
          &copy; {new Date().getFullYear()} React Ollama Project By Shivam Pokharkar. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
