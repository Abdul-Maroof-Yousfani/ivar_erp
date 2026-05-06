export async function uploadFile(file: File): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/uploads`, { method: "POST", body: fd });
  const json = await res.json();
  if (json?.status && json?.data?.url && json?.data?.id) {
    return { id: json.data.id as string, url: json.data.url as string };
  }
  throw new Error(json?.message || "Upload failed");
}
