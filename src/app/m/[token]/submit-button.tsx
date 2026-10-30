"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gold" size="lg" className="w-full" loading={pending}>
      <CheckCircle2 className="h-5 w-5" /> Yes, we met
    </Button>
  );
}
