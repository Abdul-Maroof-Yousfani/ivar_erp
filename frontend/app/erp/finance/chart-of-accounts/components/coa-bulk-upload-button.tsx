'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { CoaBulkUploadModal } from '@/components/finance/coa-bulk-upload-modal';
import { useRouter } from 'next/navigation';

export function CoaBulkUploadButton() {
    const [open, setOpen] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const router = useRouter();

    const handleSuccess = () => {
        router.refresh();
    };

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import
            </Button>

            <CoaBulkUploadModal
                open={open}
                onOpenChange={setOpen}
                onSuccess={handleSuccess}
                uploadId={uploadId}
                onUploadIdChange={setUploadId}
            />
        </>
    );
}
