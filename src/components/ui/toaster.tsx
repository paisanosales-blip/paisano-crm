"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { subscribe, type ToasterToast } from "@/hooks/use-toast"
import * as React from "react"
import { useRouter } from "next/navigation"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([]);
  const router = useRouter();

  // Memoize the callback to prevent re-subscribing on every render
  const handleToast = React.useCallback(({ toast }: { toast: ToasterToast }) => {
    // Add toast to state to display it
    setToasts((prevToasts) => [
      {
        ...toast,
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            // When Radix closes the toast (e.g., after duration), remove it from our state
            setToasts((currentToasts) =>
              currentToasts.filter((t) => t.id !== toast.id)
            );
          }
        },
      },
      ...prevToasts,
    ].slice(0, TOAST_LIMIT));

    // After showing the toast, refresh the page data
    // This is non-blocking and will re-fetch data for Server Components.
    router.refresh();
    
  }, [router]);

  // Subscribe to the global toast events
  React.useEffect(() => {
    const unsubscribe = subscribe(handleToast);
    return () => unsubscribe();
  }, [handleToast]);

  return (
    <ToastProvider duration={TOAST_REMOVE_DELAY}>
      {toasts.map(function (toast) {
        const { id, title, description, action, ...props } = toast;
        return (
          <Toast key={id} {...props} className="pointer-events-auto">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
