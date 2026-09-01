'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { GenericBulkUploadModal } from '@/components/master/generic-bulk-upload-modal';

interface ItemUpdateBulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function ItemUpdateBulkUploadModal({
    open,
    onOpenChange,
    onSuccess,
    uploadId,
    onUploadIdChange,
}: ItemUpdateBulkUploadModalProps) {
    return (
        <GenericBulkUploadModal
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
            uploadId={uploadId}
            onUploadIdChange={onUploadIdChange}
            uploadType="item-update"
            apiBasePath="items/bulk-update-prices"
            title="Bulk Price & Tax Update"
            description="Update existing item prices (FOB/Sale Price) and Sales Tax Rates by Barcode. Missing or empty fields in the sheet will be skipped to prevent overwriting existing data."
            icon={Upload}
        />
    );
}
