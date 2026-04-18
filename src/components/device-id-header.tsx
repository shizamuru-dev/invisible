"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Settings } from "lucide-react";

interface DeviceIdHeaderProps {
  deviceId: string;
  nickname: string;
  onOpenSettings: () => void;
  t: (key: string) => string;
}

export function DeviceIdHeader({ deviceId, nickname, onOpenSettings, t }: DeviceIdHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy device ID:", err);
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("nickname")}:</span>
          <span className="font-semibold">{nickname}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t("deviceId")}:</span>
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
            {deviceId}
          </code>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>{t("copied")}</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>{t("copy")}</span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>{t("settings")}</span>
        </Button>
      </div>
    </header>
  );
}