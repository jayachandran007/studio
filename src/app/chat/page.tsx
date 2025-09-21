
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, Send, User } from "lucide-react";

import { scrambleMessage } from "@/ai/flows/scramble-message-llm";
import { cn } from "@/lib/utils";

const SCRAMBLE_METHOD = "Letter substitution (A=B, B=C, etc.)";

interface Message {
  id: string;
  originalText: string;
  scrambledText: string;
  sender: "user" | "agent";
  createdAt: any;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isScrambling, setIsScrambling] = useState(false);
  const [showScrambled, setShowScrambled] = useState(true);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [router]);
  
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: Message[] = [];
      querySnapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messagesData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    if (trimmedInput.toLowerCase() === 'toggle') {
      setShowScrambled(prev => !prev);
      setInput('');
      return;
    }

    setIsScrambling(true);
    setInput("");

    try {
      // Scramble the user's message first
      const userScrambleResult = await scrambleMessage({
        message: trimmedInput,
        method: SCRAMBLE_METHOD,
      });
      const userMessage = {
        originalText: trimmedInput,
        scrambledText: userScrambleResult.scrambledMessage,
        sender: "user" as const,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "messages"), userMessage);

      // For the agent's reply, we'll use the user's scrambled message as input
      const agentScrambleResult = await scrambleMessage({
          message: userScrambleResult.scrambledMessage,
          method: SCRAMBLE_METHOD,
      });
      const agentMessage = {
        originalText: userScrambleResult.scrambledMessage,
        scrambledText: agentScrambleResult.scrambledMessage,
        sender: "agent" as const,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "messages"), agentMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Could not send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScrambling(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isScrambling) {
      handleSend();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col">
      <header className="flex h-16 items-center justify-center border-b bg-card px-4">
        <h1 className="text-xl font-bold">AgentChat</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 md:p-6">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
                    message.sender === "user" && "justify-end"
                  )}
                >
                  {message.sender === "agent" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg p-3 text-sm",
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p>{showScrambled ? message.scrambledText : message.originalText}</p>
                  </div>
                   {message.sender === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isScrambling && (
                 <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3 text-sm flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </main>
      <footer className="border-t bg-card p-4">
        <div className="relative">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isScrambling}
            className="pr-12"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleSend}
            disabled={isScrambling || !input.trim()}
          >
            {isScrambling ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
