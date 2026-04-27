
"use client";

import { redirect } from "next/dist/server/api-utils";

export default async function Home() {
  window.location.href = "/hr";
}
