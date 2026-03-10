"use client"

import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// A simple event emitter
type ToastEvent = { toast: ToasterToast };
type Listener = (event: ToastEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: ToastEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type Toast = Omit<ToasterToast, "id">

function toast(props: Toast) {
  const id = genId()
  emit({ toast: { ...props, id } });
}

// The hook is now just a convenient wrapper around the global toast function.
function useToast() {
  return {
    toast,
    dismiss: () => { /* Not implemented in this simplified version */ },
  }
}

export { useToast, toast };
export type { ToasterToast };
