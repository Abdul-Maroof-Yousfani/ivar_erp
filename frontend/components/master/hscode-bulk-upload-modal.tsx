'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { GenericBulkUploadModal } from './generic-bulk-upload-modal';

interface HsCodeBulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function HsCodeBulkUploadModal({
    open,
    onOpenChange,
    onSuccess,
    uploadId,
    onUploadIdChange,
}: HsCodeBulkUploadModalProps) {
    return (
        <GenericBulkUploadModal
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            uploadId={uploadId}
            onUploadIdChange={onUploadIdChange}
            uploadType="hscode"
            apiBasePath="master/hs-codes/bulk-upload"
            title="HS Code Bulk Management"
            description="Upload HS Codes with tax rates: Validate your data, then commit to the database."
            icon={Upload}
        />
    );
}