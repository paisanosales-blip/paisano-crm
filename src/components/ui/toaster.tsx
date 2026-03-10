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

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([]);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribe(({ toast }) => {
      setToasts((prevToasts) => [
        {
          ...toast,
          open: true,
          onOpenChange: (open) => {
            if (!open) {
              setToasts((currentToasts) =>
                currentToasts.filter((t) => t.id !== toast.id)
              );
            }
          },
        },
        ...prevToasts,
      ].slice(0, TOAST_LIMIT));
    });
    return () => unsubscribe();
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <ToastProvider duration={TOAST_REMOVE_DELAY}>
      {toasts.map(function (toast) {
        const { id, title, description, action, ...props } = toast;
        return (
          <Toast key={id} {...props}>
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
