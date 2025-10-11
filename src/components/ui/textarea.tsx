
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  const combinedRef = (ref ||
    internalRef) as React.RefObject<HTMLTextAreaElement>;

  React.useLayoutEffect(() => {
    const textarea = combinedRef.current;
    if (textarea) {
      // Reset height to recalculate
      textarea.style.height = "auto";
      // Set new height
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [props.value, combinedRef]);

  return (
    <textarea
      className={cn(
        "flex min-h-[40px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={combinedRef}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
