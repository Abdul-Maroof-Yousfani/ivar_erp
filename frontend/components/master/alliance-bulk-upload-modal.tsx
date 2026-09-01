'use client';

import React from 'react';
import { Handshake } from 'lucide-react';
import { GenericBulkUploadModal } from './generic-bulk-upload-modal';

interface AllianceBulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function AllianceBulkUploadModal(props: AllianceBulkUploadModalProps) {
    return (
        <GenericBulkUploadModal
            {...props}
            uploadType="alliance"
            apiBasePath="pos-config/alliances/bulk-upload"
            title="Alliance Discount Bulk Import"
            description="Upload your bank alliance discount sheet. Each row represents one BIN number — rows sharing the same alliance name are grouped automatically."
            icon={Handshake}
        />
    );
}
