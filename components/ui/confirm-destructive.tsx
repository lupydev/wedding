"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * The only way this product asks "are you sure?".
 *
 * FOUR DEFECTS A REFERENCE CONSOLE SHIPPED, AND WHY THIS FIXES THEM BY
 * CONSTRUCTION RATHER THAN BY REMEMBERING TO:
 *
 *  1. `window.confirm`. Unstyleable, blocks the main thread, suppressible by the
 *     browser after a few uses — so the third destructive action of the evening
 *     happens with no confirmation at all — and on iOS the sheet names the ORIGIN
 *     rather than the consequence.
 *  2. `Dialog` where `AlertDialog` belonged. Without the `alertdialog` role an
 *     assistive technology announces a decision as a panel of content.
 *  3. No focus trap. Tab walked out of the open dialog into the page behind it,
 *     where a keyboard operator could activate the very row under discussion.
 *  4. Nothing `focus-visible` anywhere, so the keyboard path was invisible.
 *
 * Radix answers 2, 3 and 4 in the primitive; this component answers 1 by being
 * the only confirmation mechanism the console has.
 *
 * THE BODY STATES THE CONSEQUENCE, NOT THE QUESTION AGAIN. "¿Estás seguro?" tells
 * the operator nothing they did not already know. What they need is what will be
 * gone afterwards.
 */

export interface ConfirmDestructiveProps {
  /** The control that opens the question. A label, or a whole element. */
  readonly trigger: ReactNode;
  readonly title: string;
  /** What will be lost. Not a restatement of the title. */
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
}

export function ConfirmDestructive({
  trigger,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmDestructiveProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {typeof trigger === "string" ? (
          <Button type="button" variant="destructive">
            {trigger}
          </Button>
        ) : (
          trigger
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/*
            Cancel first in the DOM and last visually on a wide screen: the footer
            reverses its column order, so the destructive action is never the
            element focus lands on first.
          */}
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
