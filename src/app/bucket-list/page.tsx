
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { useFirebase, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import { format } from "date-fns";

interface BucketListItem {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: Timestamp;
}

export default function BucketListPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newItemText, setNewItemText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const user = sessionStorage.getItem("currentUser");
    if (!user) {
      router.replace("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);

  const bucketListCollectionRef = useMemoFirebase(() => db ? collection(db, 'bucketList') : null, [db]);

  useEffect(() => {
    if (!bucketListCollectionRef) return;

    setIsLoading(true);
    const q = query(bucketListCollectionRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bucketListItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BucketListItem));
      setItems(bucketListItems);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching bucket list items:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [bucketListCollectionRef]);

  const handleAddItem = async () => {
    if (!newItemText.trim() || !currentUser || !db) return;

    setIsAdding(true);
    try {
      await addDocumentNonBlocking(collection(db, "bucketList"), {
        text: newItemText.trim(),
        authorUsername: currentUser,
        createdAt: serverTimestamp(),
      });
      setNewItemText("");
    } catch (error) {
      console.error("Error adding bucket list item:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAdding) {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Shared Bucket List</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <p className="mt-4">The bucket list is empty. Add the first item!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{item.text}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Added by {item.authorUsername} on {item.createdAt && format(item.createdAt.toDate(), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
      <footer className="shrink-0 border-t bg-card p-2 md:p-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a new bucket list item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isAdding}
          />
          <Button
            size="icon"
            onClick={handleAddItem}
            disabled={isAdding || !newItemText.trim()}
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="sr-only">Add Item</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
