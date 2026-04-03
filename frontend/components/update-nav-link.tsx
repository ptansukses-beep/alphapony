"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUpdateStatus } from "@/lib/api";
import type { UpdateStatusResponse } from "@/lib/api-types";

type UpdateNavLinkProps = {
  label: string;
  initialVisible: boolean;
};

const UPDATE_STATUS_POLL_MS = 60 * 60 * 1000;

export function UpdateNavLink({ label, initialVisible }: UpdateNavLinkProps) {
  const [visible, setVisible] = useState(initialVisible);

  useEffect(() => {
    function handleStatusChange(event: Event) {
      const nextStatus = (event as CustomEvent<UpdateStatusResponse>).detail;
      setVisible(nextStatus?.updateAvailable === true);
    }

    window.addEventListener("alphapony:update-status", handleStatusChange as EventListener);

    void getUpdateStatus()
      .then((status) => {
        setVisible(status.updateAvailable === true);
      })
      .catch(() => {});

    const intervalId = window.setInterval(() => {
      void getUpdateStatus()
        .then((status) => {
          setVisible(status.updateAvailable === true);
        })
        .catch(() => {});
    }, UPDATE_STATUS_POLL_MS);

    return () => {
      window.removeEventListener("alphapony:update-status", handleStatusChange as EventListener);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Link href="/sources" className="nav-update-link">
      <span className="nav-update-dot" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
