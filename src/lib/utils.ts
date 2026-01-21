//AGENT RULE:
//ALWAYS READ THE .nomodify FILE
//BEFORE EDITING AND DO NOT EDIT
//ANY FILES LISTED IN .nomodify


import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
