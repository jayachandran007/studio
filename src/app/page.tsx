"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Shuffle, Wand2 } from "lucide-react";

import { scrambleMessage } from "@/ai/flows/scramble-message-llm";
import { suggestScrambleMethods } from "@/ai/flows/suggest-scramble-methods";

const INITIAL_METHODS = [
  "Reverse the message",
  "Letter substitution (A=B, B=C, etc.)",
  "Add relevant emojis",
  "Convert to Pig Latin",
];

export default function Home() {
  const [message, setMessage] = useState("");
  const [scrambledMessage, setScrambledMessage] = useState("");
  const [methods, setMethods] = useState<string[]>(INITIAL_METHODS);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [isScrambling, setIsScrambling] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [outputKey, setOutputKey] = useState(0);

  const { toast } = useToast();

  const handleSuggestMethods = async () => {
    if (!message) {
      toast({
        title: "Input needed",
        description: "Please enter a message to get suggestions.",
        variant: "destructive",
      });
      return;
    }
    setIsSuggesting(true);
    try {
      const result = await suggestScrambleMethods({ message });
      const newMethods = Array.from(
        new Set([...INITIAL_METHODS, ...result.suggestions])
      );
      setMethods(newMethods);
      toast({
        title: "Suggestions loaded",
        description: "New scrambling methods have been added to the list.",
      });
    } catch (error) {
      console.error("Error suggesting methods:", error);
      toast({
        title: "Error",
        description: "Could not fetch suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleScramble = async () => {
    if (!message || !selectedMethod) {
      toast({
        title: "Input needed",
        description: "Please enter a message and select a method.",
        variant: "destructive",
      });
      return;
    }
    setIsScrambling(true);
    setScrambledMessage("");
    try {
      const result = await scrambleMessage({ message, method: selectedMethod });
      setScrambledMessage(result.scrambledMessage);
      setOutputKey((k) => k + 1);
    } catch (error) {
      console.error("Error scrambling message:", error);
      toast({
        title: "Error",
        description: "Could not scramble the message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScrambling(false);
    }
  };

  const handleCopy = () => {
    if (scrambledMessage) {
      navigator.clipboard.writeText(scrambledMessage);
      toast({
        title: "Copied to clipboard!",
      });
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline tracking-tight sm:text-4xl">
            CipherChat
          </CardTitle>
          <CardDescription className="pt-2">
            Scramble your messages in fun and creative ways using AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="message" className="font-semibold">
              Your Message
            </Label>
            <Textarea
              id="message"
              placeholder="Type your secret message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="method" className="font-semibold">
              Scrambling Method
            </Label>
            <div className="flex gap-2">
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger id="method" className="flex-1">
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSuggestMethods}
                disabled={isSuggesting || !message}
                aria-label="Suggest Methods"
              >
                {isSuggesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <Button
            onClick={handleScramble}
            disabled={isScrambling || !message || !selectedMethod}
            className="w-full"
            size="lg"
          >
            {isScrambling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="mr-2 h-4 w-4" />
            )}
            <span>Scramble Message</span>
          </Button>
          {scrambledMessage && (
            <div
              key={outputKey}
              className="grid gap-2 animate-in fade-in-0 duration-700"
            >
              <Label htmlFor="scrambled-message" className="font-semibold">
                Scrambled Message
              </Label>
              <div className="relative">
                <Textarea
                  id="scrambled-message"
                  value={scrambledMessage}
                  readOnly
                  rows={4}
                  className="pr-12 resize-none bg-muted"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy message"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            Powered by Genkit AI. Results may vary.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
