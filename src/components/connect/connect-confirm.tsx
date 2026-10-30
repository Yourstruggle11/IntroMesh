"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Handshake } from "lucide-react";
import { toast } from "sonner";
import { connectByCodeAction } from "@/app/actions/connect";
import { Button, ButtonLink } from "@/components/ui/button";

export function ConnectConfirm({ code, name, otherId, already }: { code: string; name: string; otherId: string; already: boolean }) {
  const [done, setDone] = useState(already);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" />
        </div>
        <p className="font-medium">You&apos;re connected with {name.split(" ")[0]}</p>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href={`/people/${otherId}`} variant="secondary">View profile</ButtonLink>
          <ButtonLink href="/discover">Find paths</ButtonLink>
        </div>
      </motion.div>
    );
  }
  return (
    <Button
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await connectByCodeAction(code);
          if (r.error) toast.error(r.error);
          else {
            setDone(true);
            toast.success(`Connected with ${name} 🤝`);
          }
        })
      }
    >
      <Handshake className="h-5 w-5" /> Connect with {name.split(" ")[0]}
    </Button>
  );
}
