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

  React.useEffect(() => {
    const unsubscribe = subscribe(({ toast }) => {
      // Add toast to state to display it
      setToasts((prevToasts) => [
        {
          ...toast,
          open: true,
          onOpenChange: (open) => {
            if (!open) {
              // When Radix closes the toast, remove it from our state
              setToasts((currentToasts) =>
                currentToasts.filter((t) => t.id !== toast.id)
              );
            }
          },
        },
        ...prevToasts,
      ].slice(0, TOAST_LIMIT));

      // After showing the toast, refresh the page data
      setTimeout(() => {
        router.refresh();
      }, 100);
    });

    return () => unsubscribe();
  }, [router]);

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
