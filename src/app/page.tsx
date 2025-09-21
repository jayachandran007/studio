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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Shuffle } from "lucide-react";

import { scrambleMessage } from "@/ai/flows/scramble-message-llm";

const SCRAMBLE_METHOD = "Letter substitution (A=B, B=C, etc.)";

export default function Home() {
  const [message, setMessage] = useState("");
  const [scrambledMessage, setScrambledMessage] = useState("");
  const [isScrambling, setIsScrambling] = useState(false);
  const [outputKey, setOutputKey] = useState(0);

  const { toast } = useToast();

  const handleScramble = async () => {
    if (!message) {
      toast({
        title: "Input needed",
        description: "Please enter a message to scramble.",
        variant: "destructive",
      });
      return;
    }
    setIsScrambling(true);
    setScrambledMessage("");
    try {
      const result = await scrambleMessage({
        message,
        method: SCRAMBLE_METHOD,
      });
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
          <Button
            onClick={handleScramble}
            disabled={isScrambling || !message}
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
